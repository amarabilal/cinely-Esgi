<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Toaster } from 'vue-sonner';
import AppTopBar from '@/components/app/AppTopBar.vue';
import AppSidebar from '@/components/app/AppSidebar.vue';
import MobileTabBar from '@/components/app/MobileTabBar.vue';
import CommandPalette from '@/components/app/CommandPalette.vue';
import { useAuthStore } from '@/stores/auth.store';
import { useNotesStore } from '@/stores/notes.store';
import { usePush } from '@/composables/usePush';

const SIDEBAR_KEY = 'cinely-sidebar-collapsed';

const router = useRouter();
const auth = useAuthStore();
const store = useNotesStore();

const commandOpen = ref(false);
const sidebarCollapsed = ref(false);

onMounted(async () => {
  try {
    const raw = localStorage.getItem(SIDEBAR_KEY);
    if (raw !== null) sidebarCollapsed.value = raw === 'true';
  } catch {  }

  if (!auth.user) await auth.fetchMe().catch(() => { void auth.clearAuth(); });
  await Promise.all([store.fetchFolders(), store.fetchTags()]);

  void usePush().initPush(router);
});

watch(sidebarCollapsed, (value) => {
  try {
    localStorage.setItem(SIDEBAR_KEY, String(value));
  } catch {  }
});

async function newNote() {
  const n = await store.createNote();
  void router.push('/notes/' + n.id);
}

async function logout() {

  await usePush().disablePush();
  await auth.logout();
  void router.push('/login');
}
</script>

<template>
  <div class="min-h-screen bg-background text-foreground antialiased">
    <AppTopBar
      @open-command="commandOpen = true"
      @new-note="newNote"
      @logout="logout"
    />

    <div class="flex h-[calc(100dvh-3rem)] min-h-0">
      <AppSidebar
        v-model:collapsed="sidebarCollapsed"
        class="hidden md:flex"
        @new-note="newNote"
        @logout="logout"
      />
      <main class="min-w-0 flex-1 overflow-hidden">

        <router-view v-slot="{ Component }">
          <component
            :is="Component"
            class="h-full pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0"
          />
        </router-view>
      </main>
    </div>

    <MobileTabBar class="md:hidden" @new-note="newNote" />

    <CommandPalette v-model:open="commandOpen" />
    <Toaster rich-colors position="bottom-right" />
  </div>
</template>
