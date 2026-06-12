<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/vue-3';
import Placeholder from '@tiptap/extension-placeholder';
import { richTextExtensions, loadCodeHighlighting } from '@/editor/extensions';
import { useAuthStore } from '@/stores/auth.store';
import { useNotesStore } from '@/stores/notes.store';
import { useNoteSync } from '@/composables/useNoteSync';
import { RemoteCursorExtension, setCursors } from '@/composables/RemoteCursorExtension';
import { aiApi } from '@/api/ai.api';
import { notesApi } from '@/api/notes.api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import TagSuggestionInput from '@/components/notes/TagSuggestionInput.vue';
import FolderPicker from '@/components/notes/FolderPicker.vue';
import ShareExportMenu from '@/components/notes/ShareExportMenu.vue';
import ShareNoteModal from '@/components/notes/ShareNoteModal.vue';
import VersionHistoryModal from '@/components/notes/VersionHistoryModal.vue';
import ToolbarDropdown from '@/components/notes/ToolbarDropdown.vue';
import LinkModal from '@/components/notes/LinkModal.vue';
import CommentSection from '@/components/notes/CommentSection.vue';
import { toast } from 'vue-sonner';
import {
  ArrowLeft, Star, History, Archive, Trash2, Sparkles, X, Pin, Copy, FileText,
  MessageSquare,
  Bold, Italic, Strikethrough, Heading, Heading1, Heading2, Heading3,
  List, ListOrdered, Code, Underline as UnderlineIcon, Pilcrow,
  ListChecks, Quote, Code2, Minus, Plus, Link2, Link2Off,
  Palette, Highlighter, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Subscript as SubscriptIcon, Superscript as SuperscriptIcon,
  Table as TableIcon, Rows3, Columns3, Trash, RemoveFormatting,
} from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const store = useNotesStore();
const noteSync = useNoteSync();

const titleInput = ref('');
const saveTimer = ref<ReturnType<typeof setTimeout> | null>(null);
const showVersions = ref(false);
const showShares = ref(false);
const isSuggestingTitle = ref(false);

// Prevent re-broadcasting remote updates
let isApplyingRemote = false;

// ── Tiptap editor ──────────────────────────────────────────────
const editor = useEditor({
  extensions: [
    ...richTextExtensions(),
    Placeholder.configure({ placeholder: 'Type "/" for commands…' }),
    RemoteCursorExtension,
  ],
  editorProps: {
    attributes: { class: 'prose-editor focus:outline-none' },
  },
  onUpdate: ({ editor }) => {
    if (isApplyingRemote) return;
    const content = editor.getHTML();
    scheduleSave(titleInput.value, content);
    scheduleSync(titleInput.value, content);
  },
  onSelectionUpdate: ({ editor }) => {
    if (!store.currentNote || !auth.accessToken || !store.canEdit) return;
    const { from, to } = editor.state.selection;
    noteSync.emitCursor(store.currentNote.id, from, to);
  },
});

// Keep editor editable state in sync with permission
watch(
  () => store.canEdit,
  (editable) => { editor.value?.setEditable(editable); },
  { immediate: true },
);

// Keep remote cursors in sync with the editor (sync flush = same frame as cursor change)
watch(
  noteSync.remoteCursors,
  (cursors) => {
    if (editor.value?.view) setCursors(editor.value.view, cursors);
  },
  { deep: true, flush: 'sync' },
);

// ── Register real-time handlers ────────────────────────────────
const unsubscribeUpdate = noteSync.onNoteUpdate((payload) => {
  if (payload.userId === auth.user?.id) return;
  if (payload.noteId !== store.currentNote?.id) {
    store.applyRemoteUpdate(payload.noteId, payload.title, payload.content);
    return;
  }
  isApplyingRemote = true;
  titleInput.value = payload.title;
  store.applyRemoteUpdate(payload.noteId, payload.title, payload.content);
  if (editor.value) {
    const wasEditable = editor.value.isEditable;
    if (!wasEditable) editor.value.setEditable(true, false);
    // Prefer JSON (lossless, exact positions) over HTML (whitespace may be normalized)
    editor.value.commands.setContent(payload.json ?? payload.content, false);
    if (!wasEditable) editor.value.setEditable(false, false);
    // Apply cursor synchronously in the same JS task — both ProseMirror dispatches
    // happen before the browser paints, so cursor and content update atomically
    if (editor.value.view) {
      setCursors(editor.value.view, noteSync.remoteCursors.value);
    }
  }
  nextTick(() => { isApplyingRemote = false; });
});

const unsubscribePermission = noteSync.onPermissionChanged((payload) => {
  if (payload.userId !== auth.user?.id) return;
  // Updating the store triggers the canEdit watcher which calls setEditable
  store.notePermissions[payload.noteId] = payload.permission;
  if (store.currentNote?.id === payload.noteId && payload.permission === 'WRITE') {
    // Focus is required so the browser registers the new contenteditable state
    nextTick(() => editor.value?.commands.focus());
  }
});

const unsubscribeRevoked = noteSync.onShareRevoked((payload) => {
  if (payload.userId !== auth.user?.id) return;
  delete store.notePermissions[payload.noteId];
  store.sharedNotes = store.sharedNotes.filter(n => n.id !== payload.noteId);
  if (store.currentNote?.id === payload.noteId) {
    noteSync.leaveNote();
    store.selectNote(null);
    router.push('/notes');
  }
});

const unsubscribeTags = noteSync.onTagsUpdated((payload) => {
  store.applyRemoteTagsUpdate(payload.noteId, payload.tags);
});

const unsubscribeDeleted = noteSync.onNoteDeleted((payload) => {
  if (store.currentNote?.id === payload.noteId && store.currentPermission !== 'OWNER') {
    noteSync.leaveNote();
    store.selectNote(null);
    router.push('/notes');
  }
  store.applyNoteDeleted(payload.noteId);
});

