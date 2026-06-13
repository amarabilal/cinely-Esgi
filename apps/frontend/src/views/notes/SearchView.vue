<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, nextTick, ref, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { Brain, Search, Sparkles, X } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/EmptyState.vue';
import NoteCard from '@/components/notes/NoteCard.vue';
import { useNotesStore } from '@/stores/notes.store';
import type { Note } from '@/api/notes.api';

const SEARCH_DEBOUNCE_MS = 300;

const router = useRouter();
const route = useRoute();
const store = useNotesStore();

const query = ref(typeof route.query.q === 'string' ? route.query.q : '');
const semantic = ref(route.query.semantic === 'true');
const isLoading = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const trimmedQuery = computed(() => query.value.trim());
const hasQuery = computed(() => trimmedQuery.value.length >= 1);
const results = computed<Note[]>(() => store.searchResults ?? []);
const resultCount = computed(() => results.value.length);

function clearTimer() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}

function syncUrl() {
  const nextQuery: Record<string, string> = {};
  if (hasQuery.value) nextQuery.q = trimmedQuery.value;
  if (semantic.value) nextQuery.semantic = 'true';
  router.replace({ path: '/notes/search', query: nextQuery });
}

function runSearch() {
  clearTimer();

  if (!hasQuery.value) {
    isLoading.value = false;
    store.clearSearch();
    return;
  }

  isLoading.value = true;
  debounceTimer = setTimeout(async () => {
    const q = trimmedQuery.value;
    const useSemantic = semantic.value;
    try {
      await store.search(q, useSemantic);
    } catch {
      store.clearSearch();
    } finally {
      // Ignore results from a query that has since changed.
      if (trimmedQuery.value === q && semantic.value === useSemantic) {
        isLoading.value = false;
      }
    }
  }, SEARCH_DEBOUNCE_MS);
}

watch([query, semantic], () => {
  syncUrl();
  runSearch();
});

function toggleSemantic() {
  semantic.value = !semantic.value;
}

function clearSearch() {
  query.value = '';
  store.clearSearch();
  isLoading.value = false;
  void nextTick(() => inputRef.value?.focus());
}

function openNote(note: Note) {
  router.push(`/notes/${note.id}`);
}

onMounted(() => {
  inputRef.value?.focus();
  if (hasQuery.value) runSearch();
});

onBeforeUnmount(() => clearTimer());
</script>

<template>
  <div class="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
    <header class="space-y-1">
      <p class="font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Search
      </p>
      <h1 class="text-xl font-semibold tracking-tight">
        Find anything in your notes
      </h1>
    </header>

    <div class="space-y-3">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div class="relative flex-1">
          <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref="inputRef"
            v-model="query"
            type="text"
            placeholder="Search your notes…"
            class="w-full rounded-md border border-input bg-background py-2 pl-9 pr-9 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
          <button
            v-if="hasQuery"
            type="button"
            aria-label="Clear search"
            class="absolute right-2 top-1/2 flex size-8 sm:size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            @click="clearSearch"
          >
            <X class="size-4" />
          </button>
        </div>

        <button
          type="button"
          role="switch"
          :aria-checked="semantic"
          class="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          :class="semantic
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
          @click="toggleSemantic"
        >
          <component :is="semantic ? Sparkles : Brain" class="size-4" />
          Semantic
        </button>
      </div>

      <div class="flex min-h-5 items-center gap-3 px-0.5">
        <p v-if="isLoading" class="font-mono text-[11px] text-muted-foreground">
          Searching…
        </p>
        <p v-else-if="hasQuery" class="font-mono text-[11px] text-muted-foreground">
          {{ resultCount }} result{{ resultCount === 1 ? '' : 's' }}
        </p>
        <Button
          v-if="hasQuery"
          variant="ghost"
          size="sm"
          @click="clearSearch"
        >
          Clear
        </Button>
      </div>
    </div>

    <EmptyState
      v-if="!hasQuery"
      :icon="Search"
      title="Search your notes"
      description="Type a query above to search across every note. Toggle Semantic for meaning-based matches."
    />

    <EmptyState
      v-else-if="!isLoading && resultCount === 0"
      :icon="Search"
      title="No results"
      :description="`No notes matched “${trimmedQuery}”. Try a different query${semantic ? '' : ' or enable Semantic search'}.`"
    />

    <div
      v-else-if="resultCount > 0"
      class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
    >
      <NoteCard
        v-for="note in results"
        :key="note.id"
        :note="note"
        @select="openNote"
      />
    </div>
  </div>
</template>
