<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import client from '@/api/client';
import AuthLayout from '@/components/layout/AuthLayout.vue';
import { Button } from '@/components/ui/button';

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
  <AuthLayout title="Set a new password">
    <div v-if="done" class="rounded-md border border-border bg-muted p-4 text-sm text-primary">
      Password updated. <RouterLink to="/login" class="font-medium underline">Sign in</RouterLink>
    </div>

    <form v-else @submit.prevent="submit" class="space-y-4">
      <div class="space-y-1.5">
        <label for="password" class="text-sm font-medium text-foreground">New password</label>
        <input
          id="password"
          v-model="password"
          type="password"
          required
          autocomplete="new-password"
          class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        />
        <p class="text-xs text-muted-foreground">12 characters minimum with letters, numbers and symbols.</p>
      </div>
      <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
      <Button type="submit" :disabled="loading" class="w-full">
        {{ loading ? 'Updating…' : 'Update password' }}
      </Button>
    </form>
  </AuthLayout>
</template>
