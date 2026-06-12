<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Trash2, RotateCcw, AlertTriangle } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/EmptyState.vue';
import { useNotesStore } from '@/stores/notes.store';
import { stripHtml, formatRelativeTime } from '@/utils/notes';

const store = useNotesStore();
const loading = ref(true);
const confirmEmpty = ref(false);

onMounted(async () => {
  try {
    await store.fetchTrash();
  } finally {
    loading.value = false;
  }
});

async function handleRestore(id: string) {
  try {
    await store.restoreNote(id);
    toast.success('Note restored');
  } catch (e) {
    toast.error('Failed to restore note');
  }
}

async function handlePermanentDelete(id: string) {
  try {
    await store.permanentDelete(id);
    toast.success('Note permanently deleted');
  } catch (e) {
    toast.error('Failed to delete note');
  }
}

async function handleEmptyTrash() {
  try {
    await store.emptyTrash();
    confirmEmpty.value = false;
    toast.success('Trash emptied');
  } catch (e) {
    toast.error('Failed to empty trash');
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
    <header class="flex items-center justify-between gap-4">
      <div class="min-w-0">
        <h1 class="truncate text-xl font-semibold tracking-tight flex items-center gap-2">
          <Trash2 class="size-5 text-muted-foreground" />
          Trash
        </h1>
        <p class="font-mono text-[11px] text-muted-foreground">
          {{ store.trashedNotes.length }} note{{ store.trashedNotes.length === 1 ? '' : 's' }}
          · Items are permanently deleted after 30 days
        </p>
      </div>
      <div v-if="store.trashedNotes.length > 0" class="flex items-center gap-2">
        <template v-if="confirmEmpty">
          <span class="text-sm text-destructive font-medium">Delete all permanently?</span>
          <Button variant="destructive" size="sm" @click="handleEmptyTrash">
            Yes, empty trash
          </Button>
          <Button variant="ghost" size="sm" @click="confirmEmpty = false">
            Cancel
          </Button>
        </template>
        <Button v-else variant="outline" size="sm" class="text-destructive" @click="confirmEmpty = true">
          <Trash2 class="size-4" />
          Empty trash
        </Button>
      </div>
    </header>

    <div v-if="loading" class="flex items-center justify-center h-64">
      <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>

    <template v-else-if="store.trashedNotes.length === 0">
      <EmptyState
        :icon="Trash2"
        title="Trash is empty"
        description="Deleted notes will appear here. You can restore or permanently delete them."
      />
    </template>

    <template v-else>
      <div class="space-y-2">
        <div
          v-for="note in store.trashedNotes"
          :key="note.id"
          class="group flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/40"
        >
          <!-- Note info -->
          <div class="min-w-0 flex-1">
            <h3 class="truncate text-sm font-medium text-foreground">
              {{ note.title || 'Untitled' }}
            </h3>
            <p class="line-clamp-1 text-xs text-muted-foreground mt-0.5">
              {{ stripHtml(note.content) || 'No content' }}
            </p>
            <p v-if="note.deletedAt" class="text-[11px] text-muted-foreground mt-1 font-mono">
              Deleted {{ formatRelativeTime(note.deletedAt) }}
            </p>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              title="Restore note"
              class="text-primary"
              @click="handleRestore(note.id)"
            >
              <RotateCcw class="size-4" />
              Restore
            </Button>
            <Button
              variant="ghost"
              size="sm"
              title="Delete permanently"
              class="text-destructive"
              @click="handlePermanentDelete(note.id)"
            >
              <Trash2 class="size-4" />
              Delete
            </Button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
