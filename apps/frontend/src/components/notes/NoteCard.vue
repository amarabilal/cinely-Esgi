<script setup lang="ts">
import { ref, computed } from 'vue';
import { FileText, GripVertical } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { Badge } from '@/components/ui/badge';
import { extractFirstImage, formatRelativeTime, stripHtml } from '@/utils/notes';
import { useNotesStore } from '@/stores/notes.store';
import type { Note } from '@/api/notes.api';

const props = defineProps<{
  note: Note;
  isActive?: boolean;
}>();

const emit = defineEmits<{
  select: [note: Note];
  dragstart: [event: DragEvent, note: Note];
}>();

const store = useNotesStore();

const isDragging = ref(false);
const isTagDropOver = ref(false);

const snippet = computed(() => stripHtml(props.note.content));
const imageUrl = computed(() => extractFirstImage(props.note.content));
const visibleTags = computed(() => (props.note.tags ?? []).slice(0, 3));
const hiddenTagCount = computed(() => Math.max((props.note.tags?.length ?? 0) - visibleTags.value.length, 0));

function onDragStart(event: DragEvent) {
  isDragging.value = true;
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', props.note.id);
    event.dataTransfer.effectAllowed = 'move';
  }
  document.body.classList.add('is-dragging-note');
  emit('dragstart', event, props.note);
}

function onDragEnd() {
  isDragging.value = false;
  document.body.classList.remove('is-dragging-note');
}

function hasTagDrag(event: DragEvent): boolean {
  return !!event.dataTransfer?.types.includes('application/x-cinely-tag');
}

function onTagDragOver(event: DragEvent) {
  if (!hasTagDrag(event)) return;
  event.preventDefault();
  isTagDropOver.value = true;
}

function onTagDragLeave(event: DragEvent) {
  const next = event.relatedTarget as Node | null;
  if (next && (event.currentTarget as Node).contains(next)) return;
  isTagDropOver.value = false;
}

async function onTagDrop(event: DragEvent) {
  isTagDropOver.value = false;
  if (!hasTagDrag(event)) return;

  let tag: { id: string; name: string };
  try {
    tag = JSON.parse(event.dataTransfer!.getData('application/x-cinely-tag'));
  } catch {
    toast.error('Failed to read tag data');
    return;
  }

  const alreadyHasTag = (props.note.tags ?? []).some(
    (t) => t.id === tag.id,
  );
  if (alreadyHasTag) return;

  try {
    await store.addTagToNote(props.note.id, tag.id);
    toast.success(`Tag #${tag.name} added`);
  } catch (error) {
    toast.error('Failed to add tag', {
      description: error instanceof Error ? error.message : undefined,
    });
  }
}
</script>

<template>
  <div
    :data-note-id="note.id"
    draggable="true"
    class="group relative flex w-full min-w-0 cursor-grab rounded-md border bg-card p-3 text-left text-card-foreground transition-all duration-150 hover:bg-accent/60 active:cursor-grabbing"
    :class="[
      isActive ? 'border-primary bg-accent' : 'border-border',
      isDragging ? 'scale-[0.98] opacity-40 ring-2 ring-primary' : '',
      isTagDropOver ? 'ring-2 ring-primary ring-offset-2 ring-offset-background bg-primary/5' : '',
    ]"
    role="button"
    tabindex="0"
    @click="emit('select', note)"
    @keydown.enter="emit('select', note)"
    @keydown.space.prevent="emit('select', note)"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
    @dragenter="onTagDragOver"
    @dragover.prevent="onTagDragOver"
    @dragleave="onTagDragLeave"
    @drop.prevent="onTagDrop"
  >
    <span
      class="absolute left-1 top-1/2 -translate-x-1 -translate-y-1/2 text-muted-foreground/0 transition-all duration-200 ease-out group-hover:translate-x-0 group-hover:text-muted-foreground/70"
      aria-hidden="true"
    >
      <GripVertical class="size-3.5" />
    </span>

    <div class="flex min-w-0 flex-1 items-start gap-3">
      <div class="transition-transform duration-200 ease-out group-hover:translate-x-3">
        <div
          v-if="imageUrl"
          class="size-11 shrink-0 rounded-md border bg-cover bg-center"
          :style="{ backgroundImage: `url(${imageUrl})` }"
        />
        <div v-else class="flex size-11 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
          <FileText class="size-4" />
        </div>
      </div>

      <div class="min-w-0 flex-1 space-y-1 transition-transform duration-200 ease-out group-hover:translate-x-3">
        <h3 class="truncate text-sm font-medium">
          {{ note.title || 'Untitled' }}
        </h3>
        <p class="line-clamp-2 text-xs leading-5 text-muted-foreground">
          {{ snippet || 'No additional text' }}
        </p>

        <div v-if="visibleTags.length > 0" class="flex flex-wrap gap-1 pt-1">
          <Badge v-for="tag in visibleTags" :key="tag.id" variant="secondary">
            {{ tag.name }}
          </Badge>
          <Badge v-if="hiddenTagCount > 0" variant="outline">
            +{{ hiddenTagCount }}
          </Badge>
        </div>
      </div>

      <span class="shrink-0 font-mono text-[11px] text-muted-foreground">
        {{ formatRelativeTime(note.updatedAt ?? note.createdAt) }}
      </span>
    </div>
  </div>
</template>
