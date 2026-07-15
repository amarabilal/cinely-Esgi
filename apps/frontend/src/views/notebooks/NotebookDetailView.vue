<script setup lang="ts">
import { ref, onMounted, nextTick, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useNotebooksStore } from '@/stores/notebooks.store';
import { useNotesStore } from '@/stores/notes.store';
import { notesApi } from '@/api/notes.api';
import { markdownToNoteHtml } from '@/utils/markdown';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Brain, Sparkles, BookOpen, ChevronLeft, Plus, Trash2, Send,
  FileText, HelpCircle, Book, Calendar, ScrollText, CheckSquare,
  Square, Eye, X, Check, Save, Mic, Layers, Presentation, Network,
  FileSpreadsheet, Table, ChevronRight, ArrowLeft, RotateCcw
} from 'lucide-vue-next';
import { toast } from 'vue-sonner';

const route = useRoute();
const router = useRouter();
const store = useNotebooksStore();
const notesStore = useNotesStore();

const notebookId = route.params.id as string;
const chatContainer = ref<HTMLElement | null>(null);

// Modal/Drawer visibility
const isAddSourceModalOpen = ref(false);
const isViewSourceDrawerOpen = ref(false);
const viewNoteTitle = ref('');
const viewNoteContent = ref('');
const isCitationModalOpen = ref(false);
const activeCitation = ref<{ noteTitle: string; snippet: string; noteId: string } | null>(null);
const activeCitationNumber = ref(0);

// Search and Form Inputs
const searchQuery = ref('');
const notebookQuery = ref('');
const selectedLibraryNoteIds = ref<string[]>([]);
const renamingNotebook = ref(false);
const editTitle = ref('');

// Studio Tab State: briefing, faq, study-guide, timeline, audio, flashcards, quiz, slide-deck, mind-map, report, data-table
const activeStudioTab = ref<'briefing' | 'faq' | 'study-guide' | 'timeline' | 'audio' | 'flashcards' | 'quiz' | 'slide-deck' | 'mind-map' | 'report' | 'data-table'>('briefing');
const generatedGuides = ref<Record<string, { title: string; content: string }>>({});
const previewGuideContent = ref('');
const previewGuideTitle = ref('');
const isGuideViewOpen = ref(false);

const tools = [
  { id: 'audio', title: 'Audio Overview', desc: 'Podcast script between two hosts', icon: Mic, color: 'bg-indigo-500/10 text-indigo-500' },
  { id: 'study-guide', title: 'Study Guide', desc: 'Terms definitions and practice evaluation', icon: Book, color: 'bg-emerald-500/10 text-emerald-500' },
  { id: 'quiz', title: 'Practice Quiz', desc: 'Validate knowledge with multiple-choice list', icon: CheckSquare, color: 'bg-amber-500/10 text-amber-500' },
  { id: 'flashcards', title: 'Flashcards', desc: 'Active recall term lists', icon: Layers, color: 'bg-rose-500/10 text-rose-500' },
  { id: 'faq', title: 'FAQs', desc: 'Important questions and detailed answers', icon: HelpCircle, color: 'bg-blue-500/10 text-blue-500' },
  { id: 'briefing', title: 'Briefing Document', desc: 'Unified briefing overview of materials', icon: FileText, color: 'bg-cyan-500/10 text-cyan-500' },
  { id: 'timeline', title: 'Timeline', desc: 'Chronological list index of event items', icon: Calendar, color: 'bg-orange-500/10 text-orange-500' },
  { id: 'slide-deck', title: 'Slide Deck', desc: 'Presentation slides with bullet talking points', icon: Presentation, color: 'bg-purple-500/10 text-purple-500' },
  { id: 'mind-map', title: 'Mind Map', desc: 'Concept network connection maps', icon: Network, color: 'bg-pink-500/10 text-pink-500' },
  { id: 'report', title: 'Reports', desc: 'Executive analysis report synthesis', icon: FileSpreadsheet, color: 'bg-teal-500/10 text-teal-500' },
  { id: 'data-table', title: 'Data Table', desc: 'Grid formatting statistics and facts', icon: Table, color: 'bg-violet-500/10 text-violet-500' },
] as const;

