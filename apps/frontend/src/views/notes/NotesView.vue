<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useEditor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useAuthStore } from '@/stores/auth.store';
import { useNotesStore } from '@/stores/notes.store';
import { useNoteSync } from '@/composables/useNoteSync';
import { RemoteCursorExtension, setCursors } from '@/composables/RemoteCursorExtension';
import type { NoteQuery } from '@/api/notes.api';

const router = useRouter();
const auth = useAuthStore();
const store = useNotesStore();

const fmtButtons = computed(() => [
  { label: 'B', cmd: () => editor.value?.chain().focus().toggleBold().run(),   active: editor.value?.isActive('bold') },
  { label: 'I', cmd: () => editor.value?.chain().focus().toggleItalic().run(), active: editor.value?.isActive('italic') },
  { label: 'S', cmd: () => editor.value?.chain().focus().toggleStrike().run(), active: editor.value?.isActive('strike') },
]);
const noteSync = useNoteSync();

const activeFilter = ref<string>('all');
const activeFolderId = ref<string | null>(null);
const activeTagId = ref<string | null>(null);
const titleInput = ref('');
const saveTimer = ref<ReturnType<typeof setTimeout> | null>(null);
const showVersions = ref(false);
const showShares = ref(false);
const showNewFolder = ref(false);
const newFolderName = ref('');
const showNewTag = ref(false);
const newTagName = ref('');
const newTagColor = ref('#6366f1');
const searchQuery = ref('');
const searchTimer = ref<ReturnType<typeof setTimeout> | null>(null);

// Share panel
const shareEmail = ref('');
const sharePermission = ref<'READ' | 'WRITE'>('READ');
const shareError = ref('');
const shareLoading = ref(false);

// Prevent re-broadcasting remote updates
let isApplyingRemote = false;

