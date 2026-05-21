<script setup lang="ts">
const sections = [
  {
    icon: '📝',
    title: 'Rich Text Editor',
    items: [
      'WYSIWYG editing powered by Tiptap',
      'Headings H1–H3, bold, italic, strikethrough',
      'Bullet lists, ordered lists, code blocks',
      'Autosave every 1.5 seconds with status indicator',
    ],
  },
  {
    icon: '🤝',
    title: 'Real-Time Collaboration',
    items: [
      'Share notes with read or write permissions',
      'See collaborator cursors in real time (colored, named)',
      'Changes sync instantly via WebSocket',
      'Owner can change or revoke permissions live',
    ],
  },
  {
    icon: '📜',
    title: 'Version History',
    items: [
      'Automatic versioning with 60-second throttle',
      'Browse all past versions in a side panel',
      'Restore any version with one click',
      'Current state is preserved before restore',
    ],
  },
  {
    icon: '🔐',
    title: 'Security',
    items: [
      'Argon2id password hashing',
      'JWT access tokens (15 min) + opaque refresh tokens (7 days)',
      'TOTP 2FA without external dependency',
      '8 recovery codes generated on 2FA enable',
    ],
  },
  {
    icon: '🔍',
    title: 'Search & Organization',
    items: [
      'Full-text search across title and content (ILIKE)',
      'Debounced search with 300ms delay',
      'Organize with colored tags and folders',
      'Favorites and archive for quick access',
    ],
  },
  {
    icon: '⚙️',
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
  <div class="min-h-screen bg-white">
    <nav class="border-b border-gray-100 px-6 py-4 flex items-center gap-6 max-w-6xl mx-auto">
      <router-link to="/" class="text-xl font-bold text-primary-600">Notes</router-link>
      <router-link to="/security" class="text-sm text-gray-500 hover:text-gray-900">Security</router-link>
      <div class="ml-auto flex gap-3">
        <router-link to="/login" class="text-sm text-gray-600 hover:text-gray-900">Login</router-link>
        <router-link to="/register"
          class="bg-primary-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors">
          Get started
        </router-link>
      </div>
    </nav>

    <div class="max-w-4xl mx-auto py-16 px-6">
      <h1 class="text-4xl font-bold text-gray-900 mb-4">Features</h1>
      <p class="text-lg text-gray-500 mb-16">Everything you need to capture, organize, and collaborate on your notes.</p>

      <div class="space-y-12">
        <div v-for="s in sections" :key="s.title" class="border border-gray-100 rounded-2xl p-8">
          <div class="flex items-center gap-3 mb-4">
            <span class="text-3xl">{{ s.icon }}</span>
            <h2 class="text-xl font-semibold text-gray-900">{{ s.title }}</h2>
          </div>
          <ul class="space-y-2">
            <li v-for="item in s.items" :key="item" class="flex items-start gap-2 text-sm text-gray-600">
              <span class="text-green-500 mt-0.5 shrink-0">✓</span>
              {{ item }}
            </li>
          </ul>
        </div>
      </div>
    </div>

    <footer class="border-t border-gray-100 py-6 px-6 text-center">
      <div class="flex justify-center gap-6">
        <router-link to="/legal/cgu" class="text-sm text-gray-400 hover:text-gray-600">CGU</router-link>
        <router-link to="/legal/politique-confidentialite" class="text-sm text-gray-400 hover:text-gray-600">Privacy</router-link>
        <router-link to="/contact" class="text-sm text-gray-400 hover:text-gray-600">Contact</router-link>
      </div>
    </footer>
  </div>
</template>
