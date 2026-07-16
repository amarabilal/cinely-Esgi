<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Archive, Folder, Inbox, Plus, Settings2, Star, Tags, Users } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { Button } from '@/components/ui/button';
import TagManager from '@/components/notes/TagManager.vue';
import { useNotesStore } from '@/stores/notes.store';

const open = defineModel<boolean>('open', { default: false });

const route = useRoute();
const router = useRouter();
const store = useNotesStore();

const tagManagerOpen = ref(false);
const newFolderName = ref('');
const creatingFolder = ref(false);

const folders = computed(() => store.folders);
const tags = computed(() => store.tags);

const selectedTag = computed(() => (typeof route.query.tag === 'string' ? route.query.tag : ''));
const selectedFolder = computed(() => (typeof route.query.folder === 'string' ? route.query.folder : ''));
const selectedFilter = computed(() => (typeof route.query.filter === 'string' ? route.query.filter : ''));

const isAllNotes = computed(
  () => route.path === '/notes' && !selectedTag.value && !selectedFolder.value && !selectedFilter.value,
);
const isArchived = computed(() => route.path === '/notes/archived');

function close() {
  open.value = false;
}

function goAllNotes() {
  close();
  void router.push('/notes');
}

function selectFilter(filter: string) {
  close();
  void router.push({ path: '/notes', query: { filter } });
}

function goArchived() {
  close();
  void router.push('/notes/archived');
}

function selectFolder(folderId: string) {
  close();
  void router.push({ path: '/notes', query: { folder: folderId } });
}

function selectTag(tagId: string) {
  close();
  void router.push({ path: '/notes', query: { tag: tagId } });
}

function rowClass(active = false) {
  return [
    'flex min-h-[44px] w-full items-center gap-2 rounded-md px-3 text-sm transition-colors',
    active
      ? 'bg-accent text-accent-foreground'
      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
  ];
}

async function handleCreateFolder() {
  const trimmed = newFolderName.value.trim();
  if (!trimmed) return;
  creatingFolder.value = true;
  try {
    await store.createFolder(trimmed);
    newFolderName.value = '';
    toast.success('Folder created');
  } catch (error) {
    toast.error('Failed to create folder', {
      description: error instanceof Error ? error.message : undefined,
    });
  } finally {
    creatingFolder.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet-backdrop">
      <div
        v-if="open"
        class="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm md:hidden"
        @click.self="close"
      />
    </Transition>

    <Transition name="sheet-panel">
      <div
        v-if="open"
        class="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t bg-background p-4 pb-safe-lg md:hidden"
        role="dialog"
        aria-label="Filters"
      >
        <div class="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted" aria-hidden="true" />
        <h2 class="mb-3 text-base font-semibold tracking-tight">
          Filters
        </h2>

        <section class="space-y-1">
          <p class="px-1 py-1 font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Library
          </p>
          <button type="button" :class="rowClass(isAllNotes)" @click="goAllNotes">
            <Inbox class="size-4" />
            All notes
          </button>
          <button type="button" :class="rowClass(selectedFilter === 'favorites')" @click="selectFilter('favorites')">
            <Star class="size-4" />
            Favorites
          </button>
          <button type="button" :class="rowClass(selectedFilter === 'shared')" @click="selectFilter('shared')">
            <Users class="size-4" />
            Shared with me
          </button>
          <button type="button" :class="rowClass(isArchived)" @click="goArchived">
            <Archive class="size-4" />
            Archived
          </button>
        </section>

        <section class="mt-5 space-y-1">
          <p class="px-1 py-1 font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Folders
          </p>
          <p v-if="folders.length === 0" class="px-3 py-1 text-xs text-muted-foreground">
            No folders yet
          </p>
          <button
            v-for="folder in folders"
            :key="folder.id"
            type="button"
            :class="rowClass(selectedFolder === folder.id)"
            @click="selectFolder(folder.id)"
          >
            <Folder class="size-4" />
            <span class="truncate">{{ folder.name }}</span>
          </button>

          <form class="mt-2 flex items-center gap-1.5" @submit.prevent="handleCreateFolder">
            <input
              v-model="newFolderName"
              type="text"
              placeholder="New folder"
              aria-label="New folder name"
              class="h-11 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
            <Button type="submit" size="icon" variant="outline" class="size-11" aria-label="Create folder" :disabled="creatingFolder">
              <Plus class="size-4" />
            </Button>
          </form>
        </section>

        <section class="mt-5 space-y-1">
          <div class="flex items-center justify-between px-1 py-1">
            <p class="font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Tags
            </p>
            <Button variant="ghost" size="sm" class="h-8" @click="tagManagerOpen = true">
              <Settings2 class="size-3.5" />
              Manage tags
            </Button>
          </div>
          <p v-if="tags.length === 0" class="px-3 py-1 text-xs text-muted-foreground">
            No tags yet
          </p>
          <button
            v-for="tag in tags"
            :key="tag.id"
            type="button"
            :class="rowClass(selectedTag === tag.id)"
            @click="selectTag(tag.id)"
          >
            <Tags class="size-4" />
            <span class="truncate">#{{ tag.name }}</span>
          </button>
        </section>
      </div>
    </Transition>

    <TagManager v-model:open="tagManagerOpen" />
  </Teleport>
</template>

<style scoped>
.sheet-backdrop-enter-active,
.sheet-backdrop-leave-active {
  transition: opacity 0.2s ease;
}
.sheet-backdrop-enter-from,
.sheet-backdrop-leave-to {
  opacity: 0;
}

.sheet-panel-enter-active,
.sheet-panel-leave-active {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.sheet-panel-enter-from,
.sheet-panel-leave-to {
  transform: translateY(100%);
}
</style>
