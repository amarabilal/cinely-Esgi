<script setup lang="ts">
import { onMounted } from 'vue';

// Google OAuth redirige vers /callback (capturé par le frontend SPA).
// On relaie immédiatement la requête vers le backend sous /api/google/callback
// qui dispose déjà d'une règle Traefik via le préfixe /api.
onMounted(() => {
  window.location.replace('/api/google/callback' + window.location.search);
});
</script>

<template>
  <div class="flex h-screen items-center justify-center bg-background">
    <p class="text-sm text-muted-foreground">Connexion Google en cours…</p>
  </div>
</template>
