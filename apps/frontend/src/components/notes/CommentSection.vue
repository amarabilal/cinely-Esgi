<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { MessageSquare, Send, Trash2, CornerDownRight, X, Reply } from 'lucide-vue-next';
import { commentsApi, type Comment } from '@/api/comments.api';
import { Button } from '@/components/ui/button';
import { toast } from 'vue-sonner';
import { useAuthStore } from '@/stores/auth.store';

const props = defineProps<{
  noteId: string;
}>();

const authStore = useAuthStore();
const comments = ref<Comment[]>([]);
const loading = ref(false);
const newCommentContent = ref('');
const replyingToId = ref<string | null>(null);
const replyContent = ref('');

const currentUserId = computed(() => {

  return authStore.user?.id || '';
});

async function loadComments() {
  if (!props.noteId) return;
  loading.value = true;
  try {
    const response = await commentsApi.findByNoteId(props.noteId);
    comments.value = response.data;
  } catch (err: any) {
    console.error('Failed to load comments', err);
    toast.error('Impossible de charger les commentaires');
  } finally {
    loading.value = false;
  }
}

async function addComment() {
  if (!newCommentContent.value.trim()) return;
  try {
    const response = await commentsApi.create(props.noteId, {
      content: newCommentContent.value.trim(),
    });
    comments.value.push(response.data);
    newCommentContent.value = '';
    toast.success('Commentaire ajouté');
  } catch (err: any) {
    toast.error('Impossible d\'ajouter le commentaire');
  }
}

async function addReply(parentId: string) {
  if (!replyContent.value.trim()) return;
  try {
    const response = await commentsApi.create(props.noteId, {
      content: replyContent.value.trim(),
      parentId,
    });
    comments.value.push(response.data);
    replyContent.value = '';
    replyingToId.value = null;
    toast.success('Réponse ajoutée');
  } catch (err: any) {
    toast.error('Impossible d\'ajouter la réponse');
  }
}

async function deleteComment(commentId: string) {
  try {
    await commentsApi.remove(props.noteId, commentId);

    comments.value = comments.value.filter(
      (c) => c.id !== commentId && c.parentId !== commentId
    );
    toast.success('Commentaire supprimé');
  } catch (err: any) {
    toast.error('Impossible de supprimer le commentaire');
  }
}

const rootComments = computed(() => {
  return comments.value.filter((c) => !c.parentId);
});

const getReplies = (parentId: string) => {
  return comments.value.filter((c) => c.parentId === parentId);
};

function getUserInitials(firstName?: string, lastName?: string) {
  if (!firstName && !lastName) return 'U';
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

watch(
  () => props.noteId,
  () => {
    loadComments();
  },
  { immediate: true }
);
</script>

<template>
  <div class="flex h-full flex-col bg-card border-l border-border w-80 sm:w-96 shadow-lg">

    <div class="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/20">
      <div class="flex items-center gap-2 font-medium text-foreground">
        <MessageSquare class="size-4 text-primary" />
        <span>Commentaires</span>
        <span class="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary font-bold">
          {{ comments.length }}
        </span>
      </div>
      <slot name="close-button"></slot>
    </div>

    <div class="flex-1 overflow-y-auto p-4 space-y-4">
      <div v-if="loading" class="flex flex-col items-center justify-center py-12 space-y-2">
        <div class="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
        <span class="text-xs text-muted-foreground">Chargement...</span>
      </div>

      <div v-else-if="comments.length === 0" class="text-center py-12 text-sm text-muted-foreground">
        <MessageSquare class="mx-auto size-8 text-muted-foreground/60 mb-2" />
        Aucun commentaire. Soyez le premier à réagir !
      </div>

      <div v-else class="space-y-4">
        <div v-for="comment in rootComments" :key="comment.id" class="space-y-3">

          <div class="group relative flex gap-3 rounded-lg border border-border/60 bg-muted/10 p-3 hover:bg-muted/20 transition-all duration-150">

            <div class="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold">
              {{ getUserInitials(comment.user?.firstName, comment.user?.lastName) }}
            </div>

            <div class="flex-1 space-y-1">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-foreground">
                  {{ comment.user?.firstName }} {{ comment.user?.lastName }}
                </span>
                <span class="text-[10px] text-muted-foreground">
                  {{ formatDate(comment.createdAt) }}
                </span>
              </div>
              <p class="text-sm text-muted-foreground leading-normal whitespace-pre-line">{{ comment.content }}</p>

              <div class="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  class="flex items-center gap-1 text-[11px] text-primary/80 hover:text-primary transition-colors"
                  @click="replyingToId = replyingToId === comment.id ? null : comment.id"
                >
                  <Reply class="size-3" />
                  Répondre
                </button>
                <button
                  v-if="comment.userId === currentUserId"
                  type="button"
                  class="flex items-center gap-1 text-[11px] text-destructive/80 hover:text-destructive transition-colors ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                  @click="deleteComment(comment.id)"
                >
                  <Trash2 class="size-3" />
                  Supprimer
                </button>
              </div>
            </div>
          </div>

          <div v-if="getReplies(comment.id).length > 0" class="pl-6 space-y-2 border-l-2 border-muted/50 ml-3">
            <div
              v-for="reply in getReplies(comment.id)"
              :key="reply.id"
              class="group/reply relative flex gap-3 rounded-lg border border-border/40 bg-muted/5 p-2.5 hover:bg-muted/10 transition-all duration-150"
            >

              <CornerDownRight class="absolute -left-5 top-3.5 size-3.5 text-muted-foreground/60" />

              <div class="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                {{ getUserInitials(reply.user?.firstName, reply.user?.lastName) }}
              </div>
              <div class="flex-1 space-y-1">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-semibold text-foreground">
                    {{ reply.user?.firstName }} {{ reply.user?.lastName }}
                  </span>
                  <span class="text-[10px] text-muted-foreground font-mono">
                    {{ formatDate(reply.createdAt) }}
                  </span>
                </div>
                <p class="text-xs text-muted-foreground leading-normal whitespace-pre-line">{{ reply.content }}</p>
                <div v-if="reply.userId === currentUserId" class="flex justify-end pt-0.5">
                  <button
                    type="button"
                    class="flex items-center gap-1 text-[10px] text-destructive/80 hover:text-destructive opacity-0 group-hover/reply:opacity-100 transition-opacity"
                    @click="deleteComment(reply.id)"
                  >
                    <Trash2 class="size-2.5" />
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div v-if="replyingToId === comment.id" class="pl-6 ml-3 mt-1.5 flex gap-2">
            <input
              v-model="replyContent"
              type="text"
              placeholder="Écrire une réponse..."
              class="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1"
              @keydown.enter="addReply(comment.id)"
            />
            <Button size="icon" class="h-8 w-8 shrink-0" @click="addReply(comment.id)">
              <Send class="size-3.5" />
            </Button>
            <Button size="icon" variant="ghost" class="h-8 w-8 shrink-0 text-muted-foreground" @click="replyingToId = null">
              <X class="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>

    <div class="border-t border-border p-3 bg-muted/10">
      <div class="flex gap-2">
        <textarea
          v-model="newCommentContent"
          placeholder="Ajouter un commentaire..."
          rows="1"
          class="flex min-h-[38px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 resize-none overflow-y-hidden"
          @keydown.enter.prevent="addComment"
        ></textarea>
        <Button size="icon" class="h-[38px] w-[38px] shrink-0" @click="addComment">
          <Send class="size-4" />
        </Button>
      </div>
    </div>
  </div>
</template>
