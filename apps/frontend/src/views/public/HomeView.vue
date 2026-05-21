<script setup lang="ts">
import { useAuthStore } from '@/stores/auth.store';

const auth = useAuthStore();

const features = [
  { icon: '📝', title: 'Rich text editor', description: 'Write with a powerful WYSIWYG editor supporting headings, lists, code blocks, and more.' },
  { icon: '🤝', title: 'Real-time collaboration', description: 'See collaborators\' cursors and edits live. Share notes with read or write permissions.' },
  { icon: '📜', title: 'Version history', description: 'Every change is saved automatically. Restore any previous version with one click.' },
  { icon: '🔐', title: 'Two-factor authentication', description: 'Protect your account with TOTP 2FA and recovery codes.' },
  { icon: '🔍', title: 'Full-text search', description: 'Find any note instantly by title or content across your entire library.' },
  { icon: '🏷️', title: 'Tags & folders', description: 'Organize your notes with colored tags and nested folders.' },
];
</script>

<template>
  <div class="min-h-screen bg-white">
    <!-- Nav -->
    <nav class="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
      <span class="text-xl font-bold text-primary-600">Notes</span>
      <div class="flex items-center gap-4">
        <router-link to="/features" class="text-sm text-gray-600 hover:text-gray-900">Features</router-link>
        <router-link to="/security" class="text-sm text-gray-600 hover:text-gray-900">Security</router-link>
        <router-link v-if="auth.isAuthenticated" to="/notes"
          class="bg-primary-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors">
          Go to App
        </router-link>
        <template v-else>
          <router-link to="/login" class="text-sm text-gray-600 hover:text-gray-900">Login</router-link>
          <router-link to="/register"
            class="bg-primary-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors">
            Get started
          </router-link>
        </template>
      </div>
    </nav>

    <!-- Hero -->
    <section class="max-w-4xl mx-auto text-center py-24 px-6">
      <h1 class="text-5xl font-bold text-gray-900 leading-tight mb-6">
        Your thoughts, organized.<br />
        <span class="text-primary-600">Secure and collaborative.</span>
      </h1>
      <p class="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
        A powerful note-taking app with real-time collaboration, version history,
        end-to-end security, and two-factor authentication.
      </p>
      <div class="flex items-center justify-center gap-4">
        <router-link to="/register"
          class="bg-primary-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-primary-700 transition-colors text-lg">
          Start for free
        </router-link>
        <router-link to="/features"
          class="border border-gray-200 text-gray-700 px-8 py-3 rounded-xl font-semibold hover:bg-gray-50 transition-colors text-lg">
          Learn more
        </router-link>
      </div>
    </section>

    <!-- Features grid -->
    <section class="bg-gray-50 py-20 px-6">
      <div class="max-w-5xl mx-auto">
        <h2 class="text-3xl font-bold text-gray-900 text-center mb-12">Everything you need</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div v-for="f in features" :key="f.title" class="bg-white rounded-2xl p-6 shadow-sm">
            <div class="text-3xl mb-4">{{ f.icon }}</div>
            <h3 class="text-lg font-semibold text-gray-900 mb-2">{{ f.title }}</h3>
            <p class="text-sm text-gray-500">{{ f.description }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="border-t border-gray-100 py-8 px-6">
      <div class="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <span class="text-sm text-gray-400">© 2026 Notes App. All rights reserved.</span>
        <div class="flex gap-6">
          <router-link to="/legal/cgu" class="text-sm text-gray-400 hover:text-gray-600">CGU</router-link>
          <router-link to="/legal/politique-confidentialite" class="text-sm text-gray-400 hover:text-gray-600">Privacy</router-link>
          <router-link to="/legal/cookies" class="text-sm text-gray-400 hover:text-gray-600">Cookies</router-link>
          <router-link to="/contact" class="text-sm text-gray-400 hover:text-gray-600">Contact</router-link>
        </div>
      </div>
    </footer>
  </div>
</template>
