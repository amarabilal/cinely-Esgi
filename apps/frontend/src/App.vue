<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sun, Moon, Sparkles } from 'lucide-vue-next';
import { useColorMode } from '@/composables/useColorMode';
import CookieConsent from '@/components/CookieConsent.vue';

const { mode, toggle } = useColorMode();
</script>

<template>
  <div class="min-h-screen bg-background text-foreground antialiased">
    <header class="border-b">
      <div class="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <div class="flex items-center gap-2 font-semibold tracking-tight">
          <Sparkles class="size-5 text-primary" />
          <span>Cinely</span>
        </div>
        <Button variant="ghost" size="icon" @click="toggle" :title="mode === 'dark' ? 'Switch to light' : 'Switch to dark'">
          <Sun v-if="mode === 'dark'" class="size-4" />
          <Moon v-else class="size-4" />
        </Button>
      </div>
    </header>

    <main class="mx-auto max-w-5xl px-6 py-10">
      <section class="mb-10 space-y-3">
        <p class="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Design system</p>
        <h1 class="text-4xl font-bold tracking-tight">Welcome to Cinely</h1>
        <p class="max-w-prose text-muted-foreground">
          This page is wired with the cluster-offline design system: HSL color tokens, Inter + JetBrains Mono,
          shadcn-vue primitives, dark mode, prose styles, and the smooth theme transition.
        </p>
        <div class="flex flex-wrap gap-2 pt-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
        </div>
        <div class="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
        </div>
      </section>

      <section class="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Color tokens</CardTitle>
            <CardDescription>HSL CSS vars, light + dark</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="grid grid-cols-4 gap-2">
              <div class="h-10 rounded-md bg-background border" title="background" />
              <div class="h-10 rounded-md bg-foreground" title="foreground" />
              <div class="h-10 rounded-md bg-primary" title="primary" />
              <div class="h-10 rounded-md bg-secondary" title="secondary" />
              <div class="h-10 rounded-md bg-muted" title="muted" />
              <div class="h-10 rounded-md bg-accent" title="accent" />
              <div class="h-10 rounded-md bg-destructive" title="destructive" />
              <div class="h-10 rounded-md border-2 border-border" title="border" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Typography</CardTitle>
            <CardDescription>Inter + JetBrains Mono</CardDescription>
          </CardHeader>
          <CardContent class="space-y-2 text-sm">
            <p class="font-sans">The quick brown fox jumps over the lazy dog.</p>
            <p class="font-mono">{{ '{ user_id: "abc-123" }' }}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Prose</CardTitle>
            <CardDescription>Notes-style content</CardDescription>
          </CardHeader>
          <CardContent>
            <article class="prose prose-zinc dark:prose-invert max-w-none text-sm">
              <h3>Heading</h3>
              <p>Tables, checklists, code: all consistent with cluster-offline's look.</p>
            </article>
          </CardContent>
        </Card>
      </section>

      <router-view class="mt-10" />
    </main>
    <CookieConsent />
  </div>
</template>