const unsubscribeArchived = noteSync.onNoteArchived((payload) => {
  if (store.currentNote?.id === payload.noteId && store.currentPermission !== 'OWNER') {
    noteSync.leaveNote();
    store.selectNote(null);
    router.push('/notes');
  }
  store.applyNoteArchived(payload.noteId);
});

// ── Note loading by route param ────────────────────────────────
async function loadNote(id: string) {
  noteSync.leaveNote();
  showVersions.value = false;
  showShares.value = false;

  let note = store.notes.find(n => n.id === id)
    ?? store.sharedNotes.find(n => n.id === id)
    ?? null;
  if (!note) {
    const { data } = await notesApi.findOne(id);
    note = data;
  }
  if (!note) return;

  store.selectNote(note);
  titleInput.value = note.title;
  editor.value?.commands.setContent(note.content || '');
  editor.value?.setEditable(store.canEdit);

  if (auth.accessToken) {
    await noteSync.joinNote(auth.accessToken, note.id);
  }
}

onMounted(async () => {
  if (!auth.user) await auth.fetchMe().catch(() => auth.clearAuth());
  if (store.notes.length === 0) await store.fetchNotes();
  if (auth.accessToken) noteSync.connect(auth.accessToken);
  await loadNote(route.params.id as string);
  // Lazily pull in syntax-highlighting grammars (separate async chunk) once the
  // editor is up — keeps them out of the initial editor bundle.
  void loadCodeHighlighting(editor.value);
});

watch(() => route.params.id, (id) => {
  if (id) loadNote(id as string);
});

onBeforeUnmount(() => {
  unsubscribeUpdate();
  unsubscribePermission();
  unsubscribeRevoked();
  unsubscribeTags();
  unsubscribeDeleted();
  unsubscribeArchived();
  noteSync.leaveNote();
  editor.value?.destroy();
  noteSync.disconnect();
});

// ── Save & sync ────────────────────────────────────────────────
function scheduleSave(title: string, content: string) {
  if (!store.currentNote || !store.canEdit) return;
  if (saveTimer.value) clearTimeout(saveTimer.value);
  saveTimer.value = setTimeout(async () => {
    await store.updateNote(store.currentNote!.id, { title, content });
  }, 1500);
}

function scheduleSync(title: string, content: string) {
  if (!store.currentNote || !store.canEdit) return;
  const sel = editor.value?.state.selection;
  // Send ProseMirror JSON (lossless) alongside HTML — JSON preserves all whitespace
  // so cursor positions are always valid on the receiver side
  const json = editor.value?.getJSON();
  noteSync.emitUpdate(store.currentNote!.id, title, content, sel?.from, sel?.to, json);
}

function onTitleInput() {
  if (isApplyingRemote) return;
  const content = editor.value?.getHTML() ?? '';
  scheduleSave(titleInput.value, content);
  scheduleSync(titleInput.value, content);
}

// ── AI suggest title ───────────────────────────────────────────
async function suggestTitle() {
  if (!store.currentNote || isSuggestingTitle.value) return;
  const content = editor.value?.getHTML() ?? '';
  if (!content || content === '<p></p>') return;
  isSuggestingTitle.value = true;
  try {
    const { data } = await aiApi.suggestTitle(content);
    if (data.title) {
      titleInput.value = data.title;
      scheduleSave(data.title, content);
    }
  } finally {
    isSuggestingTitle.value = false;
  }
}

// ── AI Tag Suggestion ─────────────────────────────────────────
const suggestedTags = ref<string[]>([]);
const isSuggestingTags = ref(false);

async function suggestTags() {
  if (!store.currentNote || isSuggestingTags.value) return;
  const content = editor.value?.getHTML() ?? '';
  if (!content || content === '<p></p>') {
    toast.error('Write some content first to suggest tags.');
    return;
  }
  isSuggestingTags.value = true;
  try {
    const existingNames = store.tags.map(t => t.name);
    const { data } = await aiApi.suggestTags(content, existingNames);
    suggestedTags.value = data.tags || [];
    if (suggestedTags.value.length === 0) {
      toast.info('No tags suggested for this content.');
    }
  } catch (error: any) {
    toast.error('Failed to suggest tags', { description: error.message });
  } finally {
    isSuggestingTags.value = false;
  }
}

