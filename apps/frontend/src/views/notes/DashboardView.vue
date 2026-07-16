<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { notesApi, type NoteStats } from '@/api/notes.api';

const router = useRouter();
const stats = ref<NoteStats | null>(null);
const loading = ref(true);

onMounted(async () => {
  try {
    const { data } = await notesApi.getStats();
    stats.value = data;
  } finally {
    loading.value = false;
  }
});

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}
</script>

<template>
  <div class="h-full overflow-y-auto bg-background text-foreground">
    <div class="mx-auto max-w-4xl px-4 sm:px-6 py-8">

      <header class="mb-8">
        <p class="font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Notes</p>
        <h1 class="mt-1 text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
      </header>

      <div v-if="loading" class="flex items-center justify-center h-64">
        <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>

      <div v-else-if="stats" class="space-y-8">

      <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div class="bg-card border border-border rounded-xl p-5">
          <p class="text-3xl font-bold text-primary">{{ stats.totalNotes }}</p>
          <p class="text-sm text-muted-foreground mt-1">Total notes</p>
        </div>
        <div class="bg-card border border-border rounded-xl p-5">
          <p class="text-3xl font-bold text-foreground">{{ stats.favoriteNotes }}</p>
          <p class="text-sm text-muted-foreground mt-1">Favorites</p>
        </div>
        <div class="bg-card border border-border rounded-xl p-5">
          <p class="text-3xl font-bold text-foreground">{{ stats.archivedNotes }}</p>
          <p class="text-sm text-muted-foreground mt-1">Archived</p>
        </div>
        <div class="bg-card border border-border rounded-xl p-5">
          <p class="text-3xl font-bold text-foreground">{{ stats.sharedByMe }}</p>
          <p class="text-sm text-muted-foreground mt-1">Shared by me</p>
        </div>
        <div class="bg-card border border-border rounded-xl p-5">
          <p class="text-3xl font-bold text-foreground">{{ stats.sharedWithMe }}</p>
          <p class="text-sm text-muted-foreground mt-1">Shared with me</p>
        </div>
      </div>

      <div class="bg-card border border-border rounded-xl p-6">
        <h2 class="text-base font-semibold text-foreground mb-4">Recent notes</h2>
        <div v-if="stats.recentNotes.length === 0" class="text-sm text-muted-foreground text-center py-4">
          No notes yet.
        </div>
        <div v-for="note in stats.recentNotes" :key="note.id"
          class="flex items-center justify-between py-2.5 border-b border-border last:border-0 cursor-pointer hover:bg-muted rounded-lg px-2 -mx-2 transition-colors"
          @click="router.push('/notes')">
          <span class="text-sm text-foreground font-medium truncate">{{ note.title || 'Untitled' }}</span>
          <span class="text-xs text-muted-foreground ml-4 shrink-0">{{ formatDate(note.updatedAt) }}</span>
        </div>
      </div>

      <div v-if="stats.topTags.length > 0" class="bg-card border border-border rounded-xl p-6">
        <h2 class="text-base font-semibold text-foreground mb-4">Most used tags</h2>
        <div class="space-y-3">
          <div v-for="tag in stats.topTags" :key="tag.id" class="flex items-center gap-3">
            <span class="w-3 h-3 rounded-full shrink-0" :style="{ backgroundColor: tag.color }"></span>
            <span class="text-sm text-foreground flex-1">{{ tag.name }}</span>
            <span class="text-sm font-semibold text-muted-foreground">{{ tag.noteCount }}</span>
            <div class="w-16 flex-1 max-w-24 bg-muted rounded-full h-1.5 overflow-hidden">
              <div class="h-full rounded-full"
                :style="{ width: `${Math.min(100, (tag.noteCount / (stats!.topTags[0]?.noteCount || 1)) * 100)}%`, backgroundColor: tag.color }">
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  </div>
</template>