onMounted(async () => {
  try {
    await Promise.all([
      store.fetchNotebook(notebookId),
      store.fetchMessages(notebookId),
      notesStore.fetchNotes() // load user's general library notes for the add-source selector
    ]);
    editTitle.value = store.currentNotebook?.title || '';
    scrollToBottom();
  } catch (error) {
    toast.error('Failed to load notebook workspace');
    void router.push('/notebooks');
  }
});

// Watch current message list and auto-scroll to bottom
watch(() => store.messages.length, () => {
  nextTick(() => scrollToBottom());
});

function scrollToBottom() {
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  }
}

// Rename Notebook
async function handleRename() {
  const title = editTitle.value.trim();
  if (!title || title === store.currentNotebook?.title) {
    renamingNotebook.value = false;
    return;
  }
  try {
    await store.renameNotebook(notebookId, title);
    toast.success('Notebook renamed');
  } catch {
    toast.error('Failed to rename');
  } finally {
    renamingNotebook.value = false;
  }
}

// Add/Remove Sources
const availableLibraryNotes = computed(() => {
  if (!store.currentNotebook) return [];
  const currentIds = store.currentNotebook.notes.map(n => n.id);
  return notesStore.notes.filter(n => !currentIds.includes(n.id) && !n.isArchived);
});

async function handleAddSources() {
  if (selectedLibraryNoteIds.value.length === 0) return;
  try {
    for (const noteId of selectedLibraryNoteIds.value) {
      await store.addNoteToNotebook(notebookId, noteId);
    }
    toast.success('Sources added to notebook');
    isAddSourceModalOpen.value = false;
    selectedLibraryNoteIds.value = [];
  } catch {
    toast.error('Failed to add some sources');
  }
}

async function handleRemoveSource(noteId: string) {
  try {
    await store.removeNoteFromNotebook(notebookId, noteId);
    toast.success('Source removed');
  } catch {
    toast.error('Failed to remove source');
  }
}