async function addSuggestedTag(tagName: string) {
  if (!store.currentNote) return;
  const existing = store.tags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
  if (existing) {
    if (currentTagIds.value.includes(existing.id)) return;
    await store.addTagToNote(store.currentNote.id, existing.id);
  } else {
    const colors = ['#f87171', '#fb923c', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const t = await store.createTag(tagName, randomColor);
    await store.addTagToNote(store.currentNote.id, t.id);
  }
  suggestedTags.value = suggestedTags.value.filter(t => t !== tagName);
  toast.success(`Tag #${tagName} added`);
}

// ── AI Summarization ──────────────────────────────────────────
const isSummarizing = ref(false);
const summaryText = ref('');
const showSummaryPanel = ref(false);
const showCommentsPanel = ref(false);

async function summarizeCurrentNote() {
  if (!store.currentNote || isSummarizing.value) return;
  const content = editor.value?.getHTML() ?? '';
  if (!content || content === '<p></p>') {
    toast.error('Write some content first to summarize.');
    return;
  }
  isSummarizing.value = true;
  try {
    const { data } = await aiApi.summarize(content);
    summaryText.value = data.summary || '';
    showSummaryPanel.value = true;
  } catch (error: any) {
    toast.error('Failed to summarize note', { description: error.message });
  } finally {
    isSummarizing.value = false;
  }
}

// ── Version & share panels ─────────────────────────────────────
function toggleVersions() {
  showVersions.value = !showVersions.value;
  showShares.value = false;
}

async function restore(versionId: string) {
  if (!store.currentNote) return;
  await store.restoreVersion(store.currentNote.id, versionId);
  titleInput.value = store.currentNote?.title ?? '';
  editor.value?.commands.setContent(store.currentNote?.content ?? '');
  showVersions.value = false;
}

// ── Favorite / archive / delete ────────────────────────────────
async function archiveCurrent() {
  if (!store.currentNote) return;
  await store.toggleArchive(store.currentNote.id);
  noteSync.leaveNote();
  router.push('/notes');
}

async function deleteCurrent() {
  if (!store.currentNote) return;
  await store.deleteNote(store.currentNote.id);
  noteSync.leaveNote();
  router.push('/notes');
}

async function duplicateCurrent() {
  if (!store.currentNote) return;
  try {
    const newNote = await store.duplicateNote(store.currentNote.id);
    toast.success('Note duplicated successfully');
    router.push(`/notes/${newNote.id}`);
  } catch (error: any) {
    toast.error('Failed to duplicate note', { description: error.message });
  }
}

// ── Tags / folder organisation (owner only) ────────────────────
const currentTagIds = computed(() => store.currentNote?.tags.map(t => t.id) ?? []);

async function handleTagSelect(tagId: string) {
  if (!store.currentNote) return;
  await store.addTagToNote(store.currentNote.id, tagId);
}

async function handleTagCreate(name: string) {
  if (!store.currentNote) return;
  const t = await store.createTag(name, '#6366f1');
  await store.addTagToNote(store.currentNote.id, t.id);
}

async function handleTagRemove(tagId: string) {
  if (!store.currentNote) return;
  await store.removeTagFromNote(store.currentNote.id, tagId);
}

async function handleFolderChange(folderId: string | null) {
  if (!store.currentNote) return;
  await store.updateNote(store.currentNote.id, { folderId });
}

// ── Format toolbar ─────────────────────────────────────────────
// Lightweight reactive flag bumped on every selection/transaction so the
// toolbar `isActive(...)` lookups re-evaluate. This does NOT touch save/sync.
const editorTick = ref(0);
watch(editor, (ed) => {
  if (!ed) return;
  ed.on('transaction', () => { editorTick.value++; });
});

const currentAlignIcon = computed(() => {
  editorTick.value;
  const ed = editor.value;
  if (ed && ed.isActive({ textAlign: 'center' })) return AlignCenter;
  if (ed && ed.isActive({ textAlign: 'right' })) return AlignRight;
  if (ed && ed.isActive({ textAlign: 'justify' })) return AlignJustify;
  return AlignLeft;
});

// Toolbar helpers — all gated by store.canEdit at the call site / template.
function run(fn: () => void) {
  if (!store.canEdit || !editor.value) return;
  fn();
}
const isActive = (name: string, attrs?: Record<string, unknown>) => {
  editorTick.value; // dependency for reactivity
  return editor.value?.isActive(name, attrs) ?? false;
};

const inTable = computed(() => {
  editorTick.value;
  return editor.value?.isActive('table') ?? false;
});

// Link — handled via a proper modal (no window.prompt)
const linkModalOpen = ref(false);
const linkInitialUrl = ref('');

function openLinkModal() {
  if (!editor.value || !store.canEdit) return;
  linkInitialUrl.value = (editor.value.getAttributes('link').href as string) ?? '';
  linkModalOpen.value = true;
}
function applyLink(url: string) {
  if (!editor.value) return;
  const href = url.trim();
  if (href === '') {
    editor.value.chain().focus().extendMarkRange('link').unsetLink().run();
  } else {
    editor.value.chain().focus().extendMarkRange('link').setLink({ href }).run();
  }
  linkModalOpen.value = false;
}
function removeLink() {
  editor.value?.chain().focus().extendMarkRange('link').unsetLink().run();
  linkModalOpen.value = false;
}
function unsetLink() {
  run(() => editor.value!.chain().focus().extendMarkRange('link').unsetLink().run());
}

// Color & highlight palettes
const textColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b'];
const highlightColors = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa', '#e9d5ff', '#fecaca', '#d1fae5'];
const showColorMenu = ref(false);
const showHighlightMenu = ref(false);

function setColor(hex: string) {
  run(() => editor.value!.chain().focus().setColor(hex).run());
  showColorMenu.value = false;
}
function clearColor() {
  run(() => editor.value!.chain().focus().unsetColor().run());
  showColorMenu.value = false;
}
function setHighlight(hex: string) {
  run(() => editor.value!.chain().focus().setHighlight({ color: hex }).run());
  showHighlightMenu.value = false;
}
function clearHighlight() {
  run(() => editor.value!.chain().focus().unsetHighlight().run());
  showHighlightMenu.value = false;
}

// Clear all formatting
function clearFormatting() {
  run(() => editor.value!.chain().focus().unsetAllMarks().clearNodes().run());
}

// ── Word count / reading time ──────────────────────────────────
const wordCount = computed(() => {
  editorTick.value; // reactivity
  const text = editor.value?.state.doc.textContent ?? '';
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length;
});

const charCount = computed(() => {
  editorTick.value;
  return (editor.value?.state.doc.textContent ?? '').length;
});

const readingTime = computed(() => {
  const mins = Math.ceil(wordCount.value / 200);
  return mins < 1 ? '< 1 min' : `${mins} min`;
});

</script>

<template>
  <div class="flex h-full min-h-0 flex-1 flex-col bg-background text-foreground overflow-hidden">
    <!-- ── Top editor bar ──────────────────────────────── -->
    <header class="shrink-0 border-b border-border bg-background">
      <div class="flex flex-wrap items-center gap-2 px-3 py-2 md:px-4">
        <!-- Back -->
        <Button variant="ghost" size="icon" title="Back to notes" @click="router.push('/notes')">
          <ArrowLeft class="size-4" />
        </Button>

        <!-- Title -->
        <input
          v-model="titleInput"
          @input="onTitleInput"
          :disabled="!store.canEdit"
          placeholder="Untitled"
          class="min-w-0 flex-1 bg-transparent text-lg font-semibold tracking-tight outline-none placeholder:text-muted-foreground disabled:cursor-default disabled:opacity-70"
        />

        <!-- Right actions -->
        <div class="flex items-center gap-1">
          <!-- Live presence avatars -->
          <div v-if="noteSync.presentUsers.value.length" class="flex items-center -space-x-1 mr-1">
            <div
              v-for="u in noteSync.presentUsers.value" :key="u.userId"
              :title="u.userName"
              class="flex size-6 items-center justify-center rounded-full border-2 border-background text-xs font-medium text-white"
              :style="{ background: u.color }">
              {{ u.userName.charAt(0).toUpperCase() }}
            </div>
          </div>

          <!-- Permission badge -->
          <Badge v-if="store.currentPermission === 'READ'" variant="secondary">Read only</Badge>
          <Badge v-else-if="store.currentPermission === 'WRITE'">Can edit</Badge>

          <!-- AI suggest title -->
          <Button
            variant="ghost" size="icon"
            :disabled="isSuggestingTitle || !store.canEdit"
            :title="isSuggestingTitle ? 'Génération en cours…' : 'Suggérer un titre (IA)'"
            :class="isSuggestingTitle ? 'text-primary' : ''"
            @click="suggestTitle">
            <Sparkles class="size-4" :class="isSuggestingTitle ? 'animate-pulse' : ''" />
          </Button>

          <!-- AI Summarize -->
          <Button
            variant="ghost" size="icon"
            :disabled="isSummarizing"
            :title="isSummarizing ? 'Résumé en cours…' : 'Résumer la note (IA)'"
            :class="showSummaryPanel ? 'bg-accent text-accent-foreground' : ''"
            @click="summarizeCurrentNote">
            <FileText class="size-4" :class="isSummarizing ? 'animate-pulse' : ''" />
          </Button>

          <!-- Version history -->
          <Button
            variant="ghost" size="icon" title="Version history"
            :class="showVersions ? 'bg-accent text-accent-foreground' : ''"
            @click="toggleVersions">
            <History class="size-4" />
          </Button>

          <!-- Comments -->
          <Button
            v-if="store.currentNote"
            variant="ghost" size="icon" title="Commentaires"
            :class="showCommentsPanel ? 'bg-accent text-accent-foreground' : ''"
            @click="showCommentsPanel = !showCommentsPanel; showSummaryPanel = false">
            <MessageSquare class="size-4" />
          </Button>

          <!-- Share / export (share with people, copy, markdown, print, system share) -->
          <ShareExportMenu
            v-if="store.currentNote"
            :note-id="store.currentNote.id"
            :title="titleInput"
            :content-html="editor?.getHTML() ?? store.currentNote.content"
            :owner="store.currentPermission === 'OWNER'"
            @share-people="showShares = true"
          />

          <template v-if="store.currentPermission === 'OWNER' && store.currentNote">
            <!-- Pin -->
            <Button
              variant="ghost" size="icon"
              :title="store.currentNote.isPinned ? 'Unpin note' : 'Pin note'"
              :class="store.currentNote.isPinned ? 'text-primary' : ''"
              @click="store.togglePin(store.currentNote.id)">
              <Pin class="size-4" :class="store.currentNote.isPinned ? 'fill-primary' : ''" />
            </Button>

            <!-- Favorite -->
            <Button
              variant="ghost" size="icon"
              :title="store.currentNote.isFavorite ? 'Remove from favorites' : 'Add to favorites'"
              :class="store.currentNote.isFavorite ? 'text-primary' : ''"
              @click="store.toggleFavorite(store.currentNote.id)">
              <Star class="size-4" :class="store.currentNote.isFavorite ? 'fill-primary' : ''" />
            </Button>

            <!-- Archive -->
            <Button
              variant="ghost" size="icon"
              :title="store.currentNote.isArchived ? 'Unarchive' : 'Archive'"
              @click="archiveCurrent">
              <Archive class="size-4" />
            </Button>

            <!-- Duplicate -->
            <Button
              variant="ghost" size="icon"
              title="Duplicate note"
              @click="duplicateCurrent">
              <Copy class="size-4" />
            </Button>

            <!-- Delete -->
            <Button variant="ghost" size="icon" title="Delete note" class="text-destructive" @click="deleteCurrent">
              <Trash2 class="size-4" />
            </Button>
          </template>

          <!-- Save status + word count -->
          <span class="ml-1 text-xs text-muted-foreground whitespace-nowrap">
            {{ wordCount.toLocaleString() }} words · {{ readingTime }}
            <span class="mx-1 text-border">|</span>
            {{ store.isSaving ? 'Saving…' : 'Saved' }}
          </span>
        </div>
      </div>

      <!-- Tags + folder organisation (owner / can-edit only) -->
      <div
        v-if="store.currentPermission === 'OWNER' && store.currentNote"
        class="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 pb-2 md:px-4">
        <div class="flex min-w-0 flex-wrap items-center gap-1.5">
          <Badge
            v-for="tag in store.currentNote.tags" :key="tag.id"
            variant="secondary"
            class="gap-1 pr-1">
            <span
              class="size-2 shrink-0 rounded-full border border-border"
              :style="{ background: tag.color }" />
            <span class="truncate">{{ tag.name }}</span>
            <button
              type="button"
              :title="`Remove ${tag.name}`"
              class="-mr-0.5 ml-0.5 flex size-4 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              @click="handleTagRemove(tag.id)">
              <X class="size-3" />
            </button>
          </Badge>

          <div class="flex items-center gap-1.5 flex-wrap">
            <div class="w-44 shrink-0">
              <TagSuggestionInput
                :existing-tag-ids="currentTagIds"
                @select="handleTagSelect"
                @create="handleTagCreate" />
            </div>
            <Button
              variant="outline"
              size="sm"
              :disabled="isSuggestingTags"
              title="Suggérer des tags par l'IA"
              @click="suggestTags"
              class="gap-1 px-2.5 h-[38px] text-xs">
              <Sparkles class="size-3.5" :class="isSuggestingTags ? 'animate-spin' : ''" />
              Suggérer des tags
            </Button>
          </div>
        </div>

        <!-- AI Suggested Tag Chips -->
        <div v-if="suggestedTags.length > 0" class="flex w-full items-center gap-1.5 flex-wrap text-xs text-muted-foreground mt-1 bg-accent/20 p-2 rounded-md border border-border/50">
          <span class="font-medium shrink-0 flex items-center gap-1"><Sparkles class="size-3 text-primary animate-pulse" /> Suggestions d'IA :</span>
          <button
            v-for="tag in suggestedTags"
            :key="tag"
            @click="addSuggestedTag(tag)"
            class="flex items-center gap-1 border border-primary/20 hover:border-primary/50 bg-primary/5 hover:bg-primary/10 text-primary px-2.5 py-1 rounded-full transition-colors font-medium">
            + {{ tag }}
          </button>
          <button @click="suggestedTags = []" class="text-muted-foreground hover:text-foreground ml-auto pl-2">
            <X class="size-3" />
          </button>
        </div>

        <div class="ml-auto w-48 shrink-0">
          <FolderPicker
            :model-value="store.currentNote.folderId"
            :folders="store.folders"
            @update:model-value="handleFolderChange" />
        </div>
      </div>

      <!-- Format toolbar -->
      <div class="flex flex-wrap items-center gap-0.5 border-t border-border px-3 py-1.5 md:px-4">
        <!-- Inline marks -->
        <button
          type="button" title="Bold" :disabled="!store.canEdit"
          @click="run(() => editor!.chain().focus().toggleBold().run())"
          class="tbtn" :class="isActive('bold') ? 'tbtn-on' : 'tbtn-off'">
          <Bold class="size-4" />
        </button>
        <button
          type="button" title="Italic" :disabled="!store.canEdit"
          @click="run(() => editor!.chain().focus().toggleItalic().run())"
          class="tbtn" :class="isActive('italic') ? 'tbtn-on' : 'tbtn-off'">
          <Italic class="size-4" />
        </button>
        <button
          type="button" title="Underline" :disabled="!store.canEdit"
          @click="run(() => editor!.chain().focus().toggleUnderline().run())"
          class="tbtn" :class="isActive('underline') ? 'tbtn-on' : 'tbtn-off'">
          <UnderlineIcon class="size-4" />
        </button>
        <button
          type="button" title="Strikethrough" :disabled="!store.canEdit"
          @click="run(() => editor!.chain().focus().toggleStrike().run())"
          class="tbtn" :class="isActive('strike') ? 'tbtn-on' : 'tbtn-off'">
          <Strikethrough class="size-4" />
        </button>
        <button
          type="button" title="Inline code" :disabled="!store.canEdit"
          @click="run(() => editor!.chain().focus().toggleCode().run())"
          class="tbtn" :class="isActive('code') ? 'tbtn-on' : 'tbtn-off'">
          <Code class="size-4" />
        </button>

        <span class="tbar-sep" />

        <!-- Text style (headings + paragraph) -->
        <ToolbarDropdown
          :icon="Heading" title="Text style" :disabled="!store.canEdit"
          :active="isActive('heading')">
          <button
            type="button" :disabled="!store.canEdit"
            @click="run(() => editor!.chain().focus().toggleHeading({ level: 1 }).run())"
            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors disabled:opacity-40 disabled:cursor-default"
            :class="isActive('heading', { level: 1 }) ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground'">
            <component :is="Heading1" class="size-4 shrink-0" />
            Heading 1
          </button>
          <button
            type="button" :disabled="!store.canEdit"
            @click="run(() => editor!.chain().focus().toggleHeading({ level: 2 }).run())"
            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors disabled:opacity-40 disabled:cursor-default"
            :class="isActive('heading', { level: 2 }) ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground'">
            <component :is="Heading2" class="size-4 shrink-0" />
            Heading 2
          </button>
          <button
            type="button" :disabled="!store.canEdit"
            @click="run(() => editor!.chain().focus().toggleHeading({ level: 3 }).run())"
            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors disabled:opacity-40 disabled:cursor-default"
            :class="isActive('heading', { level: 3 }) ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground'">
            <component :is="Heading3" class="size-4 shrink-0" />
            Heading 3
          </button>
          <button
            type="button" :disabled="!store.canEdit"
            @click="run(() => editor!.chain().focus().setParagraph().run())"
            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors disabled:opacity-40 disabled:cursor-default"
            :class="isActive('paragraph') ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground'">
            <component :is="Pilcrow" class="size-4 shrink-0" />
            Paragraph
          </button>
        </ToolbarDropdown>

        <!-- Lists -->
        <ToolbarDropdown
          :icon="List" title="Lists" :disabled="!store.canEdit"
          :active="isActive('bulletList') || isActive('orderedList') || isActive('taskList')">
          <button
            type="button" :disabled="!store.canEdit"
            @click="run(() => editor!.chain().focus().toggleBulletList().run())"
            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors disabled:opacity-40 disabled:cursor-default"
            :class="isActive('bulletList') ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground'">
            <component :is="List" class="size-4 shrink-0" />
            Bullet list
          </button>
          <button
            type="button" :disabled="!store.canEdit"
            @click="run(() => editor!.chain().focus().toggleOrderedList().run())"
            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors disabled:opacity-40 disabled:cursor-default"
            :class="isActive('orderedList') ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground'">
            <component :is="ListOrdered" class="size-4 shrink-0" />
            Numbered list
          </button>
          <button
            type="button" :disabled="!store.canEdit"
            @click="run(() => editor!.chain().focus().toggleTaskList().run())"
            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors disabled:opacity-40 disabled:cursor-default"
            :class="isActive('taskList') ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground'">
            <component :is="ListChecks" class="size-4 shrink-0" />
            To-do list
          </button>
        </ToolbarDropdown>

        <!-- Insert / blocks -->
        <ToolbarDropdown
          :icon="Plus" title="Insert" :disabled="!store.canEdit"
          :active="isActive('blockquote') || isActive('codeBlock')">
          <button
            type="button" :disabled="!store.canEdit"
            @click="run(() => editor!.chain().focus().toggleBlockquote().run())"
            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors disabled:opacity-40 disabled:cursor-default"
            :class="isActive('blockquote') ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground'">
            <component :is="Quote" class="size-4 shrink-0" />
            Quote
          </button>
          <button
            type="button" :disabled="!store.canEdit"
            @click="run(() => editor!.chain().focus().toggleCodeBlock().run())"
            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors disabled:opacity-40 disabled:cursor-default"
            :class="isActive('codeBlock') ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground'">
            <component :is="Code2" class="size-4 shrink-0" />
            Code block
          </button>
          <button
            type="button" :disabled="!store.canEdit"
            @click="run(() => editor!.chain().focus().setHorizontalRule().run())"
            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:cursor-default">
            <component :is="Minus" class="size-4 shrink-0" />
            Horizontal rule
          </button>
          <button
            type="button" :disabled="!store.canEdit"
            @click="run(() => editor!.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())"
            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:cursor-default">
            <component :is="TableIcon" class="size-4 shrink-0" />
            Insert table
          </button>
          <template v-if="inTable">
            <div class="my-1 h-px bg-border" />
            <button
              type="button" :disabled="!store.canEdit"
              @click="run(() => editor!.chain().focus().addRowAfter().run())"
              class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:cursor-default">
              <component :is="Rows3" class="size-4 shrink-0" />
              Add row
            </button>
            <button
              type="button" :disabled="!store.canEdit"
              @click="run(() => editor!.chain().focus().addColumnAfter().run())"
              class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:cursor-default">
              <component :is="Columns3" class="size-4 shrink-0" />
              Add column
            </button>
            <button
              type="button" :disabled="!store.canEdit"
              @click="run(() => editor!.chain().focus().deleteTable().run())"
              class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:cursor-default text-destructive">
              <component :is="Trash" class="size-4 shrink-0 text-destructive" />
              Delete table
            </button>
          </template>
        </ToolbarDropdown>

        <span class="tbar-sep" />

        <!-- Link -->
        <button
          type="button" title="Add / edit link" :disabled="!store.canEdit"
          @click="openLinkModal"
          class="tbtn" :class="isActive('link') ? 'tbtn-on' : 'tbtn-off'">
          <Link2 class="size-4" />
        </button>
        <button
          type="button" title="Remove link" :disabled="!store.canEdit || !isActive('link')"
          @click="unsetLink"
          class="tbtn tbtn-off">
          <Link2Off class="size-4" />
        </button>

        <span class="tbar-sep" />

        <!-- Text color -->
        <div class="relative">
          <button
            type="button" title="Text color" :disabled="!store.canEdit"
            @click="showColorMenu = !showColorMenu; showHighlightMenu = false"
            class="tbtn" :class="showColorMenu ? 'tbtn-on' : 'tbtn-off'">
            <Palette class="size-4" />
          </button>
          <div
            v-if="showColorMenu"
            class="absolute left-0 top-full z-50 mt-1 w-max rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-lg">
            <div class="grid grid-cols-4 gap-1">
              <button
                v-for="c in textColors" :key="c"
                type="button" :title="c"
                class="size-6 rounded-full border border-border transition-transform hover:scale-110"
                :style="{ background: c }"
                @click="setColor(c)" />
            </div>
            <button
              type="button"
              class="mt-2 w-full rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              @click="clearColor">
              Clear color
            </button>
          </div>
        </div>

        <!-- Highlight -->
        <div class="relative">
          <button
            type="button" title="Highlight" :disabled="!store.canEdit"
            @click="showHighlightMenu = !showHighlightMenu; showColorMenu = false"
            class="tbtn" :class="(showHighlightMenu || isActive('highlight')) ? 'tbtn-on' : 'tbtn-off'">
            <Highlighter class="size-4" />
          </button>
          <div
            v-if="showHighlightMenu"
            class="absolute left-0 top-full z-50 mt-1 w-max rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-lg">
            <div class="grid grid-cols-4 gap-1">
              <button
                v-for="c in highlightColors" :key="c"
                type="button" :title="c"
                class="size-6 rounded border border-border transition-transform hover:scale-110"
                :style="{ background: c }"
                @click="setHighlight(c)" />
            </div>
            <button
              type="button"
              class="mt-2 w-full rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              @click="clearHighlight">
              Clear highlight
            </button>
          </div>
        </div>

        <span class="tbar-sep" />

        <!-- Text align -->
        <ToolbarDropdown
          :icon="currentAlignIcon" title="Alignment" :disabled="!store.canEdit"
          :active="(editorTick, editor?.isActive({ textAlign: 'center' }) || editor?.isActive({ textAlign: 'right' }) || editor?.isActive({ textAlign: 'justify' }))">
          <button
            type="button" :disabled="!store.canEdit"
            @click="run(() => editor!.chain().focus().setTextAlign('left').run())"
            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors disabled:opacity-40 disabled:cursor-default"
            :class="(editorTick, editor?.isActive({ textAlign: 'left' })) ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground'">
            <component :is="AlignLeft" class="size-4 shrink-0" />
            Align left
          </button>
          <button
            type="button" :disabled="!store.canEdit"
            @click="run(() => editor!.chain().focus().setTextAlign('center').run())"
            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors disabled:opacity-40 disabled:cursor-default"
            :class="(editorTick, editor?.isActive({ textAlign: 'center' })) ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground'">
            <component :is="AlignCenter" class="size-4 shrink-0" />
            Align center
          </button>
          <button
            type="button" :disabled="!store.canEdit"
            @click="run(() => editor!.chain().focus().setTextAlign('right').run())"
            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors disabled:opacity-40 disabled:cursor-default"
            :class="(editorTick, editor?.isActive({ textAlign: 'right' })) ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground'">
            <component :is="AlignRight" class="size-4 shrink-0" />
            Align right
          </button>
          <button
            type="button" :disabled="!store.canEdit"
            @click="run(() => editor!.chain().focus().setTextAlign('justify').run())"
            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors disabled:opacity-40 disabled:cursor-default"
            :class="(editorTick, editor?.isActive({ textAlign: 'justify' })) ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground'">
            <component :is="AlignJustify" class="size-4 shrink-0" />
            Align justify
          </button>
        </ToolbarDropdown>

        <span class="tbar-sep" />

        <!-- Sub / super -->
        <button
          type="button" title="Subscript" :disabled="!store.canEdit"
          @click="run(() => editor!.chain().focus().toggleSubscript().run())"
          class="tbtn" :class="isActive('subscript') ? 'tbtn-on' : 'tbtn-off'">
          <SubscriptIcon class="size-4" />
        </button>
        <button
          type="button" title="Superscript" :disabled="!store.canEdit"
          @click="run(() => editor!.chain().focus().toggleSuperscript().run())"
          class="tbtn" :class="isActive('superscript') ? 'tbtn-on' : 'tbtn-off'">
          <SuperscriptIcon class="size-4" />
        </button>

        <span class="tbar-sep" />

        <!-- Clear formatting -->
        <button
          type="button" title="Clear formatting" :disabled="!store.canEdit"
          @click="clearFormatting"
          class="tbtn tbtn-off">
          <RemoveFormatting class="size-4" />
        </button>
      </div>
    </header>

    <!-- ── Body + side panels ──────────────────────────── -->
    <div class="flex min-h-0 flex-1 overflow-hidden">
      <!-- Editor body -->
      <main class="min-h-0 flex-1 overflow-y-auto scrollbar-thin" :class="!store.canEdit ? 'opacity-80' : ''">
        <div class="mx-auto max-w-3xl px-6 py-8 select-text">
          <!-- Selection bubble menu -->
          <BubbleMenu
            v-if="editor && store.canEdit"
            :editor="editor"
            :tippy-options="{ duration: 100 }"
            class="flex items-center gap-0.5 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg">
            <button
              type="button" title="Bold"
              @click="editor!.chain().focus().toggleBold().run()"
              class="tbtn size-7" :class="isActive('bold') ? 'tbtn-on' : 'tbtn-off'">
              <Bold class="size-4" />
            </button>
            <button
              type="button" title="Italic"
              @click="editor!.chain().focus().toggleItalic().run()"
              class="tbtn size-7" :class="isActive('italic') ? 'tbtn-on' : 'tbtn-off'">
              <Italic class="size-4" />
            </button>
            <button
              type="button" title="Underline"
              @click="editor!.chain().focus().toggleUnderline().run()"
              class="tbtn size-7" :class="isActive('underline') ? 'tbtn-on' : 'tbtn-off'">
              <UnderlineIcon class="size-4" />
            </button>
            <button
              type="button" title="Strikethrough"
              @click="editor!.chain().focus().toggleStrike().run()"
              class="tbtn size-7" :class="isActive('strike') ? 'tbtn-on' : 'tbtn-off'">
              <Strikethrough class="size-4" />
            </button>
            <button
              type="button" title="Inline code"
              @click="editor!.chain().focus().toggleCode().run()"
              class="tbtn size-7" :class="isActive('code') ? 'tbtn-on' : 'tbtn-off'">
              <Code class="size-4" />
            </button>
            <button
              type="button" title="Link"
              @click="openLinkModal"
              class="tbtn size-7" :class="isActive('link') ? 'tbtn-on' : 'tbtn-off'">
              <Link2 class="size-4" />
            </button>
            <button
              type="button" title="Highlight"
              @click="editor!.chain().focus().toggleHighlight().run()"
              class="tbtn size-7" :class="isActive('highlight') ? 'tbtn-on' : 'tbtn-off'">
              <Highlighter class="size-4" />
            </button>
          </BubbleMenu>

          <EditorContent :editor="editor" />
        </div>
      </main>

      <!-- AI Summary side panel -->
      <aside
        v-if="showSummaryPanel"
        class="w-80 shrink-0 border-l border-border bg-card flex flex-col h-full overflow-hidden transition-all duration-200">
        <div class="p-4 border-b border-border flex items-center justify-between shrink-0 bg-muted/30">
          <div class="flex items-center gap-2 font-semibold text-sm">
            <Sparkles class="size-4 text-primary animate-pulse" />
            Résumé par l'IA
          </div>
          <Button variant="ghost" size="icon" class="size-7" @click="showSummaryPanel = false">
            <X class="size-4" />
          </Button>
        </div>
        <div class="flex-1 overflow-y-auto p-4 space-y-4">
          <div class="prose prose-sm dark:prose-invert text-sm text-foreground/95 leading-relaxed space-y-2 whitespace-pre-line">
            {{ summaryText }}
          </div>
        </div>
      </aside>

      <!-- Comments side panel -->
      <CommentSection
        v-if="showCommentsPanel && store.currentNote"
        :note-id="store.currentNote.id"
      >
        <template #close-button>
          <Button variant="ghost" size="icon" class="size-7" @click="showCommentsPanel = false">
            <X class="size-4" />
          </Button>
        </template>
      </CommentSection>
    </div>

    <!-- Add / edit link modal (replaces window.prompt) -->
    <LinkModal
      v-model:open="linkModalOpen"
      :initial-url="linkInitialUrl"
      @submit="applyLink"
      @remove="removeLink"
    />

    <!-- Collaboration share modal (owner only) -->
    <ShareNoteModal v-model:open="showShares" />

    <!-- Version history modal -->
    <VersionHistoryModal v-model:open="showVersions" @restore="restore" />
  </div>
</template>

<style scoped>
:deep(.prose-editor) {
  min-height: 58vh;
  color: hsl(var(--foreground) / 0.9);
  font-size: 0.9375rem;
  line-height: 1.75;
}
:deep(.prose-editor h1) { font-size: 1.5rem; font-weight: 700; margin: 1rem 0 0.5rem; color: hsl(var(--foreground)); }
:deep(.prose-editor h2) { font-size: 1.25rem; font-weight: 600; margin: 0.875rem 0 0.375rem; color: hsl(var(--foreground)); }
:deep(.prose-editor h3) { font-size: 1.1rem; font-weight: 600; margin: 0.75rem 0 0.25rem; color: hsl(var(--foreground)); }
:deep(.prose-editor p) { margin: 0.25rem 0; }
:deep(.prose-editor strong) { font-weight: 700; }
:deep(.prose-editor em) { font-style: italic; }
:deep(.prose-editor s) { text-decoration: line-through; }
:deep(.prose-editor ul) { list-style: disc; padding-left: 1.5rem; margin: 0.5rem 0; }
:deep(.prose-editor ol) { list-style: decimal; padding-left: 1.5rem; margin: 0.5rem 0; }
:deep(.prose-editor li) { margin: 0.125rem 0; }
:deep(.prose-editor pre) { background: hsl(var(--muted)); color: hsl(var(--foreground)); border-radius: 0.5rem; padding: 1rem; font-size: 0.875rem; overflow-x: auto; margin: 0.75rem 0; }
:deep(.prose-editor code:not(pre code)) { background: hsl(var(--muted)); border-radius: 0.25rem; padding: 0.125rem 0.375rem; font-size: 0.875em; color: hsl(var(--primary)); }
:deep(.prose-editor blockquote) { border-left: 3px solid hsl(var(--border)); padding-left: 1rem; margin: 0.5rem 0; color: hsl(var(--muted-foreground)); }
:deep(.prose-editor p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: hsl(var(--muted-foreground));
  pointer-events: none;
  height: 0;
}
:deep(.remote-cursor-wrap) { pointer-events: none; }
:deep(.prose-editor[contenteditable="false"]) {
  cursor: default;
  caret-color: transparent;
}

/* ── Toolbar button helpers ───────────────────────────────────── */
.tbtn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.375rem;
  transition: background-color 0.15s, color 0.15s;
}
.tbtn:disabled { opacity: 0.3; cursor: default; }
.tbtn-on { background: hsl(var(--accent)); color: hsl(var(--accent-foreground)); }
.tbtn-off { color: hsl(var(--muted-foreground)); }
.tbtn-off:not(:disabled):hover { background: hsl(var(--accent)); color: hsl(var(--accent-foreground)); }
.tbar-sep {
  display: inline-block;
  width: 1px;
  height: 1rem;
  margin: 0 0.25rem;
  background: hsl(var(--border));
}

