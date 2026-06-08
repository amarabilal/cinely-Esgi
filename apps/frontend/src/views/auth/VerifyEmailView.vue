<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { authApi } from '@/api/auth.api';
import AuthLayout from '@/components/layout/AuthLayout.vue';
import { Button } from '@/components/ui/button';

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
  <AuthLayout title="Email verification">
    <div class="text-center">
      <div v-if="status === 'loading'" class="space-y-3">
        <div class="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
        <p class="text-sm text-muted-foreground">Verifying your email…</p>
      </div>

      <div v-if="status === 'success'" class="space-y-4">
        <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <svg class="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 class="text-xl font-semibold text-foreground">Email verified!</h2>
        <p class="text-sm text-muted-foreground">Your email address has been confirmed successfully.</p>
        <Button class="w-full" @click="router.push('/notes')">Go to Notes</Button>
      </div>

      <div v-if="status === 'error'" class="space-y-4">
        <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <svg class="h-8 w-8 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 class="text-xl font-semibold text-foreground">Verification failed</h2>
        <p class="text-sm text-destructive">{{ errorMessage }}</p>
        <Button variant="outline" class="w-full" @click="router.push('/login')">Back to Login</Button>
      </div>
    </div>
  </AuthLayout>
</template>
