<script setup lang="ts">
import { ref } from 'vue';

const name = ref('');
const email = ref('');
const message = ref('');
const sent = ref(false);

function submit() {
  // Static form — no backend endpoint. Shown as-is for SEO / demo purposes.
  sent.value = true;
}
</script>

<template>
  <div class="min-h-screen bg-white">
    <nav class="border-b border-gray-100 px-6 py-4 flex items-center gap-6 max-w-6xl mx-auto">
      <router-link to="/" class="text-xl font-bold text-primary-600">Notes</router-link>
      <div class="ml-auto flex gap-3">
        <router-link to="/login" class="text-sm text-gray-600 hover:text-gray-900">Login</router-link>
        <router-link to="/register"
          class="bg-primary-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors">
          Get started
        </router-link>
      </div>
    </nav>

    <div class="max-w-xl mx-auto py-16 px-6">
      <h1 class="text-4xl font-bold text-gray-900 mb-4">Contact</h1>
      <p class="text-gray-500 mb-10">Have a question or feedback? Send us a message.</p>

      <div v-if="sent" class="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
        <p class="text-green-700 font-medium">Message sent!</p>
        <p class="text-sm text-green-600 mt-1">We'll get back to you as soon as possible.</p>
      </div>

      <form v-else @submit.prevent="submit" class="space-y-5">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input v-model="name" type="text" required
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input v-model="email" type="email" required
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Message</label>
          <textarea v-model="message" rows="5" required
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"></textarea>
        </div>
        <button type="submit"
          class="w-full bg-primary-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-primary-700 transition-colors">
          Send message
        </button>
      </form>
    </div>

    <footer class="border-t border-gray-100 py-6 px-6 text-center">
      <div class="flex justify-center gap-6">
        <router-link to="/legal/cgu" class="text-sm text-gray-400 hover:text-gray-600">CGU</router-link>
        <router-link to="/legal/politique-confidentialite" class="text-sm text-gray-400 hover:text-gray-600">Privacy</router-link>
      </div>
    </footer>
  </div>
</template>