/* ── Links ────────────────────────────────────────────────────── */
:deep(.prose-editor a) {
  color: hsl(var(--primary));
  text-decoration: underline;
  cursor: pointer;
}

/* ── Underline & highlight marks ──────────────────────────────── */
:deep(.prose-editor u) { text-decoration: underline; }
/* Default (single-colour) highlight surface. Multicolour marks carry their
   own inline background-color via the style attribute and override this. */
:deep(.prose-editor mark) {
  background-color: hsl(var(--primary) / 0.25);
  color: inherit;
  border-radius: 2px;
  padding: 0 1px;
}

/* ── Task list ────────────────────────────────────────────────── */
:deep(.prose-editor ul[data-type="taskList"]) { list-style: none; padding: 0; }
:deep(.prose-editor ul[data-type="taskList"] li) {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
}
:deep(.prose-editor ul[data-type="taskList"] li > label) { margin-top: 0.15rem; }
:deep(.prose-editor ul[data-type="taskList"] input[type="checkbox"]) {
  accent-color: hsl(var(--primary));
  width: 1rem;
  height: 1rem;
  cursor: pointer;
}
:deep(.prose-editor ul[data-type="taskList"] li[data-checked="true"] > div) {
  color: hsl(var(--muted-foreground));
  text-decoration: line-through;
}

