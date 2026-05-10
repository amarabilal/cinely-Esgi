<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { authApi } from '@/api/auth.api';

const route = useRoute();
const router = useRouter();

const status = ref<'loading' | 'success' | 'error'>('loading');
const errorMessage = ref('');

onMounted(async () => {
  const token = route.query.token as string;
  if (!token) {
    status.value = 'error';
    errorMessage.value = 'No verification token provided.';
    return;
  }
  try {
    await authApi.verifyEmail(token);
    status.value = 'success';
  } catch (e: any) {
    status.value = 'error';
    errorMessage.value = e.response?.data?.message || 'Invalid or expired verification link.';
  }
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-sm p-10 w-full max-w-md text-center">
      <div v-if="status === 'loading'" class="space-y-3">
        <div class="w-10 h-10 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p class="text-sm text-gray-500">Verifying your email…</p>
      </div>

      <div v-if="status === 'success'" class="space-y-4">
        <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <svg class="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 class="text-xl font-semibold text-gray-900">Email verified!</h1>
        <p class="text-sm text-gray-500">Your email address has been confirmed successfully.</p>
        <button @click="router.push('/notes')"
          class="w-full bg-primary-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-primary-700 transition-colors">
          Go to Notes
        </button>
      </div>

      <div v-if="status === 'error'" class="space-y-4">
        <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
          <svg class="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 class="text-xl font-semibold text-gray-900">Verification failed</h1>
        <p class="text-sm text-red-500">{{ errorMessage }}</p>
        <button @click="router.push('/login')"
          class="w-full border border-gray-200 text-gray-700 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors">
          Back to Login
        </button>
      </div>
    </div>
  </div>
</template>
