<script setup lang="ts">
import { useColorMode } from '@/composables/useColorMode';
import { useNativeShell } from '@/composables/useNativeShell';
import CookieConsent from '@/components/CookieConsent.vue';
import OfflineBanner from '@/components/app/OfflineBanner.vue';

useColorMode();
useNativeShell(); // no-op on web
</script>

<template>
  <router-view />
  <OfflineBanner />
  <CookieConsent />
</template>
