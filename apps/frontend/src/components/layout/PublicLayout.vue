<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { Sparkles } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import ThemeToggle from '@/components/ThemeToggle.vue';
import { useAuthStore } from '@/stores/auth.store';

const auth = useAuthStore();

const nav = [
  { to: '/features', label: 'Features' },
  { to: '/security', label: 'Security' },
  { to: '/contact', label: 'Contact' },
];

const legal = [
  { to: '/legal/cgu', label: 'Terms' },
  { to: '/legal/politique-confidentialite', label: 'Privacy' },
  { to: '/legal/cookies', label: 'Cookies' },
  { to: '/contact', label: 'Contact' },
];
</script>

<template>
  <div class="flex min-h-screen flex-col bg-background text-foreground">
    <header class="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div class="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-6">
        <RouterLink to="/" class="flex items-center gap-2 font-semibold tracking-tight">
          <Sparkles class="size-5 text-primary" />
          <span>Cinely</span>
        </RouterLink>

        <nav class="hidden items-center gap-1 md:flex">
          <RouterLink
            v-for="n in nav"
            :key="n.to"
            :to="n.to"
            class="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            active-class="text-foreground"
          >{{ n.label }}</RouterLink>
        </nav>

        <div class="flex items-center gap-2">
          <ThemeToggle />
          <template v-if="auth.isAuthenticated">
            <Button to="/notes" size="sm">Open app</Button>
          </template>
          <template v-else>
            <Button to="/login" variant="ghost" size="sm" class="hidden sm:inline-flex">Sign in</Button>
            <Button to="/register" size="sm">Get started</Button>
          </template>
        </div>
      </div>
    </header>

    <main class="flex-1">
      <slot />
    </main>

    <footer class="border-t border-border/60">
      <div class="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground md:flex-row">
        <div class="flex items-center gap-2">
          <Sparkles class="size-4 text-primary" />
          <span>© 2026 Cinely. All rights reserved.</span>
        </div>
        <div class="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <RouterLink
            v-for="l in legal"
            :key="l.to + l.label"
            :to="l.to"
            class="transition-colors hover:text-foreground"
          >{{ l.label }}</RouterLink>
        </div>
      </div>
    </footer>
  </div>
</template>
