<script setup lang="ts">
import PublicLayout from '@/components/layout/PublicLayout.vue';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { FileText, Users, History, ShieldCheck, Search, Settings2, Check } from 'lucide-vue-next';

const sections = [
  {
    icon: FileText,
    title: 'Rich Text Editor',
    items: [
      'WYSIWYG editing powered by Tiptap',
      'Headings H1–H3, bold, italic, strikethrough',
      'Bullet lists, ordered lists, code blocks',
      'Autosave every 1.5 seconds with status indicator',
    ],
  },
  {
    icon: Users,
    title: 'Real-Time Collaboration',
    items: [
      'Share notes with read or write permissions',
      'See collaborator cursors in real time (colored, named)',
      'Changes sync instantly via WebSocket',
      'Owner can change or revoke permissions live',
    ],
  },
  {
    icon: History,
    title: 'Version History',
    items: [
      'Automatic versioning with 60-second throttle',
      'Browse all past versions in a side panel',
      'Restore any version with one click',
      'Current state is preserved before restore',
    ],
  },
  {
    icon: ShieldCheck,
    title: 'Security',
    items: [
      'Argon2id password hashing',
      'JWT access tokens (15 min) + opaque refresh tokens (7 days)',
      'TOTP 2FA without external dependency',
      '8 recovery codes generated on 2FA enable',
    ],
  },
  {
    icon: Search,
    title: 'Search & Organization',
    items: [
      'Full-text search across title and content (ILIKE)',
      'Debounced search with 300ms delay',
      'Organize with colored tags and folders',
      'Favorites and archive for quick access',
    ],
  },
  {
    icon: Settings2,
    title: 'Account Management',
    items: [
      'Email verification on registration',
      'Password reset via email link',
      'Active session management with revocation',
      'Mandatory password renewal every 60 days',
    ],
  },
];
</script>

<template>
  <PublicLayout>
    <div class="mx-auto max-w-4xl px-6 py-16 sm:py-20">
      <h1 class="text-4xl font-bold tracking-tight text-foreground">Features</h1>
      <p class="mt-4 text-lg text-muted-foreground">
        Everything you need to capture, organize, and collaborate on your notes.
      </p>

      <div class="mt-14 space-y-8">
        <Card v-for="s in sections" :key="s.title">
          <CardHeader>
            <div class="flex items-center gap-3">
              <div class="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                <component :is="s.icon" class="size-5 text-primary" />
              </div>
              <CardTitle class="text-xl">{{ s.title }}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul class="space-y-2.5">
              <li
                v-for="item in s.items"
                :key="item"
                class="flex items-start gap-2.5 text-sm text-muted-foreground"
              >
                <Check class="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{{ item }}</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  </PublicLayout>
</template>
