<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  Archive,
  Folder,
  FolderOpen,
  Inbox,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Search,
  Settings2,
  Star,
  Tags,
  Trash2,
  Users,
  Calendar,
} from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { Button } from '@/components/ui/button';
import TagManager from '@/components/notes/TagManager.vue';
import { useNotesStore } from '@/stores/notes.store';

const props = withDefaults(defineProps<{
  mobile?: boolean;
}>(), {
  mobile: false,
});

const collapsed = defineModel<boolean>('collapsed', { default: false });

const emit = defineEmits<{
  newNote: [];
  logout: [];
  close: [];
}>();

const router = useRouter();
const route = useRoute();
const store = useNotesStore();

const newFolderName = ref('');
const creatingFolder = ref(false);
const dragOverFolderId = ref<string | null>(null);

const tagManagerOpen = ref(false);

// Per-folder inline action state.
const renamingFolderId = ref<string | null>(null);
const renameFolderName = ref('');
const confirmingDeleteFolderId = ref<string | null>(null);
const subfolderParentId = ref<string | null>(null);
const subfolderName = ref('');

// Function ref: auto-focus the inline input as soon as it mounts.
function focusInlineInput(el: unknown) {
  if (el instanceof HTMLInputElement) el.focus();
}

const tags = computed(() => store.tags);
const folders = computed(() => store.folders);

const selectedTag = computed(() => typeof route.query.tag === 'string' ? route.query.tag : '');
const selectedFolder = computed(() => typeof route.query.folder === 'string' ? route.query.folder : '');
const selectedFilter = computed(() => typeof route.query.filter === 'string' ? route.query.filter : '');
const isCollapsed = computed(() => collapsed.value && !props.mobile);

const isAllNotes = computed(() =>
  route.path === '/notes' && !selectedTag.value && !selectedFolder.value && !selectedFilter.value);

function navItemClass(active = false, dropTarget = false) {
  return [
    'group flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm transition-all duration-150',
    isCollapsed.value ? 'justify-center' : 'justify-between',
    active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
    dropTarget ? 'scale-[1.02] bg-primary/15 text-primary ring-2 ring-primary ring-offset-2 ring-offset-background shadow-sm' : '',
  ];
}

function handleDragOver(folderId: string, event: DragEvent) {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  if (dragOverFolderId.value !== folderId) dragOverFolderId.value = folderId;
}

function handleDragLeave(folderId: string, event: DragEvent) {
  const next = event.relatedTarget as Node | null;
  if (next && (event.currentTarget as Node).contains(next)) return;
  if (dragOverFolderId.value === folderId) dragOverFolderId.value = null;
}

function goAllNotes() {
  emit('close');
  void router.push('/notes');
}

function selectFilter(filter: string) {
  emit('close');
  void router.push({ path: '/notes', query: { filter } });
}

function goArchived() {
  emit('close');
  void router.push('/notes/archived');
}

function goDashboard() {
  emit('close');
  void router.push('/dashboard');
}

function goCalendar() {
  emit('close');
  void router.push('/calendar');
}

function goSearch() {
  emit('close');
  void router.push('/notes/search');
}

function selectTag(tagId: string) {
  emit('close');
  if (selectedTag.value === tagId) {
    void router.push('/notes');
    return;
  }
  void router.push({ path: '/notes', query: { tag: tagId } });
}

