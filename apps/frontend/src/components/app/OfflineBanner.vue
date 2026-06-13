<script setup lang="ts">
import { useNetwork } from '@/composables/useNetwork';
const { online } = useNetwork();
</script>

<template>
  <Transition
    enter-active-class="transition-transform duration-200"
    enter-from-class="-translate-y-full"
    leave-active-class="transition-transform duration-200"
    leave-to-class="-translate-y-full"
  >
    <div
      v-if="!online"
      class="fixed inset-x-0 top-0 z-50 pt-safe bg-destructive text-destructive-foreground text-center text-sm py-2"
      role="status"
      aria-live="polite"
    >
      You're offline — changes can't be saved until you reconnect.
    </div>
  </Transition>
</template>
