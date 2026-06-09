<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { Check, ChevronDown, FolderOpen } from 'lucide-vue-next';
import type { Folder } from '@/api/folders.api';

const props = defineProps<{
  modelValue: string | null;
  folders: Folder[];
}>();

const emit = defineEmits<{
  'update:modelValue': [folderId: string | null];
}>();

const isOpen = ref(false);
const rootRef = ref<HTMLElement | null>(null);

const currentFolder = computed<Folder | null>(
  () => props.folders.find((f) => f.id === props.modelValue) ?? null,
);

const label = computed(() => currentFolder.value?.name ?? 'No folder');

function toggle() {
  isOpen.value = !isOpen.value;
}

function close() {
  isOpen.value = false;
}

function select(folderId: string | null) {
  emit('update:modelValue', folderId);
  close();
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
    <button
      type="button"
      :aria-expanded="isOpen"
      aria-haspopup="listbox"
      class="inline-flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      @click="toggle"
    >
      <span class="flex min-w-0 items-center gap-2">
        <FolderOpen class="size-4 shrink-0 text-muted-foreground" />
        <span class="truncate" :class="currentFolder ? '' : 'text-muted-foreground'">
          {{ label }}
        </span>
      </span>
      <ChevronDown
        class="size-4 shrink-0 text-muted-foreground transition-transform duration-150"
        :class="isOpen ? 'rotate-180' : ''"
      />
    </button>

    <Transition name="menu">
    <div
      v-if="isOpen"
      role="listbox"
      class="menu-panel absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg scrollbar-thin"
    >
      <button
        type="button"
        role="option"
        :aria-selected="modelValue === null"
        class="flex w-full min-w-0 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
        @click="select(null)"
      >
        <span class="truncate text-muted-foreground">No folder</span>
        <Check v-if="modelValue === null" class="size-4 shrink-0 text-primary" />
      </button>

      <button
        v-for="folder in folders"
        :key="folder.id"
        type="button"
        role="option"
        :aria-selected="modelValue === folder.id"
        class="flex w-full min-w-0 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
        @click="select(folder.id)"
      >
        <span class="flex min-w-0 items-center gap-2">
          <FolderOpen class="size-4 shrink-0 text-muted-foreground" />
          <span class="truncate">{{ folder.name }}</span>
        </span>
        <Check v-if="modelValue === folder.id" class="size-4 shrink-0 text-primary" />
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
  transform-origin: top;
}

.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}
</style>
