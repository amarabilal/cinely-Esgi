<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { Calendar, Clock, FileText, Plus } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/EmptyState.vue';
import NoteCard from '@/components/notes/NoteCard.vue';
import { useNotesStore } from '@/stores/notes.store';
import type { Note, NoteQuery } from '@/api/notes.api';

type OverviewFilter = 'all' | 'week' | 'today';

const router = useRouter();
const route = useRoute();
const store = useNotesStore();

const statFilter = ref<OverviewFilter>('all');

// Whether the current route targets shared-with-me notes.
const isShared = computed(() => route.query.filter === 'shared');

// Derive the server-side query + header from the route.
const derived = computed<{ query: NoteQuery; title: string }>(() => {
  if (route.path === '/notes/archived') {
    return { query: { archived: true }, title: 'Archived' };
  }
  if (route.query.filter === 'favorites') {
    return { query: { favorite: true }, title: 'Favorites' };
  }
  if (route.query.filter === 'shared') {
    return { query: {}, title: 'Shared with me' };
  }
  const tagId = route.query.tag;
  if (typeof tagId === 'string') {
    const tag = store.tags.find((t) => t.id === tagId);
    return { query: { tagId }, title: tag ? `#${tag.name}` : '#Tag' };
  }
  const folderId = route.query.folder;
  if (typeof folderId === 'string') {
    const folder = store.folders.find((f) => f.id === folderId);
    return { query: { folderId }, title: folder ? folder.name : 'Folder' };
  }
  return { query: {}, title: 'All notes' };
});

const headerTitle = computed(() => derived.value.title);

// The full list returned from the server for the active query.
const displayedNotes = computed<Note[]>(() =>
  isShared.value ? store.sharedNotes : store.notes,
);

const todayCount = computed(() => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return displayedNotes.value.filter((note) => new Date(note.createdAt) >= todayStart).length;
});

const weekCount = computed(() => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 6);
  return displayedNotes.value.filter((note) => new Date(note.createdAt) >= weekStart).length;
});

const stats = computed(() => [
  { label: 'Total', value: displayedNotes.value.length, icon: FileText, filter: 'all' as const },
  { label: 'This week', value: weekCount.value, icon: Calendar, filter: 'week' as const },
  { label: 'Today', value: todayCount.value, icon: Clock, filter: 'today' as const },
]);

// Client-side narrowing of the visible grid via the stat cards.
const visibleNotes = computed<Note[]>(() => {
  if (statFilter.value === 'all') return displayedNotes.value;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (statFilter.value === 'today') {
    return displayedNotes.value.filter((note) => new Date(note.createdAt) >= todayStart);
  }
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 6);
  return displayedNotes.value.filter((note) => new Date(note.createdAt) >= weekStart);
});

function setStatFilter(filter: OverviewFilter) {
  statFilter.value = statFilter.value === filter ? 'all' : filter;
}

watch(
  () => derived.value.query,
  async (query) => {
    statFilter.value = 'all';
    if (isShared.value) {
      await store.fetchSharedNotes();
    } else {
      await store.fetchNotes(query);
    }
  },
  { immediate: true, deep: true },
);

function openNote(note: Note) {
  router.push(`/notes/${note.id}`);
}

async function newNote() {
  const n = await store.createNote();
  router.push(`/notes/${n.id}`);
}
</script>

<template>
  <div class="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
    <header class="flex items-center justify-between gap-4">
      <div class="min-w-0">
        <h1 class="truncate text-xl font-semibold tracking-tight">
          {{ headerTitle }}
        </h1>
        <p class="font-mono text-[11px] text-muted-foreground">
          {{ displayedNotes.length }} note{{ displayedNotes.length === 1 ? '' : 's' }}
        </p>
      </div>
      <Button @click="newNote">
        <Plus class="size-4" />
        New note
      </Button>
    </header>

    <template v-if="displayedNotes.length === 0">
      <EmptyState
        :icon="FileText"
        title="No notes yet"
        description="Create your first note to get started."
      >
        <Button @click="newNote">
          <Plus class="size-4" />
          New note
        </Button>
      </EmptyState>
    </template>

    <template v-else>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button
          v-for="stat in stats"
          :key="stat.label"
          type="button"
          class="rounded-lg border bg-card p-4 text-left text-card-foreground transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          :class="statFilter === stat.filter ? 'border-primary bg-accent/70' : ''"
          :aria-pressed="statFilter === stat.filter"
          @click="setStatFilter(stat.filter)"
        >
          <div class="flex items-center gap-3">
            <div class="flex size-9 items-center justify-center rounded-md border bg-muted text-muted-foreground">
              <component :is="stat.icon" class="size-4" />
            </div>
            <div>
              <p class="text-2xl font-semibold tracking-tight">
                {{ stat.value }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ stat.label }}
              </p>
            </div>
          </div>
        </button>
      </div>

      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <NoteCard
          v-for="note in visibleNotes"
          :key="note.id"
          :note="note"
          @select="openNote"
        />
      </div>
    </template>
  </div>
</template>
