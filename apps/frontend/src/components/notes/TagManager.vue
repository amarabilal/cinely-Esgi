<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { Check, Plus, Tag as TagIcon, Trash2, X } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { Button } from '@/components/ui/button';
import { useNotesStore } from '@/stores/notes.store';
import type { Tag } from '@/api/tags.api';

const open = defineModel<boolean>('open', { default: false });

const DEFAULT_COLOR = '#6366f1';

const store = useNotesStore();

// Per-row local edit state, keyed by tag id.
const drafts = reactive<Record<string, { name: string; color: string }>>({});
// Per-row "confirm delete" state.
const confirmingDelete = ref<string | null>(null);
const savingId = ref<string | null>(null);

// Create-row state.
const newName = ref('');
const newColor = ref(DEFAULT_COLOR);
const isCreating = ref(false);
const newNameRef = ref<HTMLInputElement | null>(null);

const tags = computed<Tag[]>(() => store.tags);

function syncDrafts() {
  for (const tag of store.tags) {
    drafts[tag.id] = { name: tag.name, color: tag.color };
  }
}

function isDirty(tag: Tag): boolean {
  const draft = drafts[tag.id];
  if (!draft) return false;
  return draft.name.trim() !== tag.name || draft.color !== tag.color;
}

watch(open, async (isOpen) => {
  if (isOpen) {
    confirmingDelete.value = null;
    newName.value = '';
    newColor.value = DEFAULT_COLOR;
    syncDrafts();
    await nextTick();
    newNameRef.value?.focus();
  }
});

watch(() => store.tags, syncDrafts, { deep: true });

async function createTag() {
  const name = newName.value.trim();
  if (!name) {
    toast.error('Tag name is required');
    return;
  }
  isCreating.value = true;
  try {
    await store.createTag(name, newColor.value);
    toast.success(`Tag #${name} created`);
    newName.value = '';
    newColor.value = DEFAULT_COLOR;
    await nextTick();
    newNameRef.value?.focus();
  } catch (error) {
    toast.error('Failed to create tag', {
      description: error instanceof Error ? error.message : undefined,
    });
  } finally {
    isCreating.value = false;
  }
}

async function saveTag(tag: Tag) {
  const draft = drafts[tag.id];
  if (!draft) return;
  const name = draft.name.trim();
  if (!name) {
    toast.error('Tag name is required');
    return;
  }
  savingId.value = tag.id;
  try {
    await store.updateTag(tag.id, { name, color: draft.color });
    toast.success('Tag updated');
  } catch (error) {
    toast.error('Failed to update tag', {
      description: error instanceof Error ? error.message : undefined,
    });
  } finally {
    savingId.value = null;
  }
}

async function deleteTag(tag: Tag) {
  try {
    await store.deleteTag(tag.id);
    delete drafts[tag.id];
    confirmingDelete.value = null;
    toast.success(`Tag #${tag.name} deleted`);
  } catch (error) {
    toast.error('Failed to delete tag', {
      description: error instanceof Error ? error.message : undefined,
    });
  }
}

function close() {
  open.value = false;
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    event.preventDefault();
    close();
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-start justify-center bg-background/80 p-3 backdrop-blur-sm sm:items-center"
        @click.self="close"
      >
        <div class="modal-panel flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg">
        <header class="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div class="flex items-center gap-2">
            <TagIcon class="size-4 text-muted-foreground" />
            <h2 class="text-sm font-semibold">
              Manage tags
            </h2>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close" @click="close">
            <X class="size-4" />
          </Button>
        </header>

        <!-- Create row -->
        <div class="border-b bg-card px-4 py-3">
          <p class="mb-2 font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            New tag
          </p>
          <form class="flex flex-wrap items-center gap-2" @submit.prevent="createTag">
            <input
              type="color"
              v-model="newColor"
              aria-label="New tag color"
              class="size-9 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1"
            >
            <input
              ref="newNameRef"
              v-model="newName"
              type="text"
              placeholder="Tag name"
              class="min-w-0 flex-1 basis-[10rem] rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
            <Button type="submit" size="sm" :disabled="isCreating || !newName.trim()">
              <Plus class="size-4" />
              Add
            </Button>
          </form>
        </div>

        <!-- Tag list -->
        <div class="min-h-0 flex-1 overflow-y-auto p-2 scrollbar-thin">
          <p v-if="tags.length === 0" class="px-2 py-8 text-center text-sm text-muted-foreground">
            No tags yet. Create one above.
          </p>

          <ul v-else class="space-y-1">
            <li
              v-for="tag in tags"
              :key="tag.id"
              class="rounded-md border bg-card px-2.5 py-2"
            >
              <div class="flex flex-wrap items-center gap-2">
                <input
                  v-if="drafts[tag.id]"
                  type="color"
                  v-model="drafts[tag.id].color"
                  :aria-label="`Color for ${tag.name}`"
                  class="size-9 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1"
                >
                <input
                  v-if="drafts[tag.id]"
                  v-model="drafts[tag.id].name"
                  type="text"
                  :aria-label="`Name for ${tag.name}`"
                  class="min-w-0 flex-1 basis-[8rem] rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  @keydown.enter.prevent="saveTag(tag)"
                >

                <template v-if="confirmingDelete === tag.id">
                  <Button
                    variant="destructive"
                    size="sm"
                    :disabled="savingId === tag.id"
                    @click="deleteTag(tag)"
                  >
                    Confirm
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    @click="confirmingDelete = null"
                  >
                    Cancel
                  </Button>
                </template>

                <template v-else>
                  <Button
                    variant="secondary"
                    size="icon"
                    aria-label="Save tag"
                    :disabled="!isDirty(tag) || savingId === tag.id"
                    @click="saveTag(tag)"
                  >
                    <Check class="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete tag"
                    class="text-destructive hover:text-destructive"
                    @click="confirmingDelete = tag.id"
                  >
                    <Trash2 class="size-4" />
                  </Button>
                </template>
              </div>
            </li>
          </ul>
        </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Backdrop fade. */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.18s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

/* Panel scale + translate, decoupled from the backdrop fade. */
.modal-enter-active .modal-panel,
.modal-leave-active .modal-panel {
  transition:
    opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-enter-from .modal-panel,
.modal-leave-to .modal-panel {
  opacity: 0;
  transform: translateY(-10px) scale(0.97);
}
</style>
