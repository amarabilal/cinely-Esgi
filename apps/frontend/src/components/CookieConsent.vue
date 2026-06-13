<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Button } from '@/components/ui/button';

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
      class="fixed bottom-0 pb-safe left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 bg-card border border-border text-card-foreground rounded-2xl shadow-lg p-5">
      <p class="text-sm text-foreground mb-1 font-medium">We use cookies</p>
      <p class="text-xs text-muted-foreground mb-4">
        We use analytics cookies (Matomo) to understand how you use our app.
        These are optional and anonymized. Essential session cookies are always active.
        See our <router-link to="/legal/cookies" class="underline hover:text-foreground">cookie policy</router-link>.
      </p>
      <div class="flex gap-2">
        <Button class="flex-1" @click="accept">
          Accept all
        </Button>
        <Button variant="outline" class="flex-1" @click="decline">
          Decline analytics
        </Button>
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
