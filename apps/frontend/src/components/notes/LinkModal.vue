<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { Link2, X } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';

const props = defineProps<{ initialUrl?: string }>();
const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ submit: [url: string]; remove: [] }>();

const url = ref('');
const inputEl = ref<HTMLInputElement | null>(null);
const isEdit = ref(false);

watch(open, async (o) => {
  if (!o) return;
  isEdit.value = !!props.initialUrl;
  url.value = props.initialUrl ?? '';
  await nextTick();
  inputEl.value?.focus();
  inputEl.value?.select();
});

function submit() {
  const v = url.value.trim();
  if (!v) return;
  // Prepend https:// when the user omits a scheme (but leave mailto:, anchors, relative paths alone).
  const href = /^(https?:\/\/|mailto:|tel:|\/|#)/i.test(v) ? v : `https://${v}`;
  emit('submit', href);
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false;
  else if (e.key === 'Enter') { e.preventDefault(); submit(); }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="fixed inset-0 z-[60] flex items-start justify-center bg-background/70 p-4 pt-[18vh] backdrop-blur-sm"
        @click.self="open = false"
      >
        <div
          class="modal-panel w-full max-w-md rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl"
          role="dialog"
          aria-modal="true"
          @keydown="onKeydown"
        >
          <div class="flex items-center justify-between border-b border-border px-4 py-3">
            <div class="flex items-center gap-2 text-sm font-semibold">
              <Link2 class="size-4 text-primary" />
              {{ isEdit ? 'Edit link' : 'Add link' }}
            </div>
            <button class="text-muted-foreground transition-colors hover:text-foreground" @click="open = false">
              <X class="size-4" />
            </button>
          </div>

          <div class="space-y-2 p-4">
            <label for="link-url" class="text-sm font-medium text-foreground">URL</label>
            <input
              id="link-url"
              ref="inputEl"
              v-model="url"
              type="text"
              placeholder="https://example.com"
              class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div class="flex items-center gap-2 pt-2">
              <Button v-if="isEdit" variant="ghost" size="sm" class="text-destructive" @click="emit('remove')">
                Remove
              </Button>
              <div class="ml-auto flex gap-2">
                <Button variant="outline" size="sm" @click="open = false">Cancel</Button>
                <Button size="sm" :disabled="!url.trim()" @click="submit">{{ isEdit ? 'Update' : 'Add' }}</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active { transition: opacity 0.18s ease; }
.modal-enter-from,
.modal-leave-to { opacity: 0; }
.modal-enter-active .modal-panel,
.modal-leave-active .modal-panel {
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.18s ease;
}
.modal-enter-from .modal-panel,
.modal-leave-to .modal-panel {
  transform: translateY(-10px) scale(0.97);
  opacity: 0;
}
</style>
