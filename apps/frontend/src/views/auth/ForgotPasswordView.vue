<script setup lang="ts">
import { ref } from 'vue';
import client from '@/api/client';

const email = ref('');
const sent = ref(false);
const loading = ref(false);
const error = ref('');

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    await client.post('/auth/forgot-password', { email: email.value });
    sent.value = true;
  } catch {
    error.value = 'Something went wrong. Please try again.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="w-full max-w-md bg-white rounded-2xl shadow-sm p-8">
      <h1 class="text-2xl font-bold text-gray-900 mb-1">Forgot password</h1>

      <div v-if="sent" class="text-sm text-green-600 bg-green-50 rounded-lg p-4 mt-4">
        If this email exists, a reset link has been sent. Check your inbox.
      </div>

      <template v-else>
        <p class="text-sm text-gray-500 mb-6">Enter your email and we'll send you a reset link.</p>
        <form @submit.prevent="submit" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              v-model="email"
              type="email"
              required
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
          <button
            type="submit"
            :disabled="loading"
            class="w-full bg-primary-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >{{ loading ? 'Sending…' : 'Send reset link' }}</button>
        </form>
      </template>

      <router-link to="/login" class="block text-center text-sm text-primary-600 hover:underline mt-4">
        Back to sign in
      </router-link>
    </div>
  </div>
</template>
