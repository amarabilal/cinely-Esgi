<script setup lang="ts">
import { Fingerprint } from 'lucide-vue-next';
import { useAppLock } from '@/composables/useAppLock';
import { Button } from '@/components/ui/button';

const { locked, tryUnlock } = useAppLock();
</script>

<template>
  <div
    v-if="locked"
    class="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-background px-8 pt-safe pb-safe text-foreground"
  >
    <div class="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
      <Fingerprint class="size-8" />
    </div>

    <div class="space-y-1 text-center">
      <h1 class="text-xl font-semibold tracking-tight text-foreground">Cinely</h1>
      <p class="text-sm text-muted-foreground">Unlock to continue</p>
    </div>

    <Button size="lg" class="min-w-40" @click="tryUnlock">Unlock</Button>
  </div>
</template>