// ── Tiptap editor ──────────────────────────────────────────────
const editor = useEditor({
  extensions: [
    StarterKit,
    Placeholder.configure({ placeholder: 'Start writing…' }),
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

onBeforeUnmount(() => {
  noteSync.leaveNote();
  editor.value?.destroy();
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
  }
});

const unsubscribeTags = noteSync.onTagsUpdated((payload) => {
  store.applyRemoteTagsUpdate(payload.noteId, payload.tags);
});

const unsubscribeDeleted = noteSync.onNoteDeleted((payload) => {
  if (store.currentNote?.id === payload.noteId && store.currentPermission !== 'OWNER') {
    noteSync.leaveNote();
    store.selectNote(null);
  }
  store.applyNoteDeleted(payload.noteId);
});

const unsubscribeArchived = noteSync.onNoteArchived((payload) => {
  if (store.currentNote?.id === payload.noteId && store.currentPermission !== 'OWNER') {
    noteSync.leaveNote();
    store.selectNote(null);
  }
  store.applyNoteArchived(payload.noteId);
});

onBeforeUnmount(() => {
  unsubscribeUpdate();
  unsubscribePermission();
  unsubscribeRevoked();
  unsubscribeTags();
  unsubscribeDeleted();
  unsubscribeArchived();
});

// ── Filter / query ─────────────────────────────────────────────
const query = computed((): NoteQuery => {
  if (activeFilter.value === 'favorites') return { favorite: true };
  if (activeFilter.value === 'archived') return { archived: true };
  if (activeFolderId.value) return { folderId: activeFolderId.value };
  if (activeTagId.value) return { tagId: activeTagId.value };
  return {};
});

const displayedNotes = computed(() => {
  if (activeFilter.value === 'shared') return store.sharedNotes;
  return store.searchResults !== null ? store.searchResults : store.notes;
});

onMounted(async () => {
  if (!auth.user) await auth.fetchMe().catch(() => auth.clearAuth());
  await store.loadAll();
  await store.fetchSharedNotes();
  if (auth.accessToken) noteSync.connect(auth.accessToken);
});

watch(query, async (q) => {
  if (activeFilter.value === 'shared') return;
  store.selectNote(null);
  noteSync.leaveNote();
  await store.fetchNotes(q);
}, { deep: true });

// ── Navigation ─────────────────────────────────────────────────
function setFilter(f: string) {
  activeFilter.value = f;
  activeFolderId.value = null;
  activeTagId.value = null;
  store.clearSearch();
  searchQuery.value = '';
  if (f === 'shared') store.fetchSharedNotes();
}

function setFolderFilter(id: string) {
  activeFilter.value = 'folder';
  activeFolderId.value = id;
  activeTagId.value = null;
}

function setTagFilter(id: string) {
  activeFilter.value = 'tag';
  activeFolderId.value = null;
  activeTagId.value = id;
}

// ── Note selection ─────────────────────────────────────────────
async function selectNote(note: any) {
  noteSync.leaveNote();
  store.selectNote(note);
  titleInput.value = note.title;
  showVersions.value = false;
  showShares.value = false;
  editor.value?.commands.setContent(note.content || '');
  editor.value?.setEditable(store.canEdit);

  if (auth.accessToken) {
    await noteSync.joinNote(auth.accessToken, note.id);
  }
}

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

// ── Search ─────────────────────────────────────────────────────
function onSearchInput() {
  if (searchTimer.value) clearTimeout(searchTimer.value);
  searchTimer.value = setTimeout(async () => {
    if (searchQuery.value.trim()) {
      await store.search(searchQuery.value.trim());
    } else {
      store.clearSearch();
    }
  }, 300);
}

// ── Actions ────────────────────────────────────────────────────
async function createNote() {
  noteSync.leaveNote();
  const note = await store.createNote();
  titleInput.value = '';
  editor.value?.commands.setContent('');
  editor.value?.setEditable(true);
  if (auth.accessToken) await noteSync.joinNote(auth.accessToken, note.id);
}

async function addFolder() {
  if (!newFolderName.value.trim()) return;
  await store.createFolder(newFolderName.value.trim());
  newFolderName.value = '';
  showNewFolder.value = false;
}

async function addTag() {
  if (!newTagName.value.trim()) return;
  await store.createTag(newTagName.value.trim(), newTagColor.value);
  newTagName.value = '';
  showNewTag.value = false;
}

async function toggleVersions() {
  showVersions.value = !showVersions.value;
  showShares.value = false;
  if (showVersions.value && store.currentNote) {
    await store.fetchVersions(store.currentNote.id);
  }
}

async function toggleShares() {
  showShares.value = !showShares.value;
  showVersions.value = false;
  if (showShares.value && store.currentNote) {
    await store.fetchShares(store.currentNote.id);
  }
}

async function restore(versionId: string) {
  if (!store.currentNote) return;
  await store.restoreVersion(store.currentNote.id, versionId);
  titleInput.value = store.currentNote?.title ?? '';
  editor.value?.commands.setContent(store.currentNote?.content ?? '');
  showVersions.value = false;
}

async function addShare() {
  if (!shareEmail.value.trim() || !store.currentNote) return;
  shareError.value = '';
  shareLoading.value = true;
  try {
    await store.shareNote(store.currentNote.id, shareEmail.value.trim(), sharePermission.value);
    shareEmail.value = '';
  } catch (e: any) {
    shareError.value = e.response?.data?.message || 'Failed to share note.';
  } finally {
    shareLoading.value = false;
  }
}

async function handlePermissionChange(shareId: string, newPermission: 'READ' | 'WRITE') {
  if (!store.currentNote) return;
  await store.updateShare(store.currentNote.id, shareId, newPermission);
}

async function handleLogout() {
  noteSync.disconnect();
  await auth.logout();
  router.push('/login');
}

// ── Helpers ────────────────────────────────────────────────────
function notePreview(content: string) {
  return content.replace(/<[^>]*>/g, '').slice(0, 110) || 'No content';
}

function relativeDate(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

const sidebarLabel = computed(() => {
  if (activeFilter.value === 'shared') return 'Shared with me';
  if (activeFilter.value === 'folder') return store.folders.find((f) => f.id === activeFolderId.value)?.name ?? 'Folder';
  if (activeFilter.value === 'tag') return store.tags.find((t) => t.id === activeTagId.value)?.name ?? 'Tag';
  return activeFilter.value === 'all' ? 'All Notes' : activeFilter.value.charAt(0).toUpperCase() + activeFilter.value.slice(1);
});
</script>

<template>
  <div class="flex h-screen bg-gray-100 overflow-hidden select-none">

    <!-- ── Sidebar ─────────────────────────────────────── -->
    <aside class="w-56 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
      <div class="p-3 border-b border-gray-200">
        <button @click="createNote"
          class="w-full bg-primary-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-primary-700 transition-colors">
          + New Note
        </button>
      </div>

      <nav class="p-2 space-y-0.5 border-b border-gray-100 pb-3">
        <button v-for="f in [['all','All Notes'],['favorites','★ Favorites'],['archived','Archived'],['shared','Shared with me']]"
          :key="f[0]"
          @click="setFilter(f[0])"
          class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
          :class="activeFilter === f[0] && !activeFolderId && !activeTagId ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-600 hover:bg-gray-50'">
          {{ f[1] }}
        </button>
      </nav>

      <!-- Folders -->
      <div class="px-2 pt-3">
        <div class="flex items-center justify-between px-3 mb-1">
          <span class="text-xs font-semibold text-gray-400 uppercase tracking-wide">Folders</span>
          <button @click="showNewFolder = !showNewFolder" class="text-gray-400 hover:text-gray-600">+</button>
        </div>
        <div v-if="showNewFolder" class="px-3 mb-2 flex gap-1">
          <input v-model="newFolderName" @keyup.enter="addFolder" placeholder="Name"
            class="flex-1 text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500" />
          <button @click="addFolder" class="text-xs bg-primary-600 text-white px-2 rounded">Add</button>
        </div>
        <button v-for="folder in store.folders" :key="folder.id" @click="setFolderFilter(folder.id)"
          class="w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors truncate"
          :class="activeFolderId === folder.id ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-600 hover:bg-gray-50'">
          📁 {{ folder.name }}
        </button>
      </div>

      <!-- Tags -->
      <div class="px-2 pt-3 flex-1 overflow-y-auto">
        <div class="flex items-center justify-between px-3 mb-1">
          <span class="text-xs font-semibold text-gray-400 uppercase tracking-wide">Tags</span>
          <button @click="showNewTag = !showNewTag" class="text-gray-400 hover:text-gray-600">+</button>
        </div>
        <div v-if="showNewTag" class="px-3 mb-2 space-y-1">
          <input v-model="newTagName" @keyup.enter="addTag" placeholder="Tag name"
            class="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500" />
          <div class="flex gap-1 items-center">
            <input type="color" v-model="newTagColor" class="w-6 h-6 rounded cursor-pointer border-0" />
            <button @click="addTag" class="text-xs bg-primary-600 text-white px-2 py-1 rounded">Add</button>
          </div>
        </div>
        <button v-for="tag in store.tags" :key="tag.id" @click="setTagFilter(tag.id)"
          class="w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-2"
          :class="activeTagId === tag.id ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-600 hover:bg-gray-50'">
          <span class="w-2 h-2 rounded-full flex-shrink-0" :style="{ background: tag.color }"></span>
          <span class="truncate">{{ tag.name }}</span>
        </button>
      </div>

      <!-- User -->
      <div class="p-3 border-t border-gray-200">
        <div class="text-xs font-medium text-gray-700 truncate">{{ auth.user?.firstName }} {{ auth.user?.lastName }}</div>
        <div class="flex gap-3 mt-1">
          <router-link to="/dashboard" class="text-xs text-gray-400 hover:text-primary-500 transition-colors">Dashboard</router-link>
          <router-link to="/settings" class="text-xs text-gray-400 hover:text-primary-500 transition-colors">Settings</router-link>
          <button @click="handleLogout" class="text-xs text-gray-400 hover:text-red-500 transition-colors">Sign out</button>
        </div>
      </div>
    </aside>

    <!-- ── Notes list ──────────────────────────────────── -->
    <div class="w-72 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
      <div class="p-3 border-b border-gray-200">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-semibold text-gray-800">{{ sidebarLabel }}</span>
          <span class="text-xs text-gray-400">{{ displayedNotes.length }}</span>
        </div>
        <input v-if="activeFilter !== 'shared'" v-model="searchQuery" @input="onSearchInput" placeholder="Search…"
          class="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50" />
      </div>

      <div class="flex-1 overflow-y-auto">
        <div v-if="displayedNotes.length === 0" class="p-4 text-sm text-gray-400 text-center mt-8">
          {{ searchQuery ? 'No results.' : activeFilter === 'shared' ? 'No notes shared with you.' : 'No notes yet.' }}
        </div>
        <button v-for="note in displayedNotes" :key="note.id" @click="selectNote(note)"
          class="w-full text-left p-3 border-b border-gray-100 transition-colors hover:bg-gray-50"
          :class="store.currentNote?.id === note.id ? 'bg-primary-50 border-l-2 border-l-primary-500' : ''">
          <div class="flex items-center justify-between mb-0.5">
            <span class="text-sm font-medium text-gray-900 truncate">{{ note.title || 'Untitled' }}</span>
            <div class="flex items-center gap-1 flex-shrink-0 ml-1">
              <span v-if="note.sharedPermission" class="text-xs text-gray-400">
                {{ note.sharedPermission === 'WRITE' ? '✏️' : '👁️' }}
              </span>
              <span v-if="note.isFavorite" class="text-yellow-400 text-xs">★</span>
            </div>
          </div>
          <p class="text-xs text-gray-400 line-clamp-2 mb-1">{{ notePreview(note.content) }}</p>
          <div class="flex items-center gap-1 flex-wrap">
            <span v-for="tag in note.tags" :key="tag.id"
              class="inline-flex text-xs px-1.5 py-0.5 rounded-full text-white"
              :style="{ background: tag.color }">{{ tag.name }}</span>
            <span class="text-xs text-gray-300 ml-auto">{{ relativeDate(note.updatedAt) }}</span>
          </div>
        </button>
      </div>
    </div>

    <!-- ── Editor ──────────────────────────────────────── -->
    <main class="flex-1 flex overflow-hidden">
      <div v-if="!store.currentNote" class="flex-1 flex items-center justify-center flex-col gap-2 text-gray-300">
        <span class="text-5xl">📝</span>
        <span class="text-sm">Select a note or create a new one</span>
      </div>

      <div v-else class="flex-1 flex flex-col overflow-hidden">
        <!-- Toolbar -->
        <div class="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white gap-3 flex-wrap">
          <!-- Format buttons -->
          <div class="flex items-center gap-0.5">
            <button
              v-for="fmt in fmtButtons" :key="fmt.label"
              @click="store.canEdit && fmt.cmd()"
              :disabled="!store.canEdit"
              class="px-2 py-1 rounded text-sm font-medium transition-colors disabled:opacity-30"
              :class="fmt.active ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100'">
              <span :class="fmt.label === 'I' ? 'italic' : fmt.label === 'S' ? 'line-through' : 'font-bold'">{{ fmt.label }}</span>
            </button>
            <div class="w-px h-4 bg-gray-200 mx-1"></div>
            <button
              v-for="lvl in ([1, 2, 3] as const)" :key="lvl"
              @click="store.canEdit && editor?.chain().focus().toggleHeading({ level: lvl }).run()"
              :disabled="!store.canEdit"
              class="px-2 py-1 rounded text-xs font-medium transition-colors disabled:opacity-30"
              :class="editor?.isActive('heading', { level: lvl }) ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100'">
              H{{ lvl }}
            </button>
            <div class="w-px h-4 bg-gray-200 mx-1"></div>
            <button @click="store.canEdit && editor?.chain().focus().toggleBulletList().run()" :disabled="!store.canEdit"
              class="px-2 py-1 rounded text-xs transition-colors disabled:opacity-30"
              :class="editor?.isActive('bulletList') ? 'bg-gray-200' : 'text-gray-500 hover:bg-gray-100'">• List</button>
            <button @click="store.canEdit && editor?.chain().focus().toggleOrderedList().run()" :disabled="!store.canEdit"
              class="px-2 py-1 rounded text-xs transition-colors disabled:opacity-30"
              :class="editor?.isActive('orderedList') ? 'bg-gray-200' : 'text-gray-500 hover:bg-gray-100'">1. List</button>
            <button @click="store.canEdit && editor?.chain().focus().toggleCodeBlock().run()" :disabled="!store.canEdit"
              class="px-2 py-1 rounded text-xs font-mono transition-colors disabled:opacity-30"
              :class="editor?.isActive('codeBlock') ? 'bg-gray-200' : 'text-gray-500 hover:bg-gray-100'">{`</button>
          </div>

          <!-- Right actions -->
          <div class="flex items-center gap-2">
            <!-- Live presence avatars -->
            <div v-if="noteSync.presentUsers.value.length" class="flex items-center -space-x-1 mr-1">
              <div v-for="u in noteSync.presentUsers.value" :key="u.userId"
                :title="u.userName"
                class="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-white"
                :style="{ background: u.color }">
                {{ u.userName.charAt(0).toUpperCase() }}
              </div>
            </div>

            <!-- Read-only badge -->
            <span v-if="store.currentPermission === 'READ'"
              class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
              Read only
            </span>
            <span v-else-if="store.currentPermission === 'WRITE'"
              class="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
              Can edit
            </span>

            <!-- Tags (owner only) -->
            <template v-if="store.currentPermission === 'OWNER'">
              <div class="flex items-center gap-1 flex-wrap">
                <span v-for="tag in store.currentNote.tags" :key="tag.id"
                  class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full text-white"
                  :style="{ background: tag.color }">
                  {{ tag.name }}
                  <button @click="store.removeTagFromNote(store.currentNote!.id, tag.id)" class="hover:opacity-70 leading-none">×</button>
                </span>
                <select v-if="store.tags.length"
                  @change="(e) => { const v = (e.target as HTMLSelectElement).value; if (v) { store.addTagToNote(store.currentNote!.id, v); (e.target as HTMLSelectElement).value = ''; }}"
                  class="text-xs border border-gray-200 rounded px-1 py-0.5 text-gray-500 focus:outline-none">
                  <option value="">+ Tag</option>
                  <option v-for="tag in store.tags.filter(t => !store.currentNote?.tags.some(nt => nt.id === t.id))"
                    :key="tag.id" :value="tag.id">{{ tag.name }}</option>
                </select>
              </div>
            </template>

            <button @click="toggleVersions"
              class="text-xs px-2 py-1 rounded border transition-colors"
              :class="showVersions ? 'border-primary-300 text-primary-600 bg-primary-50' : 'border-gray-200 text-gray-500 hover:border-gray-300'">
              History
            </button>

            <button v-if="store.currentPermission === 'OWNER'" @click="toggleShares"
              class="text-xs px-2 py-1 rounded border transition-colors"
              :class="showShares ? 'border-blue-300 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-500 hover:border-gray-300'">
              Share
            </button>

            <template v-if="store.currentPermission === 'OWNER'">
              <button @click="store.toggleFavorite(store.currentNote!.id)"
                class="text-lg transition-colors"
                :class="store.currentNote.isFavorite ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-300'">★</button>
              <button @click="store.toggleArchive(store.currentNote!.id)"
                class="text-xs px-2 py-1 rounded border border-gray-200 text-gray-400 hover:border-gray-300 transition-colors">
                {{ store.currentNote.isArchived ? 'Unarchive' : 'Archive' }}
              </button>
              <span class="text-xs text-gray-300">{{ store.isSaving ? 'Saving…' : 'Saved' }}</span>
              <button @click="store.deleteNote(store.currentNote!.id)" class="text-xs text-red-400 hover:text-red-600 transition-colors">Delete</button>
            </template>
          </div>
        </div>

        <!-- Title + Editor -->
        <div class="flex flex-1 overflow-hidden">
          <div class="flex-1 flex flex-col overflow-hidden">
            <input v-model="titleInput"
              @input="onTitleInput"
              :disabled="!store.canEdit"
              placeholder="Note title"
              class="w-full px-6 pt-5 pb-2 text-2xl font-bold text-gray-900 placeholder-gray-300 focus:outline-none bg-white select-text disabled:cursor-default disabled:opacity-70" />

            <div class="flex-1 overflow-y-auto px-6 pb-6 bg-white select-text"
              :class="!store.canEdit ? 'opacity-80' : ''">
              <EditorContent :editor="editor" class="h-full" />
            </div>
          </div>

          <!-- Versions panel -->
          <div v-if="showVersions"
            class="w-64 border-l border-gray-200 bg-gray-50 flex flex-col flex-shrink-0">
            <div class="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <span class="text-sm font-semibold text-gray-700">Version History</span>
              <button @click="showVersions = false" class="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
            </div>
            <div class="flex-1 overflow-y-auto p-3 space-y-2">
              <div v-if="store.versions.length === 0" class="text-xs text-gray-400 text-center mt-4">
                No saved versions yet.
              </div>
              <div v-for="v in store.versions" :key="v.id"
                class="bg-white rounded-lg border border-gray-200 p-3">
                <div class="text-xs font-medium text-gray-700 mb-0.5">v{{ v.versionNumber }}</div>
                <div class="text-xs text-gray-400 mb-2">{{ formatDate(v.createdAt) }}</div>
                <div class="text-xs text-gray-500 line-clamp-2 mb-2">{{ v.title || 'Untitled' }}</div>
                <button v-if="store.currentPermission === 'OWNER'" @click="restore(v.id)"
                  class="w-full text-xs bg-primary-600 text-white rounded py-1 hover:bg-primary-700 transition-colors">
                  Restore
                </button>
              </div>
            </div>
          </div>

          <!-- Share panel -->
          <div v-if="showShares"
            class="w-72 border-l border-gray-200 bg-gray-50 flex flex-col flex-shrink-0">
            <div class="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <span class="text-sm font-semibold text-gray-700">Share Note</span>
              <button @click="showShares = false" class="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
            </div>

            <!-- Add share form -->
            <div class="p-3 border-b border-gray-200 space-y-2">
              <input v-model="shareEmail" type="email" placeholder="Email address"
                class="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500" />
              <select v-model="sharePermission"
                class="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500">
                <option value="READ">Read only</option>
                <option value="WRITE">Can edit</option>
              </select>
              <p v-if="shareError" class="text-xs text-red-600">{{ shareError }}</p>
              <button @click="addShare" :disabled="shareLoading || !shareEmail.trim()"
                class="w-full text-xs bg-primary-600 text-white rounded py-1.5 hover:bg-primary-700 disabled:opacity-50 transition-colors">
                {{ shareLoading ? 'Sharing…' : 'Share' }}
              </button>
            </div>

            <!-- Existing shares -->
            <div class="flex-1 overflow-y-auto p-3 space-y-2">
              <div v-if="store.shares.length === 0" class="text-xs text-gray-400 text-center mt-4">
                Not shared with anyone yet.
              </div>
              <div v-for="s in store.shares" :key="s.id"
                class="bg-white rounded-lg border border-gray-200 p-3">
                <div class="text-xs font-medium text-gray-800 truncate">{{ s.sharedWith.email }}</div>
                <div class="text-xs text-gray-400 mb-2">{{ s.sharedWith.firstName }} {{ s.sharedWith.lastName }}</div>
                <div class="flex items-center justify-between gap-2">
                  <!-- Inline permission select — saves on change -->
                  <select :value="s.permission"
                    @change="handlePermissionChange(s.id, ($event.target as HTMLSelectElement).value as 'READ' | 'WRITE')"
                    class="text-xs border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary-500">
                    <option value="READ">Read only</option>
                    <option value="WRITE">Can edit</option>
                  </select>
                  <button @click="store.revokeShare(store.currentNote!.id, s.id)"
                    class="text-xs text-red-400 hover:text-red-600 transition-colors whitespace-nowrap">
                    Revoke
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
:deep(.prose-editor) {
  min-height: 100%;
  color: #374151;
  font-size: 0.9375rem;
  line-height: 1.75;
}
:deep(.prose-editor h1) { font-size: 1.5rem; font-weight: 700; margin: 1rem 0 0.5rem; color: #111827; }
:deep(.prose-editor h2) { font-size: 1.25rem; font-weight: 600; margin: 0.875rem 0 0.375rem; color: #111827; }
:deep(.prose-editor h3) { font-size: 1.1rem; font-weight: 600; margin: 0.75rem 0 0.25rem; color: #111827; }
:deep(.prose-editor p) { margin: 0.25rem 0; }
:deep(.prose-editor strong) { font-weight: 700; }
:deep(.prose-editor em) { font-style: italic; }
:deep(.prose-editor s) { text-decoration: line-through; }
:deep(.prose-editor ul) { list-style: disc; padding-left: 1.5rem; margin: 0.5rem 0; }
:deep(.prose-editor ol) { list-style: decimal; padding-left: 1.5rem; margin: 0.5rem 0; }
:deep(.prose-editor li) { margin: 0.125rem 0; }
:deep(.prose-editor pre) { background: #1f2937; color: #f9fafb; border-radius: 0.5rem; padding: 1rem; font-size: 0.875rem; overflow-x: auto; margin: 0.75rem 0; }
:deep(.prose-editor code:not(pre code)) { background: #f3f4f6; border-radius: 0.25rem; padding: 0.125rem 0.375rem; font-size: 0.875em; color: #e11d48; }
:deep(.prose-editor blockquote) { border-left: 3px solid #d1d5db; padding-left: 1rem; margin: 0.5rem 0; color: #6b7280; }
:deep(.prose-editor p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: #9ca3af;
  pointer-events: none;
  height: 0;
}
:deep(.remote-cursor-wrap) { pointer-events: none; }
:deep(.prose-editor[contenteditable="false"]) {
  cursor: default;
  caret-color: transparent;
}
</style>
