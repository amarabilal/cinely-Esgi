<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { Bell, Trash2, Check, Inbox } from 'lucide-vue-next';
import { useNotificationsStore } from '@/stores/notifications.store';
import { Button } from '@/components/ui/button';
import { useNoteSync } from '@/composables/useNoteSync';
import { toast } from 'vue-sonner';

const router = useRouter();
const store = useNotificationsStore();
const noteSync = useNoteSync();

const isOpen = ref(false);
const containerRef = ref<HTMLElement | null>(null);

function toggle() {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    store.fetchNotifications();
  }
}

function close() {
  isOpen.value = false;
}

async function handleNotificationClick(n: any) {
  if (!n.read) {
    await store.markAsRead(n.id);
  }
  close();
  if (n.metadata?.noteId) {
    router.push(`/notes/${n.metadata.noteId}`);
  }
}

async function handleDelete(event: Event, id: string) {
  event.stopPropagation();
  try {
    await store.deleteNotification(id);
    toast.success('Notification supprimée');
  } catch (err: any) {
    toast.error('Erreur lors de la suppression', { description: err.message });
  }
}

async function handleMarkAllAsRead() {
  try {
    await store.markAllAsRead();
    toast.success('Toutes les notifications ont été lues');
  } catch (err: any) {
    toast.error('Erreur', { description: err.message });
  }
}

function handleClickOutside(event: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    close();
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  store.fetchNotifications();

  const token = localStorage.getItem('accessToken');
  if (token) {
    noteSync.connect(token);
    noteSync.onNotificationNew((payload) => {
      store.addNotification(payload);
      toast.info(payload.message, {
        action: payload.metadata?.noteId ? {
          label: 'Voir',
          onClick: () => router.push(`/notes/${payload.metadata?.noteId}`),
        } : undefined,
      });
    });
  }
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <div ref="containerRef" class="relative">
    <Button
      variant="ghost"
      size="icon"
      class="relative size-9 rounded-full"
      aria-label="Notifications"
      @click="toggle"
    >
      <Bell class="size-4 text-muted-foreground" />
      <span
        v-if="store.unreadCount > 0"
        class="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white shadow-sm"
      >
        {{ store.unreadCount }}
      </span>
    </Button>

    <Transition name="dropdown">
      <div
        v-if="isOpen"
        class="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
      >

        <div class="flex items-center justify-between border-b border-border bg-muted/20 px-4 py-2.5">
          <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notifications</span>
          <button
            v-if="store.unreadCount > 0"
            type="button"
            class="text-xs font-medium text-primary hover:underline"
            @click="handleMarkAllAsRead"
          >
            Tout marquer comme lu
          </button>
        </div>

        <div class="max-h-72 overflow-y-auto divide-y divide-border scrollbar-thin">
          <div v-if="store.notifications.length === 0" class="flex flex-col items-center justify-center p-8 text-center">
            <Inbox class="size-8 text-muted-foreground/50 mb-2" />
            <span class="text-sm font-medium text-muted-foreground">Aucune notification</span>
          </div>
          <template v-else>
            <div
              v-for="n in store.notifications"
              :key="n.id"
              class="group relative flex cursor-pointer gap-2 p-3 text-left transition-colors hover:bg-accent/40"
              :class="!n.read ? 'bg-primary/5 hover:bg-primary/10' : ''"
              @click="handleNotificationClick(n)"
            >
              <div class="flex-1 min-w-0 pr-6">
                <p class="text-xs text-foreground/90 leading-normal" :class="!n.read ? 'font-semibold' : ''">
                  {{ n.message }}
                </p>
                <span class="text-[10px] text-muted-foreground block mt-1">
                  {{ new Date(n.createdAt).toLocaleDateString() }} à {{ new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
                </span>
              </div>

              <span
                v-if="!n.read"
                class="absolute right-3 top-4 size-2 rounded-full bg-primary"
                title="Non lu"
              />

              <button
                type="button"
                class="absolute bottom-2.5 right-3 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                title="Supprimer"
                @click="handleDelete($event, n.id)"
              >
                <Trash2 class="size-3.5" />
              </button>
            </div>
          </template>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
  transition:
    opacity 0.14s ease,
    transform 0.14s ease;
  transform-origin: top right;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}
</style>
