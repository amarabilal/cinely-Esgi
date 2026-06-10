<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import type { Component } from 'vue';

const props = defineProps<{ icon: Component; title: string; active?: boolean; disabled?: boolean }>();

const isOpen = ref(false);
const rootRef = ref<HTMLElement | null>(null);

function toggle() {
  if (props.disabled) return;
  isOpen.value = !isOpen.value;
}

function close() {
  isOpen.value = false;
}

function onPointerDown(e: PointerEvent) {
  if (!isOpen.value) return;
  const t = e.target as Node | null;
  if (rootRef.value && t && !rootRef.value.contains(t)) close();
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isOpen.value) {
    e.preventDefault();
    close();
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown);
  document.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div ref="rootRef" class="relative">
    <button
      type="button"
      :disabled="disabled"
      :title="title"
      :aria-label="title"
      aria-haspopup="menu"
      :aria-expanded="isOpen"
      @click="toggle"
      class="flex size-9 appearance-none items-center justify-center rounded-lg border border-transparent bg-transparent transition-colors [-webkit-tap-highlight-color:transparent] disabled:opacity-30 disabled:cursor-default"
      :class="(isOpen || active) ? 'border-border bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
    >
      <component :is="icon" class="size-4" />
    </button>

    <Transition name="menu">
      <div
        v-if="isOpen"
        role="menu"
        @click="close"
        class="menu-panel absolute left-0 top-full z-50 mt-1 min-w-[12rem] overflow-hidden rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-lg"
      >
        <div class="px-2 pb-1 pt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{{ title }}</div>
        <slot :close="close" />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.menu-enter-active,
.menu-leave-active {
  transition:
    opacity 0.14s ease,
    transform 0.14s ease;
  transform-origin: top left;
}

.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}
</style>
