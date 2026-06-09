<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { Plus, Tag as TagIcon } from 'lucide-vue-next';
import { useNotesStore } from '@/stores/notes.store';
import type { Tag } from '@/api/tags.api';

const props = withDefaults(defineProps<{
  existingTagIds: string[];
  placeholder?: string;
}>(), {
  placeholder: 'Add a tag…',
});

const emit = defineEmits<{
  select: [tagId: string];
  create: [name: string];
}>();

const store = useNotesStore();

const query = ref('');
const isOpen = ref(false);
const activeIndex = ref(0);
const inputRef = ref<HTMLInputElement | null>(null);

const trimmedQuery = computed(() => query.value.trim());
const lowerQuery = computed(() => trimmedQuery.value.toLowerCase());

// Tags not already on the note, filtered by the typed query.
const filteredTags = computed<Tag[]>(() => {
  const excluded = new Set(props.existingTagIds);
  return store.tags.filter((tag) => {
    if (excluded.has(tag.id)) return false;
    if (!lowerQuery.value) return true;
    return tag.name.toLowerCase().includes(lowerQuery.value);
  });
});

// Whether the typed query exactly matches an already-existing tag name.
const hasExactMatch = computed(() => {
  if (!lowerQuery.value) return false;
  return store.tags.some((tag) => tag.name.toLowerCase() === lowerQuery.value);
});

const showCreateOption = computed(() => trimmedQuery.value.length > 0 && !hasExactMatch.value);

// Combined option count (existing tags + optional create row) for keyboard nav.
const optionCount = computed(() => filteredTags.value.length + (showCreateOption.value ? 1 : 0));

const createOptionIndex = computed(() => (showCreateOption.value ? filteredTags.value.length : -1));

watch([filteredTags, showCreateOption], () => {
  if (activeIndex.value >= optionCount.value) {
    activeIndex.value = Math.max(0, optionCount.value - 1);
  }
});

function openDropdown() {
  isOpen.value = true;
  activeIndex.value = 0;
}

function closeDropdown() {
  isOpen.value = false;
  activeIndex.value = 0;
}

function reset() {
  query.value = '';
  closeDropdown();
}

function commitSelect(tag: Tag) {
  emit('select', tag.id);
  reset();
  void nextTick(() => inputRef.value?.focus());
}

function commitCreate() {
  const name = trimmedQuery.value;
  if (!name) return;
  emit('create', name);
  reset();
  void nextTick(() => inputRef.value?.focus());
}

// Commit whichever option is currently highlighted.
function commitActive() {
  if (optionCount.value === 0) return;
  if (activeIndex.value === createOptionIndex.value) {
    commitCreate();
    return;
  }
  const tag = filteredTags.value[activeIndex.value];
  if (tag) commitSelect(tag);
}

function moveActive(delta: number) {
  if (optionCount.value === 0) return;
  const next = (activeIndex.value + delta + optionCount.value) % optionCount.value;
  activeIndex.value = next;
}

function onKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      if (!isOpen.value) openDropdown();
      else moveActive(1);
      break;
    case 'ArrowUp':
      event.preventDefault();
      if (!isOpen.value) openDropdown();
      else moveActive(-1);
      break;
    case 'Enter':
      event.preventDefault();
      commitActive();
      break;
    case ',':
      // Comma commits the highlighted option (or create) without inserting the comma.
      event.preventDefault();
      commitActive();
      break;
    case 'Escape':
      if (isOpen.value) {
        event.preventDefault();
        reset();
      }
      break;
    default:
      break;
  }
}

function onBlur() {
  // Delay so a click on an option registers before the dropdown closes.
  setTimeout(() => closeDropdown(), 120);
}
</script>

<template>
  <div class="relative">
    <div class="relative">
      <TagIcon class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref="inputRef"
        v-model="query"
        type="text"
        role="combobox"
        :aria-expanded="isOpen"
        aria-autocomplete="list"
        :placeholder="placeholder"
        class="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        @focus="openDropdown"
        @keydown="onKeydown"
        @blur="onBlur"
      >
    </div>

    <div
      v-if="isOpen && optionCount > 0"
      class="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg scrollbar-thin"
    >
      <button
        v-for="(tag, index) in filteredTags"
        :key="tag.id"
        type="button"
        class="flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors"
        :class="index === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground'"
        @mousedown.prevent="commitSelect(tag)"
        @mousemove="activeIndex = index"
      >
        <span
          class="size-3 shrink-0 rounded-full border border-border"
          :style="{ background: tag.color }"
        />
        <span class="truncate">{{ tag.name }}</span>
      </button>

      <button
        v-if="showCreateOption"
        type="button"
        class="flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors"
        :class="createOptionIndex === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground'"
        @mousedown.prevent="commitCreate"
        @mousemove="activeIndex = createOptionIndex"
      >
        <Plus class="size-4 shrink-0 text-muted-foreground" />
        <span class="truncate">Create &ldquo;{{ trimmedQuery }}&rdquo;</span>
      </button>
    </div>
  </div>
</template>
