<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { FileText, Hash, Printer, Share2, Type } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { Button } from '@/components/ui/button';
import { stripHtml } from '@/utils/notes';

const props = defineProps<{
  title: string;
  contentHtml: string;
}>();

const isOpen = ref(false);
const rootRef = ref<HTMLElement | null>(null);

// navigator.share is only available in secure contexts / supported browsers.
const canSystemShare = computed(
  () => typeof navigator !== 'undefined' && typeof navigator.share === 'function',
);

function toggle() {
  isOpen.value = !isOpen.value;
}

function close() {
  isOpen.value = false;
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
      @click="toggle"
    >
      <Share2 class="size-4" />
    </Button>

    <Transition name="menu">
    <div
      v-if="isOpen"
      role="menu"
      class="menu-panel absolute right-0 z-50 mt-1 w-52 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
    >
      <button
        type="button"
        role="menuitem"
        class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
        @click="copyText"
      >
        <Type class="size-4 shrink-0 text-muted-foreground" />
        Copy as text
      </button>
      <button
        type="button"
        role="menuitem"
        class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
        @click="copyMarkdown"
      >
        <Hash class="size-4 shrink-0 text-muted-foreground" />
        Copy as Markdown
      </button>
      <button
        type="button"
        role="menuitem"
        class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
        @click="printNote"
      >
        <Printer class="size-4 shrink-0 text-muted-foreground" />
        Print / Save as PDF
      </button>
      <button
        v-if="canSystemShare"
        type="button"
        role="menuitem"
        class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
        @click="systemShare"
      >
        <FileText class="size-4 shrink-0 text-muted-foreground" />
        System share
      </button>
    </div>
    </Transition>
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
