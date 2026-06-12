<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { Calendar, Clock, Globe, ArrowLeft, AlertCircle, FileText } from 'lucide-vue-next';
import PublicLayout from '@/components/layout/PublicLayout.vue';
import { Button } from '@/components/ui/button';
import { notesApi, type Note } from '@/api/notes.api';

const route = useRoute();
const note = ref<Note | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

async function loadPublicNote() {
  const token = route.params.token as string;
  if (!token) {
    error.value = 'Invalid share link token.';
    loading.value = false;
    return;
  }

  try {
    const response = await notesApi.findPublicNote(token);
    note.value = response.data;
  } catch (err: any) {
    console.error('Failed to load public note', err);
    error.value = err.response?.data?.message || 'This note could not be found or is no longer public.';
  } finally {
    loading.value = false;
  }
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

onMounted(() => {
  loadPublicNote();
});
</script>

<template>
  <PublicLayout>
    <div class="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <!-- Back button if user is authenticated / or just standard back home link -->
      <div class="mb-6">
        <RouterLink
          to="/"
          class="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft class="size-4" />
          Retour à l'accueil
        </RouterLink>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-20 space-y-4">
        <div class="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        <p class="text-sm text-muted-foreground animate-pulse">Chargement de la note publique...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center">
        <AlertCircle class="mx-auto size-10 text-destructive mb-3" />
        <h3 class="text-lg font-semibold text-foreground mb-1">Impossible d'accéder à la note</h3>
        <p class="text-sm text-muted-foreground mb-4">{{ error }}</p>
        <Button to="/" variant="outline" size="sm">Aller à l'accueil</Button>
      </div>

      <!-- Note View -->
      <article v-else-if="note" class="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
        <!-- Top bar indicating public view status -->
        <div class="flex items-center gap-2 border-b border-border bg-muted/30 px-6 py-3 text-xs text-muted-foreground">
          <Globe class="size-3.5 text-primary animate-pulse" />
          <span>Cette note est partagée publiquement en lecture seule.</span>
        </div>

        <div class="p-6 sm:p-8 space-y-6">
          <header class="space-y-3 pb-6 border-b border-border">
            <h1 class="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              {{ note.title || 'Sans titre' }}
            </h1>
            
            <div class="flex flex-wrap items-center gap-4 text-xs text-muted-foreground font-mono">
              <span class="flex items-center gap-1">
                <Calendar class="size-3.5" />
                Créée le {{ formatDate(note.createdAt) }}
              </span>
              <span class="flex items-center gap-1">
                <Clock class="size-3.5" />
                Mise à jour le {{ formatDate(note.updatedAt) }}
              </span>
            </div>

            <!-- Tags -->
            <div v-if="note.tags && note.tags.length > 0" class="flex flex-wrap gap-1.5 pt-2">
              <span
                v-for="tag in note.tags"
                :key="tag.id"
                class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                :style="{ backgroundColor: tag.color + '20', color: tag.color }"
              >
                #{{ tag.name }}
              </span>
            </div>
          </header>

          <!-- Content rendered using WYSIWYG note classes/styling -->
          <div class="note-public-content min-h-[200px] text-foreground leading-relaxed break-words" v-html="note.content">
          </div>
        </div>
      </article>
    </div>
  </PublicLayout>
</template>

<style scoped>
.note-public-content :deep(h1) {
  font-size: 1.8em;
  font-weight: 800;
  margin-top: 1.2em;
  margin-bottom: 0.6em;
  color: hsl(var(--foreground));
}

.note-public-content :deep(h2) {
  font-size: 1.5em;
  font-weight: 700;
  margin-top: 1.2em;
  margin-bottom: 0.6em;
  color: hsl(var(--foreground));
}

.note-public-content :deep(h3) {
  font-size: 1.25em;
  font-weight: 600;
  margin-top: 1.2em;
  margin-bottom: 0.6em;
  color: hsl(var(--foreground));
}

.note-public-content :deep(p) {
  margin-top: 0.8em;
  margin-bottom: 0.8em;
  color: hsl(var(--foreground) / 0.9);
}

.note-public-content :deep(ul) {
  list-style-type: disc;
  padding-left: 1.5em;
  margin-top: 0.8em;
  margin-bottom: 0.8em;
}

.note-public-content :deep(ol) {
  list-style-type: decimal;
  padding-left: 1.5em;
  margin-top: 0.8em;
  margin-bottom: 0.8em;
}

.note-public-content :deep(li) {
  margin-top: 0.4em;
  margin-bottom: 0.4em;
}

.note-public-content :deep(a) {
  color: hsl(var(--primary));
  text-decoration: underline;
}

.note-public-content :deep(blockquote) {
  border-left: 4px solid hsl(var(--primary) / 0.5);
  padding-left: 1em;
  margin: 1em 0;
  color: hsl(var(--muted-foreground));
  font-style: italic;
}

.note-public-content :deep(pre) {
  background-color: hsl(var(--muted) / 0.5);
  border: 1px solid hsl(var(--border));
  padding: 1em;
  border-radius: 0.5rem;
  overflow-x: auto;
  font-family: monospace;
  margin: 1em 0;
}

.note-public-content :deep(code) {
  font-family: monospace;
  background-color: hsl(var(--muted));
  padding: 0.2em 0.4em;
  border-radius: 0.25rem;
  font-size: 0.85em;
}

.note-public-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 0.5rem;
  margin: 1.5em 0;
}
</style>
