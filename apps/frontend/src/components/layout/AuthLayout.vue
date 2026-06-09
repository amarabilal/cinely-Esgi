<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { Sparkles } from 'lucide-vue-next';
import ThemeToggle from '@/components/ThemeToggle.vue';

defineProps<{
  title: string;
  subtitle?: string;
}>();
</script>

<template>
  <div class="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10 text-foreground">
    <div class="absolute right-4 top-4">
      <ThemeToggle />
    </div>

    <RouterLink to="/" class="mb-6 flex items-center gap-2 text-lg font-semibold tracking-tight">
      <Sparkles class="size-5 text-primary" />
      <span>Cinely</span>
    </RouterLink>

    <div class="w-full max-w-md rounded-xl border border-border bg-card p-8 text-card-foreground shadow-sm">
      <div class="mb-6 space-y-1">
        <h1 class="text-2xl font-semibold tracking-tight">{{ title }}</h1>
        <p v-if="subtitle || $slots.subtitle" class="text-sm text-muted-foreground">
          <slot name="subtitle">{{ subtitle }}</slot>
        </p>
      </div>
      <slot />
    </div>

    <div class="mt-6 text-xs text-muted-foreground">
      <slot name="footer" />
    </div>
  </div>
</template>
