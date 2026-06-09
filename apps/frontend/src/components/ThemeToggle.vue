<script setup lang="ts">
import { Sun, Moon } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { useColorMode } from '@/composables/useColorMode';

const { mode, toggle } = useColorMode();
</script>

<template>
  <Button
    variant="ghost"
    size="icon"
    aria-label="Toggle color theme"
    :title="mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
    @click="toggle"
  >
    <Sun v-if="mode === 'dark'" class="size-4" />
    <Moon v-else class="size-4" />
  </Button>
</template>
