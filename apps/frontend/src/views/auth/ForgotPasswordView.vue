<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import client from '@/api/client';
import AuthLayout from '@/components/layout/AuthLayout.vue';
import { Button } from '@/components/ui/button';

const email = ref('');
const sent = ref(false);
const loading = ref(false);
const error = ref('');

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    await client.post('/auth/forgot-password', { email: email.value });
    sent.value = true;
  } catch {
    error.value = 'Something went wrong. Please try again.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <AuthLayout title="Forgot password">
    <div v-if="sent" class="rounded-md border border-border bg-muted p-4 text-sm text-primary">
      If this email exists, a reset link has been sent. Check your inbox.
    </div>

    <template v-else>
      <p class="mb-6 text-sm text-muted-foreground">Enter your email and we'll send you a reset link.</p>
      <form @submit.prevent="submit" class="space-y-4">
        <div class="space-y-1.5">
          <label for="email" class="text-sm font-medium text-foreground">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          />
        </div>
        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        <Button type="submit" :disabled="loading" class="w-full">
          {{ loading ? 'Sending…' : 'Send reset link' }}
        </Button>
      </form>
    </template>

    <RouterLink to="/login" class="mt-4 block text-center text-sm text-primary hover:underline">
      Back to sign in
    </RouterLink>
  </AuthLayout>
</template>
