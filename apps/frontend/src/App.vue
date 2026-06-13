<script setup lang="ts">
import { useColorMode } from '@/composables/useColorMode';
import { useNativeShell } from '@/composables/useNativeShell';
import { useAppLock } from '@/composables/useAppLock';
import CookieConsent from '@/components/CookieConsent.vue';
import OfflineBanner from '@/components/app/OfflineBanner.vue';
import AppLock from '@/components/app/AppLock.vue';

useColorMode();
useNativeShell(); // no-op on web
void useAppLock().init(); // no-op on web
</script>

<template>
  <AppLock />
  <router-view />
  <OfflineBanner />
  <CookieConsent />
</template>