// Preview Source Note
function openSourcePreview(note: { title: string; content: string }, highlightText?: string) {
  viewNoteTitle.value = note.title || 'Untitled note';
  
  let content = note.content || '<p class="text-muted-foreground italic">No content</p>';
  
  if (highlightText) {
    const cleanHighlight = highlightText.replace(/<[^>]*>/g, '').trim();
    if (cleanHighlight.length > 5) {
      // Split highlight query into words to allow formatting tags (like <strong>) in the source content
      const words = cleanHighlight
        .split(/\s+/)
        .map(w => w.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'))
        .filter(Boolean);
      
      if (words.length > 0) {
        // Construct regex mapping all words sequentially, allowing tags/spacing in between
        const pattern = words.join('(?:<[^>]+>|\\s)*');
        const regex = new RegExp(`(${pattern})`, 'gi');
        if (regex.test(content)) {
          content = content.replace(regex, `<mark id="citation-highlight" class="bg-yellow-300 dark:bg-yellow-800/80 text-foreground px-1 rounded shadow-xs font-semibold scroll-m-20 border-b-2 border-yellow-500">$1</mark>`);
        }
      }
    }
  }

  viewNoteContent.value = content;
  isViewSourceDrawerOpen.value = true;

  if (highlightText) {
    nextTick(() => {
      setTimeout(() => {
        const el = document.getElementById('citation-highlight');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 350); // Delay slightly to ensure slide-in drawer animation is initialized
    });
  }
}

// Send Chat Query
async function handleSendChat() {
  const query = notebookQuery.value.trim();
  if (!query || store.isChatting) return;
  
  notebookQuery.value = '';
  try {
    await store.sendMessage(notebookId, query);
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Failed to send query');
  }
}

// Send Suggested Prompt
function sendSuggestedPrompt(prompt: string) {
  notebookQuery.value = prompt;
  void handleSendChat();
}

// Generate Guide
async function handleGenerateGuide() {
  try {
    const data = await store.generateGuide(notebookId, activeStudioTab.value);
    generatedGuides.value[activeStudioTab.value] = data;
    previewGuideTitle.value = data.title;
    previewGuideContent.value = data.content;
    toast.success('Guide generated successfully');
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Failed to generate guide');
  }
}

async function clickTool(type: typeof tools[number]['id']) {
  activeStudioTab.value = type;
  isGuideViewOpen.value = true;
  
  if (generatedGuides.value[type]) {
    previewGuideTitle.value = generatedGuides.value[type].title;
    previewGuideContent.value = generatedGuides.value[type].content;
  } else {
    previewGuideTitle.value = '';
    previewGuideContent.value = '';
    await handleGenerateGuide();
  }
}

function exitGuideView() {
  isGuideViewOpen.value = false;
  previewGuideTitle.value = '';
  previewGuideContent.value = '';
}

// Save Guide as General Note in library and attach to Notebook
async function handleSaveGuideAsNote() {
  if (!previewGuideContent.value) return;
  try {
    // 1. Create note in library
    const { data: newNote } = await notesApi.create({
      title: previewGuideTitle.value,
      content: markdownToNoteHtml(previewGuideContent.value),
    });
    // 2. Add note as source to this notebook
    await store.addNoteToNotebook(notebookId, newNote.id);
    toast.success('Guide saved as a new source note');
  } catch {
    toast.error('Failed to save guide as note');
  }
}

// Helper to Strip HTML for note preview
function getNotePreview(htmlContent: string) {
  if (!htmlContent) return 'Empty content...';
  const clean = htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.length > 80 ? clean.slice(0, 80) + '...' : clean;
}

// Regex Markdown Parser with Citation highlight handlers
function parseMarkdown(text: string): string {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks
  html = html.replace(/```([\s\S]*?)```/g, '<pre class="bg-muted p-2 rounded font-mono text-xs overflow-x-auto my-1.5">$1</pre>');
  // Inline code
  html = html.replace(/`([^`\n]+)`/g, '<code class="bg-muted px-1 rounded font-mono text-xs">$1</code>');
  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>');
  // Italic
  html = html.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');

  // Headers (###, ##, #)
  html = html.replace(/^### (.*)$/gm, '<h4 class="text-xs font-bold text-foreground mt-3 mb-1">$1</h4>');
  html = html.replace(/^## (.*)$/gm, '<h3 class="text-sm font-bold text-foreground mt-4 mb-1 border-b pb-0.5">$1</h3>');
  html = html.replace(/^# (.*)$/gm, '<h2 class="text-base font-bold text-foreground mt-5 mb-1.5">$1</h2>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr class="my-4 border-border" />');

  // Bullet points
  html = html.replace(/^\s*[-*]\s+(.+)$/gm, '<li class="ml-4 list-disc">$1</li>');

  // Line breaks
  html = html.replace(/\n/g, '<br />');

  // Replace numeric citations [1], [2] with clickable button badges
  html = html.replace(/\[(\d+)\]/g, (match, num) => {
    return `<button type="button" class="inline-flex items-center justify-center rounded bg-primary/15 hover:bg-primary/25 border border-primary/25 text-primary font-mono font-bold text-[10px] h-4.5 min-w-4.5 px-1 mx-0.5 transition-colors cursor-pointer select-none" data-citation="${num}">${num}</button>`;
  });

  return html;
}

// Capture citation clicks from v-html content
function handleMessageClick(event: MouseEvent, message: any) {
  const target = event.target as HTMLElement;
  const citationIndexAttr = target.getAttribute('data-citation');
  if (citationIndexAttr) {
    event.preventDefault();
    const index = parseInt(citationIndexAttr);
    const citationList = JSON.parse(message.citations || '[]');
    const citation = citationList[index - 1];
    if (citation) {
      activeCitation.value = citation;
      activeCitationNumber.value = index;
      isCitationModalOpen.value = true;
    }
  }
}
</script>

<template>
  <div class="h-full flex flex-col bg-background text-foreground overflow-hidden">
    <!-- Header -->
    <header class="h-12 border-b border-border px-4 flex items-center justify-between shrink-0">
      <div class="flex items-center gap-3">
        <Button variant="ghost" size="icon" class="size-8" @click="router.push('/notebooks')" title="Back to dashboard">
          <ChevronLeft class="size-4" />
        </Button>
        <Separator orientation="vertical" class="h-4" />
        
        <!-- Editable title -->
        <div v-if="renamingNotebook" class="flex items-center gap-1.5">
          <input
            v-model="editTitle"
            type="text"
            class="h-8 rounded border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary w-56"
            @keydown.enter="handleRename"
            @keydown.esc="renamingNotebook = false"
            @blur="handleRename"
            v-focus
          />
          <Button size="icon" variant="ghost" class="size-8 text-primary" @click="handleRename">
            <Check class="size-4" />
          </Button>
        </div>
        <div v-else class="flex items-center gap-2 group">
          <h1 class="text-sm font-semibold tracking-tight text-foreground truncate max-w-[200px] md:max-w-xs">
            {{ store.currentNotebook?.title }}
          </h1>
          <button
            class="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity px-1.5 py-0.5 rounded border bg-muted/50"
            @click="renamingNotebook = true"
          >
            Rename
          </button>
        </div>
      </div>
      
      <!-- Source selection counter -->
      <div class="text-xs text-muted-foreground flex items-center gap-1.5">
        <Brain class="size-4 text-primary animate-pulse" />
        <span>{{ store.activeSourceIds.length }} / {{ store.currentNotebook?.notes?.length || 0 }} Active Sources</span>
      </div>
    </header>

    <!-- Loading Screen -->
    <div v-if="store.isLoading && !store.currentNotebook" class="flex-1 flex items-center justify-center">
      <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>

    <!-- Main Workspace Layout -->
    <div v-else-if="store.currentNotebook" class="flex-1 flex min-h-0 overflow-hidden divide-x divide-border">
      <!-- 1. LEFT PANEL: Source Management -->
      <aside class="w-72 shrink-0 flex flex-col bg-card/25 min-h-0 overflow-hidden">
        <div class="p-4 border-b border-border shrink-0 flex items-center justify-between">
          <h2 class="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <BookOpen class="size-4" />
            Sources
          </h2>
          <Button size="sm" variant="outline" class="gap-1 text-[11px] h-7 px-2.5" @click="isAddSourceModalOpen = true">
            <Plus class="size-3" />
            Add Source
          </Button>
        </div>

        <!-- Dynamic Toggles -->
        <div class="px-4 py-2 bg-muted/40 shrink-0 flex justify-between items-center text-[10px] font-semibold text-muted-foreground border-b">
          <button @click="store.selectAllSources" class="hover:text-foreground transition-colors">Select All</button>
          <span>•</span>
          <button @click="store.deselectAllSources" class="hover:text-foreground transition-colors">Select None</button>
        </div>

        <!-- Sources List -->
        <div class="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin">
          <div v-if="store.currentNotebook.notes.length === 0" class="text-center py-8 text-xs text-muted-foreground">
            No source documents added. Add notes from your library to start.
          </div>
          
          <Card
            v-for="note in store.currentNotebook.notes"
            :key="note.id"
            class="p-3 bg-card border border-border hover:border-primary/20 transition-all flex items-start gap-2.5 group relative"
            :class="!store.activeSourceIds.includes(note.id) ? 'opacity-60 bg-muted/30' : ''"
          >
            <!-- Checkbox toggler -->
            <button
              type="button"
              class="shrink-0 mt-0.5 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
              @click="store.toggleSourceActive(note.id)"
            >
              <CheckSquare v-if="store.activeSourceIds.includes(note.id)" class="size-4 text-primary" />
              <Square v-else class="size-4" />
            </button>

            <!-- Card text -->
            <div class="min-w-0 flex-1 cursor-pointer" @click="openSourcePreview(note)">
              <h3 class="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                {{ note.title || 'Untitled Source' }}
              </h3>
              <p class="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                {{ getNotePreview(note.content) }}
              </p>
            </div>

            <!-- Remove from Notebook button -->
            <Button
              variant="ghost"
              size="icon"
              class="size-6 text-muted-foreground hover:text-destructive absolute right-1 top-1 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove source"
              @click.stop="handleRemoveSource(note.id)"
            >
              <Trash2 class="size-3" />
            </Button>
          </Card>
        </div>
      </aside>

      <!-- 2. CENTER PANEL: Chat Workspace -->
      <section class="flex-1 flex flex-col bg-background min-h-0 overflow-hidden">
        <!-- Messages Area -->
        <div
          ref="chatContainer"
          class="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin"
        >
          <!-- Welcome instructions -->
          <div v-if="store.messages.length === 0" class="max-w-lg mx-auto text-center py-12">
            <div class="rounded-full bg-primary/10 p-3.5 inline-block text-primary mb-4">
              <Brain class="size-7 animate-pulse" />
            </div>
            <h3 class="text-base font-semibold text-foreground">Chat with your sources</h3>
            <p class="text-sm text-muted-foreground mt-1 mb-8">
              Ask questions about the active sources. Your assistant will answer relying only on the document data and cite specific segments.
            </p>
            
            <div class="grid grid-cols-1 gap-2.5">
              <Button
                variant="outline"
                class="justify-start text-left text-xs h-auto p-3 text-muted-foreground hover:text-foreground border-border hover:bg-accent/10"
                @click="sendSuggestedPrompt('Summarize the main points across these documents.')"
              >
                💡 "Summarize the main points across these documents."
              </Button>
              <Button
                variant="outline"
                class="justify-start text-left text-xs h-auto p-3 text-muted-foreground hover:text-foreground border-border hover:bg-accent/10"
                @click="sendSuggestedPrompt('Find key terms and generate a bulleted definition list.')"
              >
                💡 "Find key terms and generate a bulleted definition list."
              </Button>
              <Button
                variant="outline"
                class="justify-start text-left text-xs h-auto p-3 text-muted-foreground hover:text-foreground border-border hover:bg-accent/10"
                @click="sendSuggestedPrompt('Help me outline the connections between Note A and Note B.')"
              >
                💡 "Help me outline the connections between my notes."
              </Button>
            </div>
          </div>

          <!-- Active Message Bubbles -->
          <div
            v-for="msg in store.messages"
            :key="msg.id"
            class="flex gap-3 max-w-2xl"
            :class="msg.role === 'user' ? 'ml-auto justify-end flex-row-reverse' : ''"
          >
            <!-- Avatar -->
            <div class="size-7 rounded-full shrink-0 flex items-center justify-center border text-[10px]"
                 :class="msg.role === 'user' ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground'">
              <Sparkles v-if="msg.role === 'assistant'" class="size-3.5 text-primary" />
              <span v-else>U</span>
            </div>

            <!-- Bubble Body -->
            <div class="space-y-1 max-w-[85%]">
              <div
                class="rounded-xl px-3.5 py-2.5 text-sm leading-relaxed"
                :class="msg.role === 'user' ? 'bg-primary/10 border border-primary/10 text-foreground' : 'bg-muted/30 border border-border text-foreground'"
              >
                <!-- Markdown Render block -->
                <div
                  class="prose prose-sm dark:prose-invert max-w-none text-xs space-y-1.5"
                  v-html="parseMarkdown(msg.content)"
                  @click="handleMessageClick($event, msg)"
                ></div>
              </div>
              
              <!-- Citations count badge -->
              <span v-if="msg.role === 'assistant' && msg.citations" class="text-[9px] text-muted-foreground flex items-center gap-1 pl-1">
                <ScrollText class="size-3" />
                Click citation numbers to view corresponding excerpts.
              </span>
            </div>
          </div>

          <!-- Typing Indicator -->
          <div v-if="store.isChatting" class="flex gap-3 max-w-2xl">
            <div class="size-7 rounded-full shrink-0 flex items-center justify-center border bg-muted text-muted-foreground">
              <Sparkles class="size-3.5 text-primary animate-spin" />
            </div>
            <div class="rounded-xl px-4 py-3 bg-muted/30 border border-border text-sm flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce"></span>
              <span class="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.2s]"></span>
              <span class="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.4s]"></span>
            </div>
          </div>
        </div>

        <!-- Chat Input Form -->
        <div class="p-4 border-t border-border bg-card/10 shrink-0">
          <form @submit.prevent="handleSendChat" class="flex gap-2">
            <input
              v-model="notebookQuery"
              type="text"
              required
              placeholder="Ask a question about your source documents..."
              class="flex-1 h-10 rounded-md border bg-background px-3 text-xs outline-none transition-all placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-transparent"
              :disabled="store.isChatting || store.activeSourceIds.length === 0"
            />
            <Button
              type="submit"
              size="icon"
              class="h-10 w-10 shrink-0 rounded-md"
              :disabled="!notebookQuery.trim() || store.isChatting || store.activeSourceIds.length === 0"
            >
              <Send class="size-4" />
            </Button>
          </form>
          <div class="mt-2 text-[10px] text-muted-foreground text-center">
            <span v-if="store.activeSourceIds.length === 0" class="text-destructive font-semibold">
              ⚠️ Select at least one active source document on the left to activate chat.
            </span>
            <span v-else>
              AI answers are constrained to the selected active documents.
            </span>
          </div>
        </div>
      </section>

      <!-- 3. RIGHT PANEL: Studio Guide Tool -->
      <aside class="w-80 shrink-0 flex flex-col bg-card/25 min-h-0 overflow-hidden border-l border-border">
        <!-- Panel Title -->
        <div class="p-4 border-b border-border shrink-0 flex items-center justify-between">
          <h2 class="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Sparkles class="size-4 text-primary" />
            Studio
          </h2>
          <!-- Exit Preview Button -->
          <Button
            v-if="isGuideViewOpen"
            size="sm"
            variant="ghost"
            class="h-7 px-2 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
            @click="exitGuideView"
          >
            <ArrowLeft class="size-3" />
            Back to Tools
          </Button>
        </div>

        <!-- Studio Content -->
        <div class="flex-1 flex flex-col min-h-0 overflow-hidden">
          <!-- Main Tools Grid if not previewing -->
          <div v-if="!isGuideViewOpen" class="flex-1 overflow-y-auto p-4 scrollbar-thin space-y-2.5">
            <button
              v-for="tool in tools"
              :key="tool.id"
              type="button"
              class="w-full flex items-center justify-between p-3 bg-card border rounded-xl hover:bg-accent/15 hover:border-primary/20 hover:shadow-xs transition-all text-left group cursor-pointer relative overflow-hidden"
              @click="clickTool(tool.id)"
              :disabled="store.activeSourceIds.length === 0"
              :class="store.activeSourceIds.length === 0 ? 'opacity-50 cursor-not-allowed' : ''"
            >
              <div class="flex items-center gap-3 min-w-0">
                <div class="rounded-lg p-2.5 shrink-0" :class="tool.color">
                  <component :is="tool.icon" class="size-4.5" />
                </div>
                <div class="min-w-0">
                  <h3 class="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors flex items-center gap-1.5">
                    {{ tool.title }}
                    <span v-if="['slide-deck', 'mind-map'].includes(tool.id)" class="text-[8px] font-bold px-1 py-0.5 rounded bg-amber-500/15 text-amber-500 uppercase tracking-wide">
                      BETA
                    </span>
                  </h3>
                  <p class="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[170px] leading-relaxed">
                    {{ tool.desc }}
                  </p>
                </div>
              </div>
              <ChevronRight class="size-4 text-muted-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
            <div v-if="store.activeSourceIds.length === 0" class="mt-4 text-[10px] text-destructive font-semibold text-center bg-destructive/10 p-2.5 rounded-lg border border-destructive/15">
              ⚠️ Select at least one active source document to enable Studio Tools.
            </div>
          </div>

          <!-- Loader State -->
          <div v-else-if="store.isGenerating" class="flex-1 flex flex-col items-center justify-center p-8 space-y-3.5">
            <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p class="text-xs text-muted-foreground font-semibold animate-pulse text-center">
              Analyzing sources and generating {{ activeStudioTab.replace('-', ' ') }}...
            </p>
          </div>

          <!-- Preview Content Pane -->
          <div v-else class="flex-1 flex flex-col min-h-0">
            <div class="p-4 flex-1 flex flex-col min-h-0 space-y-4">
              <!-- Top action buttons -->
              <div class="flex items-center justify-between border-b pb-3 shrink-0">
                <div class="min-w-0">
                  <h3 class="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">Preview</h3>
                  <h4 class="text-xs font-bold text-foreground mt-1 truncate max-w-[120px]">{{ previewGuideTitle }}</h4>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" class="h-7 px-2 text-[10px] gap-1" title="Regenerate guide" @click="handleGenerateGuide">
                    <RotateCcw class="size-3" />
                    Regenerate
                  </Button>
                  <Button size="sm" variant="default" class="h-7 px-2 text-[10px] gap-1 text-primary-foreground" @click="handleSaveGuideAsNote">
                    <Save class="size-3" />
                    Save Note
                  </Button>
                </div>
              </div>

              <!-- Markdown HTML View block -->
              <div class="flex-1 bg-card/45 border rounded-xl p-4 overflow-y-auto scrollbar-thin select-text min-h-[300px]">
                <div class="prose prose-xs dark:prose-invert max-w-none text-xs text-foreground/90 space-y-2.5" v-html="markdownToNoteHtml(previewGuideContent)"></div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <!-- Modals & Drawers -->

    <!-- Add Source Modal -->
    <div v-if="isAddSourceModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs px-4" @click.self="isAddSourceModalOpen = false">
      <div class="w-full max-w-lg bg-card border rounded-xl shadow-xl p-5 relative flex flex-col max-h-[80vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <button @click="isAddSourceModalOpen = false" class="absolute right-4 top-4 text-muted-foreground hover:text-foreground hover:bg-muted p-1 rounded-md transition-colors">
          <X class="size-4" />
        </button>

        <h2 class="text-sm font-semibold text-foreground flex items-center gap-2">
          <BookOpen class="size-5 text-primary" />
          Import Notes to Notebook Sources
        </h2>
        <p class="text-xs text-muted-foreground mt-1 mb-4">
          Select notes from your personal library to add as context inside this notebook.
        </p>

        <!-- Search library input -->
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search library notes..."
          class="w-full h-9 rounded-md border bg-background px-3 text-xs outline-none transition-all placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-transparent mb-3.5"
        />

        <!-- Notes lists -->
        <div class="flex-1 overflow-y-auto border rounded-lg divide-y bg-background max-h-[350px] scrollbar-thin">
          <div v-if="availableLibraryNotes.length === 0" class="p-6 text-center text-xs text-muted-foreground">
            No library notes available to add.
          </div>
          
          <label
            v-for="note in availableLibraryNotes.filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.content.toLowerCase().includes(searchQuery.toLowerCase()))"
            :key="note.id"
            class="flex items-start gap-3 p-3 hover:bg-muted/40 cursor-pointer transition-colors"
          >
            <input
              type="checkbox"
              :value="note.id"
              v-model="selectedLibraryNoteIds"
              class="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <div class="min-w-0 flex-1">
              <span class="text-xs font-semibold text-foreground truncate block">{{ note.title || 'Untitled Note' }}</span>
              <span class="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{{ getNotePreview(note.content) }}</span>
            </div>
          </label>
        </div>

        <div class="flex justify-end gap-2 mt-4 pt-3 border-t shrink-0">
          <Button size="sm" variant="outline" @click="isAddSourceModalOpen = false">Cancel</Button>
          <Button size="sm" :disabled="selectedLibraryNoteIds.length === 0" @click="handleAddSources">
            Add Selected ({{ selectedLibraryNoteIds.length }})
          </Button>
        </div>
      </div>
    </div>

    <!-- View Source Detail Drawer -->
    <div v-if="isViewSourceDrawerOpen" class="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs" @click.self="isViewSourceDrawerOpen = false">
      <div class="w-full max-w-xl h-full bg-card border-l flex flex-col relative overflow-hidden animate-in slide-in-from-right duration-200">
        <header class="h-14 border-b px-4 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-2">
            <FileText class="size-4 text-primary" />
            <h2 class="text-sm font-semibold truncate max-w-[400px] text-foreground">{{ viewNoteTitle }}</h2>
          </div>
          <button @click="isViewSourceDrawerOpen = false" class="text-muted-foreground hover:text-foreground hover:bg-muted p-1.5 rounded-md transition-colors">
            <X class="size-4.5" />
          </button>
        </header>

        <!-- Content Area -->
        <div class="flex-1 overflow-y-auto p-6 text-sm leading-relaxed scrollbar-thin select-text">
          <!-- TipTap Vue notes content is saved as standard HTML inside note.content -->
          <div class="prose prose-sm dark:prose-invert max-w-none" v-html="viewNoteContent"></div>
        </div>
      </div>
    </div>

    <!-- View Citation Snippet Modal -->
    <div v-if="isCitationModalOpen && activeCitation" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs px-4" @click.self="isCitationModalOpen = false">
      <div class="w-full max-w-md bg-card border rounded-xl shadow-xl p-5 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <button @click="isCitationModalOpen = false" class="absolute right-4 top-4 text-muted-foreground hover:text-foreground hover:bg-muted p-1 rounded-md transition-colors">
          <X class="size-4" />
        </button>

        <h3 class="text-xs font-mono font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
          <Sparkles class="size-3.5" />
          Citation Context [{{ activeCitationNumber }}]
        </h3>
        
        <div class="mt-3.5 bg-muted/30 border border-border p-3.5 rounded-lg text-xs leading-relaxed italic text-foreground/90 select-text">
          "{{ activeCitation.snippet }}"
        </div>

        <div class="mt-4 pt-3 border-t flex items-center justify-between text-[11px]">
          <span class="text-muted-foreground">
            Source note: <strong class="text-foreground font-semibold">{{ activeCitation.noteTitle }}</strong>
          </span>
          <Button
            size="sm"
            variant="outline"
            class="text-[10px] h-7 gap-1 px-2"
            @click="isCitationModalOpen = false; openSourcePreview({ title: activeCitation!.noteTitle, content: notesStore.notes.find(n => n.id === activeCitation!.noteId)?.content || '<p>Full content not loaded in local workspace.</p>' }, activeCitation!.snippet)"
          >
            <Eye class="size-3" />
            Open Source Note
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* Clean styles for custom text-sizing tags in custom markdown parser output */
.prose-xs {
  font-size: 0.75rem;
  line-height: 1.5;
}
.prose-xs br {
  margin: 0.25rem 0;
}
.prose-xs strong {
  color: hsl(var(--foreground));
}
.prose-xs li {
  margin-top: 0.2rem;
  margin-bottom: 0.2rem;
}
.prose-xs h2, .prose-xs h3, .prose-xs h4 {
  font-weight: 700;
  color: hsl(var(--foreground));
}
.prose-xs hr {
  border-top-width: 1px;
  border-color: hsl(var(--border));
  margin: 1rem 0;
}
/* Style markdown tables inside the preview */
.prose-xs table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.75rem 0;
  font-size: 0.7rem;
}
.prose-xs th, .prose-xs td {
  border: 1px solid hsl(var(--border));
  padding: 0.4rem 0.5rem;
  text-align: left;
}
.prose-xs th {
  background-color: hsl(var(--muted)/40);
  font-weight: 600;
}
</style>
