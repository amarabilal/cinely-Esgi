<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useNotebooksStore } from '@/stores/notebooks.store';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Brain, Trash2, Plus, Sparkles, X } from 'lucide-vue-next';
import { toast } from 'vue-sonner';

const router = useRouter();
const store = useNotebooksStore();

const isCreateModalOpen = ref(false);
const newTitle = ref('');
const isSubmitting = ref(false);

onMounted(async () => {
  try {
    await store.fetchNotebooks();
  } catch (error) {
    toast.error('Failed to load notebooks');
  }
});

async function handleCreate() {
  const title = newTitle.value.trim();
  if (!title) return;
  
  isSubmitting.value = true;
  try {
    const notebook = await store.createNotebook(title);
    isCreateModalOpen.value = false;
    newTitle.value = '';
    toast.success('Notebook created');
    void router.push(`/notebooks/${notebook.id}`);
  } catch (error) {
    toast.error('Failed to create notebook');
  } finally {
    isSubmitting.value = false;
  }
}

async function handleDelete(id: string) {
  if (!confirm('Are you sure you want to delete this notebook? All chat history will be lost.')) return;
  try {
    await store.deleteNotebook(id);
    toast.success('Notebook deleted');
  } catch (error) {
    toast.error('Failed to delete notebook');
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
</script>

<template>
  <div class="h-full overflow-y-auto bg-background text-foreground scrollbar-thin">
    <div class="mx-auto max-w-5xl px-6 py-8">
      <!-- Page Header -->
      <header class="mb-8 flex items-center justify-between">
        <div>
          <p class="font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground">AI Studio</p>
          <h1 class="mt-1 text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Sparkles class="size-6 text-primary animate-pulse" />
            Deep Research Workspaces
          </h1>
        </div>
        <Button @click="isCreateModalOpen = true" class="gap-2 shadow-sm">
          <Plus class="size-4" />
          Create Workspace
        </Button>
      </header>

      <!-- Loading State -->
      <div v-if="store.isLoading && store.notebooks.length === 0" class="flex items-center justify-center h-64">
        <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>

      <!-- Empty State -->
      <div v-else-if="store.notebooks.length === 0" class="flex flex-col items-center justify-center border border-dashed rounded-xl p-12 text-center bg-card/30">
        <Brain class="size-12 text-muted-foreground mb-4 opacity-50" />
        <h3 class="text-lg font-semibold text-foreground">No workspaces yet</h3>
        <p class="text-sm text-muted-foreground max-w-sm mt-1 mb-6">
          Create a workspace to group your notes together and start chatting or generating FAQs, timelines, and study guides.
        </p>
        <Button @click="isCreateModalOpen = true" variant="secondary" class="gap-2">
          <Plus class="size-4" />
          Create your first workspace
        </Button>
      </div>

      <!-- Grid of Notebooks -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card
          v-for="notebook in store.notebooks"
          :key="notebook.id"
          class="group relative flex flex-col justify-between overflow-hidden border border-border p-5 bg-card hover:bg-accent/10 hover:border-primary/30 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5"
          @click="router.push(`/notebooks/${notebook.id}`)"
        >
          <div>
            <div class="flex items-center justify-between mb-4">
              <div class="rounded-lg bg-primary/10 p-2 text-primary group-hover:bg-primary/20 transition-colors">
                <Brain class="size-5" />
              </div>
              <Button
                variant="ghost"
                size="icon"
                class="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md opacity-0 group-hover:opacity-100 transition-all duration-200"
                title="Delete workspace"
                @click.stop="handleDelete(notebook.id)"
              >
                <Trash2 class="size-4" />
              </Button>
            </div>
            
            <h2 class="text-base font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
              {{ notebook.title }}
            </h2>
            <p class="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
              <span>{{ notebook.notes?.length || 0 }} source{{ (notebook.notes?.length || 0) !== 1 ? 's' : '' }}</span>
              <span class="text-border">•</span>
              <span>Updated {{ formatDate(notebook.updatedAt) }}</span>
            </p>
          </div>
          
          <div class="mt-6 border-t pt-3 flex items-center justify-end">
            <span class="text-xs font-semibold text-primary group-hover:translate-x-1 transition-transform flex items-center gap-1">
              Open Workspace
              <span class="text-sm">→</span>
            </span>
          </div>
        </Card>
      </div>
    </div>

    <!-- Create Dialog Modal -->
    <div v-if="isCreateModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs px-4" @click.self="isCreateModalOpen = false">
      <div class="w-full max-w-md bg-card border rounded-xl shadow-xl p-6 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <button @click="isCreateModalOpen = false" class="absolute right-4 top-4 text-muted-foreground hover:text-foreground hover:bg-muted p-1 rounded-md transition-colors">
          <X class="size-4" />
        </button>
        
        <h2 class="text-lg font-semibold text-foreground flex items-center gap-2">
          <Sparkles class="size-5 text-primary" />
          Create Research Workspace
        </h2>
        <p class="text-sm text-muted-foreground mt-1 mb-5">
          Enter a title for your workspace. You can add source notes once created.
        </p>

        <form @submit.prevent="handleCreate" class="space-y-4">
          <div>
            <label for="title" class="sr-only">Title</label>
            <input
              id="title"
              v-model="newTitle"
              type="text"
              required
              placeholder="e.g. History Exam Study Guide"
              class="w-full h-10 rounded-md border bg-background px-3 text-sm outline-none transition-all placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-transparent"
              :disabled="isSubmitting"
              v-focus
            />
          </div>
          
          <div class="flex justify-end gap-2.5">
            <Button type="button" variant="outline" @click="isCreateModalOpen = false" :disabled="isSubmitting">
              Cancel
            </Button>
            <Button type="submit" :disabled="!newTitle.trim() || isSubmitting" class="gap-2">
              <span v-if="isSubmitting" class="size-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></span>
              Create
            </Button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Focus directive setup helper */
</style>
