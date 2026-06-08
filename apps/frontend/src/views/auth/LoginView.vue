<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import AuthLayout from '@/components/layout/AuthLayout.vue';
import { Button } from '@/components/ui/button';

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
  <AuthLayout title="Sign in">
    <template #subtitle>
      No account?
      <RouterLink to="/register" class="font-medium text-primary hover:underline">Create one</RouterLink>
    </template>

    <form @submit.prevent="submit" class="space-y-4">
      <div class="space-y-1.5">
        <label for="email" class="text-sm font-medium text-foreground">Email</label>
        <input
          id="email"
          v-model="email"
          type="email"
          required
          autocomplete="email"
          class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div class="space-y-1.5">
        <label for="password" class="text-sm font-medium text-foreground">Password</label>
        <input
          id="password"
          v-model="password"
          type="password"
          required
          autocomplete="current-password"
          class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div class="flex justify-end">
        <RouterLink to="/forgot-password" class="text-xs text-muted-foreground transition-colors hover:text-foreground">
          Forgot password?
        </RouterLink>
      </div>

      <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

      <Button type="submit" :disabled="loading" class="w-full">
        {{ loading ? 'Signing in…' : 'Sign in' }}
      </Button>
    </form>
  </AuthLayout>
</template>
