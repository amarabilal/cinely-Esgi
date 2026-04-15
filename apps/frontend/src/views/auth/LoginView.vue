<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';

const router = useRouter();
const auth = useAuthStore();

const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    const result = await auth.login({ email: email.value, password: password.value });
    if (result.twoFactorRequired) {
      router.push('/2fa');
    } else {
      router.push('/notes');
    }
  } catch (e: any) {
    const status = e.response?.status;
    const msg = e.response?.data?.message;

    if (status === 403 && msg === 'PASSWORD_EXPIRED') {
      error.value = 'Your password has expired. Please reset it.';
    } else if (status === 403) {
      error.value = msg || 'Account is temporarily locked.';
    } else {
      error.value = 'Invalid email or password.';
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="w-full max-w-md bg-white rounded-2xl shadow-sm p-8">
      <h1 class="text-2xl font-bold text-gray-900 mb-1">Sign in</h1>
      <p class="text-sm text-gray-500 mb-6">
        No account?
        <router-link to="/register" class="text-primary-600 hover:underline">Create one</router-link>
      </p>

      <form @submit.prevent="submit" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            v-model="email"
            type="email"
            required
            autocomplete="email"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div class="flex justify-end">
          <router-link to="/forgot-password" class="text-xs text-primary-600 hover:underline">Forgot password?</router-link>
        </div>

        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

        <button
          type="submit"
          :disabled="loading"
          class="w-full bg-primary-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {{ loading ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
    </div>
  </div>
</template>
