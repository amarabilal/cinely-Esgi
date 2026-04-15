<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';

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
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="w-full max-w-md bg-white rounded-2xl shadow-sm p-8">
      <h1 class="text-2xl font-bold text-gray-900 mb-1">Create an account</h1>
      <p class="text-sm text-gray-500 mb-6">
        Already have one?
        <router-link to="/login" class="text-primary-600 hover:underline">Sign in</router-link>
      </p>

      <form @submit.prevent="submit" class="space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">First name</label>
            <input
              v-model="form.firstName"
              type="text"
              required
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Last name</label>
            <input
              v-model="form.lastName"
              type="text"
              required
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            v-model="form.email"
            type="email"
            required
            autocomplete="email"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            :class="{ 'border-red-400': fieldErrors.email }"
          />
          <p v-if="fieldErrors.email" class="text-xs text-red-600 mt-1">{{ fieldErrors.email }}</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            v-model="form.password"
            type="password"
            required
            autocomplete="new-password"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            :class="{ 'border-red-400': fieldErrors.password }"
          />
          <p class="text-xs text-gray-400 mt-1">12 characters minimum with letters, numbers and symbols.</p>
          <p v-if="fieldErrors.password" class="text-xs text-red-600 mt-1">{{ fieldErrors.password }}</p>
        </div>

        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

        <button
          type="submit"
          :disabled="loading"
          class="w-full bg-primary-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {{ loading ? 'Creating account…' : 'Create account' }}
        </button>
      </form>
    </div>
  </div>
</template>
