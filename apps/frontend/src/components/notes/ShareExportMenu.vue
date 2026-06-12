<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { FileText, Hash, Printer, Share2, Type, Users, Calendar, Mail, Download } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { Button } from '@/components/ui/button';
import { stripHtml } from '@/utils/notes';
import GoogleCalendarModal from './GoogleCalendarModal.vue';
import EmailNoteModal from './EmailNoteModal.vue';

const props = defineProps<{
  noteId: string;
  title: string;
  contentHtml: string;
  owner?: boolean;
}>();

const emit = defineEmits<{ (e: 'share-people'): void }>();

const isOpen = ref(false);
const rootRef = ref<HTMLElement | null>(null);

// navigator.share is only available in secure contexts / supported browsers.
const canSystemShare = computed(
  () => typeof navigator !== 'undefined' && typeof navigator.share === 'function',
);

const isGoogleConnected = ref(false);
const showCalendarModal = ref(false);
const showEmailModal = ref(false);
const exportingDrive = ref(false);
const syncingCalendar = ref(false);

async function checkGoogleStatus() {
  const token = localStorage.getItem('accessToken');
  if (!token) return;
  try {
    const res = await fetch('/api/google/status', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      isGoogleConnected.value = data.connected;
    }
  } catch (err) {
    console.error('Failed to check Google status', err);
  }
}

async function handleToggle() {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    await checkGoogleStatus();
  }
}

function close() {
  isOpen.value = false;
}

function sharePeople() {
  close();
  emit('share-people');
}

const plainText = computed(() => {
  const body = stripHtml(props.contentHtml);
  return props.title ? `${props.title}\n\n${body}` : body;
});

/** Minimal, robust HTML -> Markdown for note content. */
function htmlToMarkdown(html: string): string {
  if (!html) return '';

  let md = html;

  // Headings.
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_m, inner) => `\n# ${inner}\n`);
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_m, inner) => `\n## ${inner}\n`);
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_m, inner) => `\n### ${inner}\n`);

  // Inline emphasis.
  md = md.replace(/<\s*(?:strong|b)[^>]*>([\s\S]*?)<\/\s*(?:strong|b)\s*>/gi, (_m, inner) => `**${inner}**`);
  md = md.replace(/<\s*(?:em|i)[^>]*>([\s\S]*?)<\/\s*(?:em|i)\s*>/gi, (_m, inner) => `*${inner}*`);

  // List items -> "- " bullets.
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m, inner) => `- ${inner}\n`);

  // Line breaks.
  md = md.replace(/<br\s*\/?>/gi, '\n');

  // Paragraphs -> blank line separated blocks.
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_m, inner) => `\n${inner}\n`);

  // Strip any remaining tags.
  md = md.replace(/<[^>]+>/g, '');

  // Decode the few entities the steps above can leave behind.
  md = md
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Collapse excess blank lines and trim.
  md = md.replace(/\n{3,}/g, '\n\n').trim();

  return props.title ? `# ${props.title}\n\n${md}` : md;
}

async function copyText() {
  close();
  try {
    await navigator.clipboard.writeText(plainText.value);
    toast.success('Copied as text');
  } catch (error) {
    toast.error('Failed to copy', {
      description: error instanceof Error ? error.message : undefined,
    });
  }
}

async function copyMarkdown() {
  close();
  try {
    await navigator.clipboard.writeText(htmlToMarkdown(props.contentHtml));
    toast.success('Copied as Markdown');
  } catch (error) {
    toast.error('Failed to copy', {
      description: error instanceof Error ? error.message : undefined,
    });
  }
}

function downloadMarkdown() {
  close();
  try {
    const markdown = htmlToMarkdown(props.contentHtml);
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${props.title || 'Untitled'}.md`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded as Markdown');
  } catch (error: any) {
    toast.error('Failed to download Markdown', { description: error.message });
  }
}

function printNote() {
  close();
  const printWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (!printWindow) {
    toast.error('Unable to open print view', {
      description: 'Your browser may have blocked the pop-up.',
    });
    return;
  }
  const safeTitle = (props.title || 'Note')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  printWindow.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>${safeTitle}</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, sans-serif; line-height: 1.6; color: #111; max-width: 42rem; margin: 2rem auto; padding: 0 1.5rem; }
      h1 { font-size: 1.6rem; margin-bottom: 1rem; }
      img { max-width: 100%; height: auto; }
    </style>
  </head>
  <body>
    <h1>${safeTitle}</h1>
    ${props.contentHtml}
  </body>
</html>`);
  printWindow.document.close();
  printWindow.focus();
  // Give the new document a tick to lay out before invoking print.
  setTimeout(() => printWindow.print(), 250);
}

