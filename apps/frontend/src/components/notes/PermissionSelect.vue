<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { Check, ChevronDown } from 'lucide-vue-next';

type Permission = 'READ' | 'WRITE';

const props = withDefaults(
  defineProps<{ modelValue: Permission; size?: 'default' | 'sm'; disabled?: boolean }>(),
  { size: 'default' },
);

const emit = defineEmits<{ 'update:modelValue': [value: Permission] }>();

const options: { value: Permission; label: string }[] = [
  { value: 'READ', label: 'Read only' },
  { value: 'WRITE', label: 'Can edit' },
];

const isOpen = ref(false);
const rootRef = ref<HTMLElement | null>(null);

const label = computed(
  () => options.find((o) => o.value === props.modelValue)?.label ?? 'Read only',
);

function toggle() {
  if (props.disabled) return;
  isOpen.value = !isOpen.value;
}
function close() {
  isOpen.value = false;
}
function select(value: Permission) {
  emit('update:modelValue', value);
  close();
}
function onPointerDown(event: PointerEvent) {
  if (!isOpen.value) return;
  const target = event.target as Node | null;
  if (rootRef.value && target && !rootRef.value.contains(target)) close();
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isOpen.value) {
    event.preventDefault();
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
      :aria-label="`Permission: ${label}`"
      :aria-expanded="isOpen"
      aria-haspopup="listbox"
      class="inline-flex min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-background text-left shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-50"
      :class="size === 'sm' ? 'h-7 px-2 text-xs' : 'h-9 w-full px-3 text-sm'"
      @click="toggle"
    >
      <span class="truncate">{{ label }}</span>
      <ChevronDown
        class="shrink-0 text-muted-foreground transition-transform duration-150"
        :class="[isOpen ? 'rotate-180' : '', size === 'sm' ? 'size-3.5' : 'size-4']"
      />
    </button>

    <Transition name="menu">
      <div
        v-if="isOpen"
        role="listbox"
        class="menu-panel absolute z-50 mt-1 w-max min-w-full overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg"
      >
        <button
          v-for="opt in options"
          :key="opt.value"
          type="button"
          role="option"
          :aria-selected="modelValue === opt.value"
          class="flex w-full min-w-0 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          @click="select(opt.value)"
        >
          <span class="truncate">{{ opt.label }}</span>
          <Check v-if="modelValue === opt.value" class="size-4 shrink-0 text-primary" />
        </button>
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
  transform-origin: top;
}
.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}
</style>
