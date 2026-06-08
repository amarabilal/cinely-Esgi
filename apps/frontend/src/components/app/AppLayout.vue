<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Plus } from 'lucide-vue-next';
import { Toaster } from 'vue-sonner';
import { Button } from '@/components/ui/button';
import AppTopBar from '@/components/app/AppTopBar.vue';
import AppSidebar from '@/components/app/AppSidebar.vue';
import CommandPalette from '@/components/app/CommandPalette.vue';
import { useAuthStore } from '@/stores/auth.store';
import { useNotesStore } from '@/stores/notes.store';

const SIDEBAR_KEY = 'cinely-sidebar-collapsed';

const router = useRouter();
const auth = useAuthStore();
const store = useNotesStore();

const commandOpen = ref(false);
const mobileSidebarOpen = ref(false);
const sidebarCollapsed = ref(false);

onMounted(async () => {
  try {
    const raw = localStorage.getItem(SIDEBAR_KEY);
    if (raw !== null) sidebarCollapsed.value = raw === 'true';
  } catch { /* ignore */ }

  if (!auth.user) await auth.fetchMe().catch(() => auth.clearAuth());
  await Promise.all([store.fetchFolders(), store.fetchTags()]);
});

watch(sidebarCollapsed, (value) => {
  try {
    localStorage.setItem(SIDEBAR_KEY, String(value));
  } catch { /* ignore */ }
});

async function newNote() {
  mobileSidebarOpen.value = false;
  const n = await store.createNote();
  void router.push('/notes/' + n.id);
}

async function logout() {
  mobileSidebarOpen.value = false;
  await auth.logout();
  void router.push('/login');
}
</script>

<template>
  <div class="min-h-screen bg-background text-foreground antialiased">
    <AppTopBar
      @toggle-sidebar="mobileSidebarOpen = true"
      @open-command="commandOpen = true"
      @new-note="newNote"
      @logout="logout"
    />

    <div class="flex h-[calc(100vh-3rem)] min-h-0">
      <AppSidebar
        v-model:collapsed="sidebarCollapsed"
        class="hidden md:flex"
        @new-note="newNote"
        @logout="logout"
      />
      <main class="min-w-0 flex-1 overflow-hidden">
        <router-view v-slot="{ Component }">
          <transition name="page" mode="out-in">
            <component :is="Component" class="h-full" />
          </transition>
        </router-view>
      </main>
    </div>

    <Teleport to="body">
      <div v-if="mobileSidebarOpen" class="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden" @click.self="mobileSidebarOpen = false">
        <AppSidebar
          v-model:collapsed="sidebarCollapsed"
          mobile
          class="h-full"
          @new-note="newNote"
          @logout="logout"
          @close="mobileSidebarOpen = false"
        />
      </div>
    </Teleport>

    <Button
      class="fixed bottom-4 right-4 z-30 shadow-lg md:hidden"
      size="icon"
      aria-label="New note"
      @click="newNote"
    >
      <Plus class="size-5" />
    </Button>

    <CommandPalette v-model:open="commandOpen" />
    <Toaster rich-colors position="bottom-right" />
  </div>
</template>
