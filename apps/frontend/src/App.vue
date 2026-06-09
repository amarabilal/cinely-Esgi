<script setup lang="ts">
import { useColorMode } from '@/composables/useColorMode';
import CookieConsent from '@/components/CookieConsent.vue';

// Initialize the color theme at the app root (applies stored / system preference
// on mount). Individual ThemeToggle instances share the same module-level state.
useColorMode();
</script>

<template>
  <!-- Navigation is animated app-wide via the View Transitions API
       (see the router's beforeResolve guard) — a snapshot crossfade that
       matches the dark/light theme switch. No CSS <transition> here. -->
  <router-view />
  <CookieConsent />
</template>
