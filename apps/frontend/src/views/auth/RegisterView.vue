<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import AuthLayout from '@/components/layout/AuthLayout.vue';
import { Button } from '@/components/ui/button';

const router = useRouter();
const auth = useAuthStore();

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
      <div class="grid grid-cols-2 gap-3">
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
    </form>
  </AuthLayout>
</template>
