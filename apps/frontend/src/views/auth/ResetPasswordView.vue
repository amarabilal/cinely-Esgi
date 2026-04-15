<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import client from '@/api/client';

const route = useRoute();
const router = useRouter();
const token = ref('');
const password = ref('');
const done = ref(false);
const loading = ref(false);
const error = ref('');

const PASSWORD_REGEX = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/;

onMounted(() => {
  token.value = route.query.token as string || '';
  if (!token.value) router.push('/login');
});

async function submit() {
  error.value = '';
  if (password.value.length < 12 || !PASSWORD_REGEX.test(password.value)) {
    error.value = '12 characters minimum with letters, numbers and symbols.';
    return;
  }
  loading.value = true;
  try {
    await client.post('/auth/reset-password', { token: token.value, newPassword: password.value });
    done.value = true;
  } catch (e: any) {
    error.value = e.response?.data?.message || 'Invalid or expired link.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="w-full max-w-md bg-white rounded-2xl shadow-sm p-8">
      <h1 class="text-2xl font-bold text-gray-900 mb-4">Set a new password</h1>

      <div v-if="done" class="text-sm text-green-600 bg-green-50 rounded-lg p-4 mb-4">
        Password updated. <router-link to="/login" class="font-medium underline">Sign in</router-link>
      </div>

      <form v-else @submit.prevent="submit" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">New password</label>
          <input
            v-model="password"
            type="password"
            required
            autocomplete="new-password"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <p class="text-xs text-gray-400 mt-1">12 characters minimum with letters, numbers and symbols.</p>
        </div>
        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        <button
          type="submit"
          :disabled="loading"
          class="w-full bg-primary-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >{{ loading ? 'Updating…' : 'Update password' }}</button>
      </form>
    </div>
  </div>
</template>
