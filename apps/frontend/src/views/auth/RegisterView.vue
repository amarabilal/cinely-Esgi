<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import AuthLayout from '@/components/layout/AuthLayout.vue';
import { Button } from '@/components/ui/button';

const router = useRouter();
const auth = useAuthStore();

function signupWithGoogle() {
  window.location.href = '/api/google/login';
}

const form = ref({ email: '', password: '', firstName: '', lastName: '' });
const error = ref('');
const fieldErrors = ref<Record<string, string>>({});
const loading = ref(false);

const PASSWORD_REGEX = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/;

function validatePassword(p: string): string | null {
  if (p.length < 12) return 'Minimum 12 characters.';
  if (!PASSWORD_REGEX.test(p)) return 'Must contain letters, numbers and a special character.';
  return null;
}

async function submit() {
  error.value = '';
  fieldErrors.value = {};

  const pwdError = validatePassword(form.value.password);
  if (pwdError) {
    fieldErrors.value.password = pwdError;
    return;
  }

  loading.value = true;
  try {
    await auth.register(form.value);
    router.push('/notes');
  } catch (e: any) {
    const msg = e.response?.data?.message;
    if (e.response?.status === 409) {
      fieldErrors.value.email = 'This email is already in use.';
    } else if (Array.isArray(msg)) {
      msg.forEach((m: string) => {
        if (m.includes('email')) fieldErrors.value.email = m;
        else if (m.includes('assword')) fieldErrors.value.password = m;
      });
    } else {
      error.value = 'Registration failed. Please try again.';
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <AuthLayout title="Create an account">
    <template #subtitle>
      Already have one?
      <RouterLink to="/login" class="font-medium text-primary hover:underline">Sign in</RouterLink>
    </template>

    <form @submit.prevent="submit" class="space-y-4">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="space-y-1.5">
          <label for="firstName" class="text-sm font-medium text-foreground">First name</label>
          <input
            id="firstName"
            v-model="form.firstName"
            type="text"
            required
            class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          />
        </div>
        <div class="space-y-1.5">
          <label for="lastName" class="text-sm font-medium text-foreground">Last name</label>
          <input
            id="lastName"
            v-model="form.lastName"
            type="text"
            required
            class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          />
        </div>
      </div>

      <div class="space-y-1.5">
        <label for="email" class="text-sm font-medium text-foreground">Email</label>
        <input
          id="email"
          v-model="form.email"
          type="email"
          required
          autocomplete="email"
          class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          :class="{ 'border-destructive': fieldErrors.email }"
        />
        <p v-if="fieldErrors.email" class="text-xs text-destructive">{{ fieldErrors.email }}</p>
      </div>

      <div class="space-y-1.5">
        <label for="password" class="text-sm font-medium text-foreground">Password</label>
        <input
          id="password"
          v-model="form.password"
          type="password"
          required
          autocomplete="new-password"
          class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          :class="{ 'border-destructive': fieldErrors.password }"
        />
        <p class="text-xs text-muted-foreground">12 characters minimum with letters, numbers and symbols.</p>
        <p v-if="fieldErrors.password" class="text-xs text-destructive">{{ fieldErrors.password }}</p>
      </div>

      <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

      <Button type="submit" :disabled="loading" class="w-full">
        {{ loading ? 'Creating account…' : 'Create account' }}
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
        @click="signupWithGoogle"
      >
        <svg class="h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
          <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
        </svg>
        Sign up with Google
      </Button>
    </form>
  </AuthLayout>
</template>