async function exportToGoogleDrive() {
  close();
  exportingDrive.value = true;
  const toastId = toast.loading('Exporting to Google Drive...');
  try {
    const token = localStorage.getItem('accessToken');
    const res = await fetch(`/api/google/export-drive/${props.noteId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (res.ok && data.webViewLink) {
      toast.success('Note exported successfully to Google Drive!', {
        id: toastId,
        action: {
          label: 'Open Doc',
          onClick: () => window.open(data.webViewLink, '_blank')
        }
      });
    } else {
      toast.error(data.message || 'Failed to export to Google Drive', { id: toastId });
    }
  } catch (error: any) {
    toast.error('Failed to export to Google Drive', {
      id: toastId,
      description: error.message
    });
  } finally {
    exportingDrive.value = false;
  }
}

async function syncToGoogleCalendar(start: string, end: string) {
  showCalendarModal.value = false;
  syncingCalendar.value = true;
  const toastId = toast.loading('Syncing with Google Calendar...');
  try {
    const token = localStorage.getItem('accessToken');
    const res = await fetch(`/api/google/sync-calendar/${props.noteId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ start, end })
    });
    const data = await res.json();
    if (res.ok && data.htmlLink) {
      toast.success('Event synced to Google Calendar!', {
        id: toastId,
        action: {
          label: 'Open Event',
          onClick: () => window.open(data.htmlLink, '_blank')
        }
      });
    } else {
      toast.error(data.message || 'Failed to sync to Google Calendar', { id: toastId });
    }
  } catch (error: any) {
    toast.error('Failed to sync to Google Calendar', {
      id: toastId,
      description: error.message
    });
  } finally {
    syncingCalendar.value = false;
  }
}

async function systemShare() {
  close();
  if (!canSystemShare.value) return;
  try {
    await navigator.share({ title: props.title || 'Note', text: plainText.value });
  } catch (error) {
    // The user cancelling the share sheet rejects with AbortError — not an error to surface.
    if (error instanceof DOMException && error.name === 'AbortError') return;
    toast.error('Failed to share', {
      description: error instanceof Error ? error.message : undefined,
    });
  }
}

function onPointerDown(event: PointerEvent) {
  if (!isOpen.value) return;
  const target = event.target as Node | null;
  if (rootRef.value && target && !rootRef.value.contains(target)) {
    close();
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isOpen.value) {
    event.preventDefault();
    close();
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown);
  document.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div ref="rootRef" class="relative">
    <Button
      variant="ghost"
      size="icon"
      aria-label="Share or export"
      :aria-expanded="isOpen"
      aria-haspopup="menu"
      @click="handleToggle"
    >
      <Share2 class="size-4" />
    </Button>

    <Transition name="menu">
    <div
      v-if="isOpen"
      role="menu"
      class="menu-panel absolute right-0 z-50 mt-1 w-56 overflow-hidden rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-lg"
    >
      <div class="px-2 pb-1 pt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Share &amp; export</div>
      <button
        v-if="owner"
        type="button"
        role="menuitem"
        class="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        @click="sharePeople"
      >
        <Users class="size-4 shrink-0 text-muted-foreground" />
        Share with people…
      </button>
      <div v-if="owner" class="my-1 h-px bg-border" />
      <button
        type="button"
        role="menuitem"
        class="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        @click="copyText"
      >
        <Type class="size-4 shrink-0 text-muted-foreground" />
        Copy as text
      </button>
      <button
        type="button"
        role="menuitem"
        class="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        @click="copyMarkdown"
      >
        <Hash class="size-4 shrink-0 text-muted-foreground" />
        Copy as Markdown
      </button>
      <button
        type="button"
        role="menuitem"
        class="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        @click="downloadMarkdown"
      >
        <Download class="size-4 shrink-0 text-muted-foreground" />
        Download Markdown (.md)
      </button>
      <button
        type="button"
        role="menuitem"
        class="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        @click="printNote"
      >
        <Printer class="size-4 shrink-0 text-muted-foreground" />
        Print / Save as PDF
      </button>
      <button
        v-if="canSystemShare"
        type="button"
        role="menuitem"
        class="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        @click="systemShare"
      >
        <FileText class="size-4 shrink-0 text-muted-foreground" />
        System share
      </button>

      <!-- Google Services options -->
      <template v-if="isGoogleConnected">
        <div class="my-1 h-px bg-border" />
        <div class="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Google services</div>
        <button
          type="button"
          role="menuitem"
          :disabled="exportingDrive"
          class="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
          @click="exportToGoogleDrive"
        >
          <FileText class="size-4 shrink-0 text-muted-foreground" />
          Export to Google Drive
        </button>
        <button
          type="button"
          role="menuitem"
          :disabled="syncingCalendar"
          class="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
          @click="close(); showCalendarModal = true"
        >
          <Calendar class="size-4 shrink-0 text-muted-foreground" />
          Add to Google Calendar
        </button>
        <button
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          @click="close(); showEmailModal = true"
        >
          <Mail class="size-4 shrink-0 text-muted-foreground" />
          Email this note (Gmail)
        </button>
      </template>
    </div>
    </Transition>
    
    <GoogleCalendarModal v-model:open="showCalendarModal" @submit="syncToGoogleCalendar" />
    <EmailNoteModal v-model:open="showEmailModal" :note-title="title" :note-content-html="contentHtml" />
  </div>
</template>

<style scoped>
.menu-enter-active,
.menu-leave-active {
  transition:
    opacity 0.14s ease,
    transform 0.14s ease;
  transform-origin: top right;
}

.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}
</style>
