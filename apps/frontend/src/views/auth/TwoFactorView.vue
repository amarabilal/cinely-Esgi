<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import AuthLayout from '@/components/layout/AuthLayout.vue';
import { Button } from '@/components/ui/button';

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
  <AuthLayout
    title="Two-Factor Auth"
    subtitle="Enter the 6-digit code from your authenticator app."
  >
    <form @submit.prevent="submit" class="space-y-4">
      <div class="space-y-1.5">
        <label for="code" class="text-sm font-medium text-foreground">Code</label>
        <input
          id="code"
          v-model="code"
          type="text"
          maxlength="6"
          inputmode="numeric"
          pattern="[0-9]*"
          autocomplete="one-time-code"
          placeholder="000000"
          class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-center text-xl tracking-[0.5em] shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        />
      </div>

      <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

      <Button type="submit" :disabled="loading" class="w-full">
        {{ loading ? 'Verifying…' : 'Verify' }}
      </Button>

      <Button type="button" variant="ghost" class="w-full" @click="goBack">
        Back to login
      </Button>
    </form>
  </AuthLayout>
</template>