/* ── Tables ───────────────────────────────────────────────────── */
:deep(.prose-editor table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.75rem 0;
  overflow: hidden;
}
:deep(.prose-editor td),
:deep(.prose-editor th) {
  position: relative;
  border: 1px solid hsl(var(--border));
  padding: 0.4rem 0.6rem;
  vertical-align: top;
  min-width: 3rem;
}
:deep(.prose-editor th) {
  background: hsl(var(--muted));
  font-weight: 600;
  text-align: left;
}
:deep(.prose-editor .selectedCell:after) {
  background: hsl(var(--primary) / 0.12);
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
}
:deep(.prose-editor table .column-resize-handle) {
  background: hsl(var(--primary));
  width: 3px;
}

/* ── Subscript / superscript ──────────────────────────────────── */
:deep(.prose-editor sub) { vertical-align: sub; font-size: 0.8em; }
:deep(.prose-editor sup) { vertical-align: super; font-size: 0.8em; }

/* ── Horizontal rule ──────────────────────────────────────────── */
:deep(.prose-editor hr) {
  border: none;
  border-top: 1px solid hsl(var(--border));
  margin: 1rem 0;
}

/* ── Code block syntax highlighting (lowlight / hljs tokens) ───── */
/* The `pre` surface (muted background, rounded, padded, overflow-x) is
   already declared above; here we only reset the inner code + add tokens. */
:deep(.prose-editor pre code) {
  background: transparent;
  color: inherit;
  padding: 0;
  font-size: 0.875rem;
}
/* Saturated accent colours read fine on the muted surface in both themes —
   an accepted exception to the token rule for syntax tokens. */
:deep(.prose-editor .hljs-keyword),
:deep(.prose-editor .hljs-built_in) { color: #8b5cf6; }
:deep(.prose-editor .hljs-string),
:deep(.prose-editor .hljs-attr) { color: #10b981; }
:deep(.prose-editor .hljs-number),
:deep(.prose-editor .hljs-literal) { color: #f59e0b; }
:deep(.prose-editor .hljs-comment) { color: hsl(var(--muted-foreground)); font-style: italic; }
:deep(.prose-editor .hljs-title),
:deep(.prose-editor .hljs-function),
:deep(.prose-editor .hljs-name) { color: #3b82f6; }
:deep(.prose-editor .hljs-tag) { color: hsl(var(--muted-foreground)); }
:deep(.prose-editor .hljs-meta) { color: hsl(var(--muted-foreground)); }
:deep(.prose-editor .hljs-symbol),
:deep(.prose-editor .hljs-bullet) { color: #ec4899; }
</style>
