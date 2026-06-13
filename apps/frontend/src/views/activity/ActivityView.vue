<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  Sparkles, FileText, Trash2, RotateCcw, Copy, Users, Clock, Inbox, ChevronRight,
} from 'lucide-vue-next';
import { activityApi, type ActivityItem } from '@/api/activity.api';
import { Button } from '@/components/ui/button';
import { toast } from 'vue-sonner';

const activities = ref<ActivityItem[]>([]);
const loading = ref(false);
const limit = 30;
const offset = ref(0);
const hasMore = ref(true);

async function loadActivities(append = false) {
  loading.value = true;
  try {
    const { data } = await activityApi.findAll(limit, offset.value);
    if (data.length < limit) {
      hasMore.value = false;
    }
    if (append) {
      activities.value = [...activities.value, ...data];
    } else {
      activities.value = data;
    }
  } catch (error: any) {
    toast.error("Erreur lors de la récupération de l'historique", { description: error.message });
  } finally {
    loading.value = false;
  }
}

function loadMore() {
  if (loading.value || !hasMore.value) return;
  offset.value += limit;
  loadActivities(true);
}

function getActionStyle(action: string) {
  switch (action) {
    case 'CREATE':
      return { icon: Sparkles, color: 'text-green-500 bg-green-500/10 border-green-500/20', label: 'Création' };
    case 'EDIT':
      return { icon: FileText, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20', label: 'Modification' };
    case 'DELETE':
      return { icon: Trash2, color: 'text-red-500 bg-red-500/10 border-red-500/20', label: 'Suppression' };
    case 'RESTORE':
      return { icon: RotateCcw, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20', label: 'Restauration' };
    case 'DUPLICATE':
      return { icon: Copy, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20', label: 'Duplication' };
    case 'SHARE':
      return { icon: Users, color: 'text-purple-500 bg-purple-500/10 border-purple-500/20', label: 'Partage' };
    default:
      return { icon: Clock, color: 'text-muted-foreground bg-muted/20 border-border', label: 'Activité' };
  }
}

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffHour < 24) return `Il y a ${diffHour} h`;
  if (diffDay === 1) return 'Hier';
  return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

onMounted(() => {
  loadActivities();
});
</script>

<template>
  <div class="flex h-full flex-col bg-background p-6 overflow-hidden">
    <!-- Header -->
    <div class="mb-6 shrink-0">
      <h1 class="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
        <Clock class="size-6 text-primary" />
        Journal d'activité
      </h1>
      <p class="text-sm text-muted-foreground mt-1">
        Historique d'audit des actions effectuées sur vos notes et vos dossiers.
      </p>
    </div>

    <!-- Main Content Area -->
    <div class="flex-1 overflow-y-auto scrollbar-thin rounded-xl border border-border bg-card shadow-sm p-6">
      <div v-if="activities.length === 0 && !loading" class="flex flex-col items-center justify-center py-20 text-center">
        <Inbox class="size-12 text-muted-foreground/45 mb-4 animate-bounce" />
        <h3 class="text-base font-semibold text-foreground">Aucune activité enregistrée</h3>
        <p class="text-sm text-muted-foreground mt-1 max-w-xs">
          Les actions telles que la création, l'édition ou le partage de notes apparaîtront ici.
        </p>
      </div>

      <div v-else class="relative pl-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
        <div
          v-for="item in activities"
          :key="item.id"
          class="relative mb-6 last:mb-0 group"
        >
          <!-- Icon Badge Marker -->
          <div
            class="absolute -left-[27px] top-0 flex size-6 items-center justify-center rounded-full border shadow-sm transition-transform duration-200 group-hover:scale-110"
            :class="getActionStyle(item.action).color"
          >
            <component :is="getActionStyle(item.action).icon" class="size-3" />
          </div>

          <!-- Log Card -->
          <div class="rounded-lg border border-border/60 bg-muted/20 p-4 transition-colors hover:bg-muted/30">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0 flex-1">
                <span class="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider mb-1.5" :class="getActionStyle(item.action).color">
                  {{ getActionStyle(item.action).label }}
                </span>
                <p class="text-sm font-medium text-foreground leading-relaxed">
                  <!-- Custom log sentences -->
                  <template v-if="item.action === 'CREATE'">
                    Vous avez créé la note <span class="font-semibold text-primary">"{{ item.metadata?.title || 'Sans titre' }}"</span>.
                  </template>
                  <template v-else-if="item.action === 'EDIT'">
                    Vous avez modifié la note <span class="font-semibold text-primary">"{{ item.metadata?.title || 'Sans titre' }}"</span>.
                  </template>
                  <template v-else-if="item.action === 'DELETE'">
                    Vous avez supprimé la note <span class="font-semibold text-primary">"{{ item.metadata?.title || 'Sans titre' }}"</span>.
                  </template>
                  <template v-else-if="item.action === 'RESTORE'">
                    Vous avez restauré la note <span class="font-semibold text-primary">"{{ item.metadata?.title || 'Sans titre' }}"</span>.
                  </template>
                  <template v-else-if="item.action === 'DUPLICATE'">
                    Vous avez dupliqué la note <span class="font-semibold text-primary">"{{ item.metadata?.title || 'Sans titre' }}"</span>.
                  </template>
                  <template v-else-if="item.action === 'SHARE'">
                    Vous avez partagé la note <span class="font-semibold text-primary">"{{ item.metadata?.title || 'Sans titre' }}"</span> avec <code class="text-xs bg-muted border border-border px-1 py-0.5 rounded font-mono">{{ item.metadata?.sharedWithEmail }}</code> ({{ item.metadata?.permission }}).
                  </template>
                  <template v-else>
                    Action sur l'entité {{ item.entityType }} (ID: {{ item.entityId }}).
                  </template>
                </p>
              </div>
              <time class="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                {{ formatRelativeTime(item.createdAt) }}
              </time>
            </div>
          </div>
        </div>

        <!-- Load More Button -->
        <div v-if="hasMore" class="flex justify-center pt-4">
          <Button
            variant="outline"
            size="sm"
            class="gap-1.5"
            :disabled="loading"
            @click="loadMore"
          >
            {{ loading ? 'Chargement…' : 'Voir plus d\'activités' }}
            <ChevronRight class="size-4 rotate-90" />
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
