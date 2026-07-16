<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { LayoutDashboard, NotebookText, Plus, Search, Settings } from 'lucide-vue-next';

const emit = defineEmits<{ 'new-note': [] }>();

const route = useRoute();
const router = useRouter();

const notesActive = computed(() => {
  if (route.path === '/notes' || route.path === '/notes/archived') return true;
  if (route.name === 'note-editor') return true;
  return false;
});
const searchActive = computed(() => route.path === '/notes/search');
const dashboardActive = computed(() => route.path === '/dashboard');
const settingsActive = computed(() => route.path === '/settings');

function go(path: string) {
  if (route.path !== path) void router.push(path);
}

function tabClass(active: boolean) {
  return [
    'flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 transition-colors duration-150 active:scale-95',
    active ? 'text-primary' : 'text-muted-foreground',
  ];
}
</script>

<template>
  <nav class="fixed inset-x-0 bottom-0 z-40 md:hidden border-t border-border bg-background/95 backdrop-blur pb-safe">
    <div class="flex items-stretch">
      <button
        type="button"
        :class="tabClass(notesActive)"
        aria-label="Notes"
        :aria-current="notesActive ? 'page' : undefined"
        @click="go('/notes')"
      >
        <NotebookText class="size-5" />
        <span class="text-[10px] font-medium">Notes</span>
      </button>

      <button
        type="button"
        :class="tabClass(searchActive)"
        aria-label="Search"
        :aria-current="searchActive ? 'page' : undefined"
        @click="go('/notes/search')"
      >
        <Search class="size-5" />
        <span class="text-[10px] font-medium">Search</span>
      </button>

      <div class="flex flex-1 flex-col items-center justify-center">
        <button
          type="button"
          class="-mt-4 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform duration-150 active:scale-95"
          aria-label="New note"
          @click="emit('new-note')"
        >
          <Plus class="size-6" />
        </button>
      </div>

      <button
        type="button"
        :class="tabClass(dashboardActive)"
        aria-label="Dashboard"
        :aria-current="dashboardActive ? 'page' : undefined"
        @click="go('/dashboard')"
      >
        <LayoutDashboard class="size-5" />
        <span class="text-[10px] font-medium">Dashboard</span>
      </button>

      <button
        type="button"
        :class="tabClass(settingsActive)"
        aria-label="Settings"
        :aria-current="settingsActive ? 'page' : undefined"
        @click="go('/settings')"
      >
        <Settings class="size-5" />
        <span class="text-[10px] font-medium">Settings</span>
      </button>
    </div>
  </nav>
</template>
