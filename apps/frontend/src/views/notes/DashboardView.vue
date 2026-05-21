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
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
      <button @click="router.push('/notes')" class="text-gray-400 hover:text-gray-600 transition-colors">
        ← Notes
      </button>
      <h1 class="text-lg font-semibold text-gray-900">Dashboard</h1>
    </div>

    <div v-if="loading" class="flex items-center justify-center h-64">
      <div class="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
    </div>

    <div v-else-if="stats" class="max-w-4xl mx-auto py-8 px-4 space-y-8">
      <!-- Stats cards -->
      <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div class="bg-white rounded-2xl shadow-sm p-5">
          <p class="text-sm text-gray-500">Total notes</p>
          <p class="text-3xl font-bold text-gray-900 mt-1">{{ stats.totalNotes }}</p>
        </div>
        <div class="bg-white rounded-2xl shadow-sm p-5">
          <p class="text-sm text-gray-500">Favorites</p>
          <p class="text-3xl font-bold text-yellow-500 mt-1">{{ stats.favoriteNotes }}</p>
        </div>
        <div class="bg-white rounded-2xl shadow-sm p-5">
          <p class="text-sm text-gray-500">Archived</p>
          <p class="text-3xl font-bold text-gray-400 mt-1">{{ stats.archivedNotes }}</p>
        </div>
        <div class="bg-white rounded-2xl shadow-sm p-5">
          <p class="text-sm text-gray-500">Shared by me</p>
          <p class="text-3xl font-bold text-blue-500 mt-1">{{ stats.sharedByMe }}</p>
        </div>
        <div class="bg-white rounded-2xl shadow-sm p-5">
          <p class="text-sm text-gray-500">Shared with me</p>
          <p class="text-3xl font-bold text-purple-500 mt-1">{{ stats.sharedWithMe }}</p>
        </div>
      </div>

      <!-- Recent notes -->
      <div class="bg-white rounded-2xl shadow-sm p-6">
        <h2 class="text-base font-semibold text-gray-900 mb-4">Recent notes</h2>
        <div v-if="stats.recentNotes.length === 0" class="text-sm text-gray-400 text-center py-4">
          No notes yet.
        </div>
        <div v-for="note in stats.recentNotes" :key="note.id"
          class="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 rounded-lg px-2 -mx-2 transition-colors"
          @click="router.push('/notes')">
          <span class="text-sm text-gray-700 font-medium truncate">{{ note.title || 'Untitled' }}</span>
          <span class="text-xs text-gray-400 ml-4 shrink-0">{{ formatDate(note.updatedAt) }}</span>
        </div>
      </div>

      <!-- Top tags -->
      <div v-if="stats.topTags.length > 0" class="bg-white rounded-2xl shadow-sm p-6">
        <h2 class="text-base font-semibold text-gray-900 mb-4">Most used tags</h2>
        <div class="space-y-3">
          <div v-for="tag in stats.topTags" :key="tag.id" class="flex items-center gap-3">
            <span class="w-3 h-3 rounded-full shrink-0" :style="{ backgroundColor: tag.color }"></span>
            <span class="text-sm text-gray-700 flex-1">{{ tag.name }}</span>
            <span class="text-sm font-semibold text-gray-500">{{ tag.noteCount }}</span>
            <div class="w-24 bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div class="h-full rounded-full"
                :style="{ width: `${Math.min(100, (tag.noteCount / (stats!.topTags[0]?.noteCount || 1)) * 100)}%`, backgroundColor: tag.color }">
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
