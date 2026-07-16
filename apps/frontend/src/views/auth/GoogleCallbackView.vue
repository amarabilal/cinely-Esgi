<script setup lang="ts">
import { onMounted } from 'vue';

onMounted(() => {
  window.location.replace('/api/google/callback' + window.location.search);
});
</script>

<template>
  <div class="flex h-screen items-center justify-center bg-background">
    <p class="text-sm text-muted-foreground">Connexion Google en cours…</p>
  </div>
</template>
