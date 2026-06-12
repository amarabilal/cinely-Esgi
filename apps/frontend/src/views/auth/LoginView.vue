<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute, RouterLink } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import AuthLayout from '@/components/layout/AuthLayout.vue';
import { Button } from '@/components/ui/button';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

onMounted(async () => {
  if (route.query.google_login === 'success' && typeof route.query.token === 'string') {
    loading.value = true;
    try {
      auth.setToken(route.query.token);
      await auth.fetchMe();
      router.push('/notes');
    } catch (e: any) {
      error.value = 'Failed to load user profile after Google sign-in.';
      auth.clearAuth();
    } finally {
      loading.value = false;
    }
  } else if (route.query.google_login === 'error' && typeof route.query.message === 'string') {
    error.value = route.query.message;
  }
});

function loginWithGoogle() {
  window.location.href = '/api/google/login';
}

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

      <div class="relative flex py-2 items-center">
        <div class="flex-grow border-t border-input"></div>
        <span class="flex-shrink mx-4 text-xs text-muted-foreground uppercase">Or continue with</span>
        <div class="flex-grow border-t border-input"></div>
      </div>

      <Button
        type="button"
        variant="outline"
        class="w-full flex items-center justify-center gap-2 hover:bg-accent hover:text-accent-foreground transition-all duration-200"
        @click="loginWithGoogle"
      >
        <svg class="h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
          <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
        </svg>
        Sign in with Google
      </Button>
    </form>
  </AuthLayout>
</template>