function selectFolder(folderId: string) {
  emit('close');
  if (selectedFolder.value === folderId) {
    void router.push('/notes');
    return;
  }
  void router.push({ path: '/notes', query: { folder: folderId } });
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

function startRenameFolder(folder: { id: string; name: string }) {
  confirmingDeleteFolderId.value = null;
  subfolderParentId.value = null;
  renameFolderName.value = folder.name;
  renamingFolderId.value = folder.id;
}

function cancelRenameFolder() {
  renamingFolderId.value = null;
  renameFolderName.value = '';
}

async function handleRenameFolder(folderId: string) {
  const trimmed = renameFolderName.value.trim();
  if (!trimmed) {
    cancelRenameFolder();
    return;
  }
  try {
    await store.renameFolder(folderId, trimmed);
    toast.success('Folder renamed');
  } catch (error) {
    toast.error('Failed to rename folder', {
      description: error instanceof Error ? error.message : undefined,
    });
  } finally {
    cancelRenameFolder();
  }
}

function startDeleteFolder(folderId: string) {
  renamingFolderId.value = null;
  subfolderParentId.value = null;
  confirmingDeleteFolderId.value = folderId;
}

function cancelDeleteFolder() {
  confirmingDeleteFolderId.value = null;
}

async function handleDeleteFolder(folderId: string) {
  try {
    await store.deleteFolder(folderId);
    toast.success('Folder deleted');
  } catch (error) {
    toast.error('Failed to delete folder', {
      description: error instanceof Error ? error.message : undefined,
    });
  } finally {
    confirmingDeleteFolderId.value = null;
  }
}

function startCreateSubfolder(folderId: string) {
  renamingFolderId.value = null;
  confirmingDeleteFolderId.value = null;
  subfolderName.value = '';
  subfolderParentId.value = folderId;
}

function cancelCreateSubfolder() {
  subfolderParentId.value = null;
  subfolderName.value = '';
}

async function handleCreateSubfolder(parentId: string) {
  const trimmed = subfolderName.value.trim();
  if (!trimmed) {
    cancelCreateSubfolder();
    return;
  }
  try {
    await store.createFolder(trimmed, parentId);
    toast.success('Subfolder created');
  } catch (error) {
    toast.error('Failed to create subfolder', {
      description: error instanceof Error ? error.message : undefined,
    });
  } finally {
    cancelCreateSubfolder();
  }
}

async function handleDropOnFolder(folderId: string, event: DragEvent) {
  event.preventDefault();
  dragOverFolderId.value = null;

  const noteId = event.dataTransfer?.getData('text/plain');
  if (!noteId) return;

  try {
    await store.updateNote(noteId, { folderId });
    toast.success('Note moved');
  } catch (error) {
    toast.error('Failed to move note', {
      description: error instanceof Error ? error.message : undefined,
    });
  }
}

function handleTagDragStart(event: DragEvent, tag: { id: string; name: string }) {
  if (!event.dataTransfer) return;
  event.dataTransfer.effectAllowed = 'copy';
  event.dataTransfer.setData('application/x-cinely-tag', JSON.stringify({ id: tag.id, name: tag.name }));
}
</script>

<template>
  <aside
    class="flex h-full shrink-0 flex-col border-r bg-background transition-[width] duration-200"
    :class="isCollapsed ? 'w-14' : 'w-64'"
  >
    <div class="flex h-12 items-center justify-between border-b px-3">
      <span v-if="!isCollapsed" class="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Workspace
      </span>
      <Button
        v-if="!mobile"
        variant="ghost"
        size="icon"
        :title="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        aria-label="Toggle sidebar"
        @click="collapsed = !collapsed"
      >
        <PanelLeftOpen v-if="isCollapsed" class="size-4" />
        <PanelLeftClose v-else class="size-4" />
      </Button>
    </div>

    <div class="flex-1 overflow-y-auto p-2 scrollbar-thin">
      <div class="space-y-5">
        <section class="space-y-1">
          <p v-if="!isCollapsed" class="px-2 py-1 font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Library
          </p>
          <button
            type="button"
            :class="navItemClass(route.path === '/dashboard')"
            title="Dashboard"
            @click="goDashboard"
          >
            <span class="flex min-w-0 items-center gap-2">
              <LayoutDashboard class="size-4" />
              <span v-if="!isCollapsed" class="truncate">Dashboard</span>
            </span>
          </button>
          <button
            type="button"
            :class="navItemClass(route.path === '/calendar')"
            title="Calendar"
            @click="goCalendar"
          >
            <span class="flex min-w-0 items-center gap-2">
              <Calendar class="size-4" />
              <span v-if="!isCollapsed" class="truncate">Calendar</span>
            </span>
          </button>
          <button
            type="button"
            :class="navItemClass(isAllNotes)"
            title="All notes"
            @click="goAllNotes"
          >
            <span class="flex min-w-0 items-center gap-2">
              <Inbox class="size-4" />
              <span v-if="!isCollapsed" class="truncate">All notes</span>
            </span>
          </button>
          <button
            type="button"
            :class="navItemClass(route.path === '/notes/search')"
            title="Search"
            @click="goSearch"
          >
            <span class="flex min-w-0 items-center gap-2">
              <Search class="size-4" />
              <span v-if="!isCollapsed" class="truncate">Search</span>
            </span>
          </button>
          <button
            type="button"
            :class="navItemClass(selectedFilter === 'favorites')"
            title="Favorites"
            @click="selectFilter('favorites')"
          >
            <span class="flex min-w-0 items-center gap-2">
              <Star class="size-4" />
              <span v-if="!isCollapsed" class="truncate">Favorites</span>
            </span>
          </button>
          <button
            type="button"
            :class="navItemClass(selectedFilter === 'shared')"
            title="Shared with me"
            @click="selectFilter('shared')"
          >
            <span class="flex min-w-0 items-center gap-2">
              <Users class="size-4" />
              <span v-if="!isCollapsed" class="truncate">Shared with me</span>
            </span>
          </button>
          <button
            type="button"
            :class="navItemClass(route.path === '/notes/archived')"
            title="Archived"
            @click="goArchived"
          >
            <span class="flex min-w-0 items-center gap-2">
              <Archive class="size-4" />
              <span v-if="!isCollapsed" class="truncate">Archived</span>
            </span>
          </button>
        </section>

        <section class="space-y-1">
          <div v-if="!isCollapsed" class="flex items-center justify-between px-2 py-1">
            <p class="font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Tags
            </p>
            <Button
              variant="ghost"
              size="icon"
              class="size-6"
              title="Manage tags"
              aria-label="Manage tags"
              @click="tagManagerOpen = true"
            >
              <Settings2 class="size-3.5" />
            </Button>
          </div>
          <div v-if="tags.length === 0 && !isCollapsed" class="px-2 py-1 text-xs text-muted-foreground">
            No tags yet
          </div>
          <button
            v-for="tag in tags"
            :key="tag.id"
            type="button"
            :class="[navItemClass(selectedTag === tag.id), 'cursor-grab active:cursor-grabbing']"
            :title="`#${tag.name}`"
            draggable="true"
            @click="selectTag(tag.id)"
            @dragstart="handleTagDragStart($event, tag)"
          >
            <span class="flex min-w-0 items-center gap-2">
              <Tags class="size-4" />
              <span v-if="!isCollapsed" class="truncate">#{{ tag.name }}</span>
            </span>
          </button>
        </section>

        <section class="space-y-1">
          <p v-if="!isCollapsed" class="px-2 py-1 font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Folders
          </p>
          <div v-if="folders.length === 0 && !isCollapsed" class="px-2 py-1 text-xs text-muted-foreground">
            No folders yet
          </div>
          <div v-for="folder in folders" :key="folder.id" class="space-y-1">
            <!-- Inline rename mode -->
            <div
              v-if="renamingFolderId === folder.id && !isCollapsed"
              class="flex items-center gap-1.5 px-1"
            >
              <input
                :ref="focusInlineInput"
                v-model="renameFolderName"
                type="text"
                aria-label="Rename folder"
                class="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                @keydown.enter.prevent="handleRenameFolder(folder.id)"
                @keydown.esc.prevent="cancelRenameFolder"
                @blur="handleRenameFolder(folder.id)"
              >
            </div>

            <!-- Folder row (drop target) + hover actions as siblings (no nested buttons) -->
            <div v-else class="group/folder relative">
              <button
                type="button"
                :class="navItemClass(selectedFolder === folder.id, dragOverFolderId === folder.id)"
                :title="folder.name"
                :data-drop-target="dragOverFolderId === folder.id ? 'true' : undefined"
                @click="selectFolder(folder.id)"
                @dragenter.prevent="handleDragOver(folder.id, $event)"
                @dragover.prevent="handleDragOver(folder.id, $event)"
                @dragleave="handleDragLeave(folder.id, $event)"
                @drop="handleDropOnFolder(folder.id, $event)"
              >
                <span class="flex min-w-0 items-center gap-2">
                  <FolderOpen
                    v-if="dragOverFolderId === folder.id"
                    class="size-4 animate-[wiggle_0.4s_ease-in-out_infinite] text-primary"
                  />
                  <Folder
                    v-else
                    class="size-4 transition-transform"
                  />
                  <span v-if="!isCollapsed" class="truncate">{{ folder.name }}</span>
                </span>
                <span
                  v-if="dragOverFolderId === folder.id && !isCollapsed"
                  class="font-mono text-[10px] uppercase tracking-wide text-primary"
                >
                  Drop
                </span>
              </button>

              <!-- Hover actions: positioned over the row, siblings of the button -->
              <span
                v-if="dragOverFolderId !== folder.id && !isCollapsed"
                class="pointer-events-none absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded-md bg-accent/60 opacity-0 transition-opacity group-hover/folder:pointer-events-auto group-hover/folder:opacity-100"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-6"
                  title="New subfolder"
                  aria-label="New subfolder"
                  @click.stop="startCreateSubfolder(folder.id)"
                >
                  <Plus class="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-6"
                  title="Rename folder"
                  aria-label="Rename folder"
                  @click.stop="startRenameFolder(folder)"
                >
                  <Pencil class="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-6 text-muted-foreground hover:text-destructive"
                  title="Delete folder"
                  aria-label="Delete folder"
                  @click.stop="startDeleteFolder(folder.id)"
                >
                  <Trash2 class="size-3.5" />
                </Button>
              </span>
            </div>

            <!-- Inline delete confirm -->
            <div
              v-if="confirmingDeleteFolderId === folder.id && !isCollapsed"
              class="flex items-center justify-between gap-2 rounded-md border bg-muted px-2 py-1.5"
            >
              <span class="min-w-0 truncate text-xs text-muted-foreground">Delete this folder?</span>
              <span class="flex shrink-0 items-center gap-1">
                <Button
                  variant="destructive"
                  size="sm"
                  class="h-6 px-2 text-xs"
                  @click.stop="handleDeleteFolder(folder.id)"
                >
                  Delete
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-6 px-2 text-xs"
                  @click.stop="cancelDeleteFolder"
                >
                  Cancel
                </Button>
              </span>
            </div>

            <!-- Inline subfolder create -->
            <div
              v-if="subfolderParentId === folder.id && !isCollapsed"
              class="flex items-center gap-1.5 pl-4 pr-1"
            >
              <input
                :ref="focusInlineInput"
                v-model="subfolderName"
                type="text"
                placeholder="Subfolder name"
                aria-label="New subfolder name"
                class="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                @keydown.enter.prevent="handleCreateSubfolder(folder.id)"
                @keydown.esc.prevent="cancelCreateSubfolder"
                @blur="handleCreateSubfolder(folder.id)"
              >
            </div>
          </div>

          <form v-if="!isCollapsed" class="mt-2 flex items-center gap-1.5" @submit.prevent="handleCreateFolder">
            <input
              v-model="newFolderName"
              type="text"
              placeholder="New folder"
              class="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
            <Button type="submit" size="icon" variant="outline" aria-label="Create folder" :disabled="creatingFolder">
              <Plus class="size-4" />
            </Button>
          </form>
        </section>
      </div>
    </div>

    <div class="border-t p-2">
      <Button
        class="w-full"
        :size="isCollapsed ? 'icon' : 'sm'"
        variant="secondary"
        title="New note"
        @click="emit('newNote'); emit('close')"
      >
        <Plus class="size-4" />
        <span v-if="!isCollapsed">New note</span>
      </Button>
      <Button
        class="mt-1 w-full"
        :size="isCollapsed ? 'icon' : 'sm'"
        variant="ghost"
        title="Log out"
        @click="emit('logout'); emit('close')"
      >
        <LogOut class="size-4" />
        <span v-if="!isCollapsed">Log out</span>
      </Button>
    </div>

    <TagManager v-model:open="tagManagerOpen" />
  </aside>
</template>
