<script setup lang="ts">
import PublicLayout from '@/components/layout/PublicLayout.vue';
import GetTheAppSection from '@/components/marketing/GetTheAppSection.vue';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileText, Users, History, ShieldCheck, Search, Tags } from 'lucide-vue-next';

const features = [
  { icon: FileText, title: 'Rich text editor', description: 'Write with a powerful WYSIWYG editor supporting headings, lists, code blocks, and more.' },
  { icon: Users, title: 'Real-time collaboration', description: 'See collaborators\' cursors and edits live. Share notes with read or write permissions.' },
  { icon: History, title: 'Version history', description: 'Every change is saved automatically. Restore any previous version with one click.' },
  { icon: ShieldCheck, title: 'Two-factor authentication', description: 'Protect your account with TOTP 2FA and recovery codes.' },
  { icon: Search, title: 'Full-text search', description: 'Find any note instantly by title or content across your entire library.' },
  { icon: Tags, title: 'Tags & folders', description: 'Organize your notes with colored tags and nested folders.' },
];
</script>

<template>
  <PublicLayout>
    <!-- Hero -->
    <section class="mx-auto max-w-4xl px-6 py-24 text-center sm:py-32">
      <h1 class="text-balance text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
        Your thoughts, organized.<br />
        <span class="text-primary">Secure and collaborative.</span>
      </h1>
      <p class="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground sm:text-xl">
        A powerful note-taking app with real-time collaboration, version history,
        end-to-end security, and two-factor authentication.
      </p>
      <div class="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <Button to="/register" size="lg">Start for free</Button>
        <Button to="/features" variant="outline" size="lg">Learn more</Button>
      </div>
    </section>

    <!-- Features grid -->
    <section class="border-t border-border/60 bg-muted/40 px-6 py-20">
      <div class="mx-auto max-w-5xl">
        <h2 class="text-center text-3xl font-bold tracking-tight text-foreground">Everything you need</h2>
        <div class="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card
            v-for="f in features"
            :key="f.title"
            class="transition-colors hover:border-primary/40"
          >
            <CardHeader>
              <div class="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/10">
                <component :is="f.icon" class="size-5 text-primary" />
              </div>
              <CardTitle>{{ f.title }}</CardTitle>
              <CardDescription>{{ f.description }}</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </section>

    <GetTheAppSection />
  </PublicLayout>
</template>
