<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';

const router = useRouter();
const auth = useAuthStore();

const code = ref('');
const error = ref('');
const loading = ref(false);

onMounted(() => {
  if (!auth.pendingTwoFactor) {
    router.replace('/login');
  }
});

async function submit() {
  if (code.value.length !== 6) {
    error.value = 'Enter a 6-digit code.';
    return;
  }
  error.value = '';
  loading.value = true;
  try {
    await auth.verifyTwoFactor(code.value);
    router.push('/notes');
  } catch (e: any) {
    error.value = e.response?.data?.message || 'Invalid code. Please try again.';
    code.value = '';
  } finally {
    loading.value = false;
  }
}

function goBack() {
  auth.cancelTwoFactor();
  router.push('/login');
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="w-full max-w-sm bg-white rounded-2xl shadow-sm p-8">
      <h1 class="text-2xl font-bold text-gray-900 mb-1">Two-Factor Auth</h1>
      <p class="text-sm text-gray-500 mb-6">
        Enter the 6-digit code from your authenticator app.
      </p>

      <form @submit.prevent="submit" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Code</label>
          <input
            v-model="code"
            type="text"
            maxlength="6"
            inputmode="numeric"
            pattern="[0-9]*"
            autocomplete="one-time-code"
            placeholder="000000"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-center text-xl tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

        <button
          type="submit"
          :disabled="loading"
          class="w-full bg-primary-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {{ loading ? 'Verifying…' : 'Verify' }}
        </button>

        <button
          type="button"
          @click="goBack"
          class="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          Back to login
        </button>
      </form>
    </div>
  </div>
</template>
