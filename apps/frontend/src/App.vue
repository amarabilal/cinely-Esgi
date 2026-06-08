<script setup lang="ts">
import { useColorMode } from '@/composables/useColorMode';
import CookieConsent from '@/components/CookieConsent.vue';

// Initialize the color theme at the app root (applies stored / system preference
// on mount). Individual ThemeToggle instances share the same module-level state.
useColorMode();
</script>

<template>
  <router-view v-slot="{ Component }">
    <transition name="page" mode="out-in">
      <component :is="Component" />
    </transition>
  </router-view>
  <CookieConsent />
</template>
