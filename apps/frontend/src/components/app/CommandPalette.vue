<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Archive, FileText, Plus, Search, SearchCheck } from 'lucide-vue-next';
import { Kbd } from '@/components/ui/kbd';
import { useNotesStore } from '@/stores/notes.store';

const open = defineModel<boolean>('open', { default: false });

const SEARCH_DEBOUNCE_MS = 250;
const RECENT_LIMIT = 8;

const router = useRouter();
const store = useNotesStore();
const query = ref('');
const inputRef = ref<HTMLInputElement | null>(null);
const isSearching = ref(false);

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const trimmedQuery = computed(() => query.value.trim());
const hasQuery = computed(() => trimmedQuery.value.length >= 1);

// When searching, show the server-side results; otherwise the most recent notes.
const displayedNotes = computed(() => {
  if (hasQuery.value) return store.searchResults ?? [];
  return (store.notes ?? []).slice(0, RECENT_LIMIT);
});

function runSearch() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  if (!hasQuery.value) {
    isSearching.value = false;
    store.clearSearch();
    return;
  }

  isSearching.value = true;
  debounceTimer = setTimeout(async () => {
    const q = trimmedQuery.value;
    try {
      await store.search(q, false);
    } catch {
      store.clearSearch();
    } finally {
      // Ignore results from a query that has since changed.
      if (trimmedQuery.value === q) isSearching.value = false;
    }
  }, SEARCH_DEBOUNCE_MS);
}

watch(query, runSearch);

watch(open, async (nextOpen) => {
  if (!nextOpen) {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    query.value = '';
    isSearching.value = false;
    store.clearSearch();
    return;
  }
  if ((store.notes ?? []).length === 0) {
    await store.fetchNotes().catch(() => {});
  }
  await nextTick();
  inputRef.value?.focus();
});

function closeAndNavigate(path: string) {
  open.value = false;
  void router.push(path);
}

function searchEverything() {
  if (!hasQuery.value) return;
  open.value = false;
  void router.push({ path: '/notes/search', query: { q: trimmedQuery.value } });
}

async function newNoteAction() {
  open.value = false;
  const n = await store.createNote();
  void router.push('/notes/' + n.id);
}

function onKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    open.value = !open.value;
    return;
  }

  if (event.key === 'Escape') {
    open.value = false;
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  if (debounceTimer) clearTimeout(debounceTimer);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="fixed inset-0 z-50 bg-background/80 p-3 backdrop-blur-sm" @click.self="open = false">
        <div class="modal-panel mx-auto mt-6 sm:mt-[12vh] w-full max-w-xl overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-2xl">
        <div class="flex h-12 items-center gap-3 border-b px-3">
          <Search class="size-4 text-muted-foreground" />
          <input
            ref="inputRef"
            v-model="query"
            type="text"
            placeholder="Search notes or run an action"
            class="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          >
          <Kbd>Esc</Kbd>
        </div>

        <div class="max-h-[min(420px,60dvh)] overflow-y-auto p-2 scrollbar-thin">
          <p class="px-2 py-1.5 font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Actions
          </p>
          <button
            type="button"
            class="flex h-10 w-full items-center justify-between rounded-md px-2 text-sm hover:bg-accent"
            @click="newNoteAction"
          >
            <span class="flex items-center gap-2"><Plus class="size-4" /> New note</span>
            <Kbd>N</Kbd>
          </button>
          <button
            v-if="hasQuery"
            type="button"
            class="flex h-10 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-accent"
            @click="searchEverything"
          >
            <SearchCheck class="size-4 shrink-0 text-muted-foreground" />
            <span class="truncate">Search everything for &ldquo;{{ trimmedQuery }}&rdquo;</span>
          </button>
          <button
            type="button"
            class="flex h-10 w-full items-center gap-2 rounded-md px-2 text-sm hover:bg-accent"
            @click="closeAndNavigate('/notes/archived')"
          >
            <Archive class="size-4" />
            Open archived
          </button>

          <div class="my-2 h-px bg-border" />

          <p class="px-2 py-1.5 font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {{ hasQuery ? 'Results' : 'Recent' }}
          </p>
          <div v-if="isSearching && displayedNotes.length === 0" class="px-2 py-3 text-sm text-muted-foreground">
            Searching…
          </div>
          <div v-else-if="displayedNotes.length === 0" class="px-2 py-3 text-sm text-muted-foreground">
            {{ hasQuery ? 'No notes found.' : 'No notes yet.' }}
          </div>
          <button
            v-for="note in displayedNotes"
            :key="note.id"
            type="button"
            class="flex h-10 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-accent"
            @click="closeAndNavigate(`/notes/${note.id}`)"
          >
            <FileText class="size-4 shrink-0 text-muted-foreground" />
            <span class="truncate">{{ note.title || 'Untitled' }}</span>
          </button>
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
