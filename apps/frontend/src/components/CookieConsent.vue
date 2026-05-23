<script setup lang="ts">
import { ref, onMounted } from 'vue';

const STORAGE_KEY = 'cookie_consent';

const visible = ref(false);

onMounted(() => {
  if (!localStorage.getItem(STORAGE_KEY)) {
    visible.value = true;
  }
});

function accept() {
  localStorage.setItem(STORAGE_KEY, 'accepted');
  visible.value = false;
}

function decline() {
  localStorage.setItem(STORAGE_KEY, 'declined');
  visible.value = false;
  // Disable Matomo tracking if loaded
  if ((window as any)._paq) {
    (window as any)._paq.push(['optUserOut']);
  }
}
</script>

<template>
  <Transition name="slide-up">
    <div v-if="visible"
      class="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 bg-white border border-gray-200 rounded-2xl shadow-lg p-5">
      <p class="text-sm text-gray-700 mb-1 font-medium">We use cookies</p>
      <p class="text-xs text-gray-500 mb-4">
        We use analytics cookies (Matomo) to understand how you use our app.
        These are optional and anonymized. Essential session cookies are always active.
        See our <router-link to="/legal/cookies" class="underline hover:text-gray-700">cookie policy</router-link>.
      </p>
      <div class="flex gap-2">
        <button @click="accept"
          class="flex-1 bg-primary-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-primary-700 transition-colors">
          Accept all
        </button>
        <button @click="decline"
          class="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 transition-colors">
          Decline analytics
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(1rem);
}
</style>
