<script setup lang="ts">
import { watch } from 'vue';
import { History, X, RotateCcw } from 'lucide-vue-next';
import { useNotesStore } from '@/stores/notes.store';

const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ restore: [versionId: string] }>();
const store = useNotesStore();

watch(open, async (o) => {
  if (!o) return;
  if (store.currentNote) await store.fetchVersions(store.currentNote.id);
});

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="fixed inset-0 z-[60] flex items-start justify-center bg-background/70 p-4 pt-[8vh] sm:pt-[18vh] backdrop-blur-sm"
        @click.self="open = false"
      >
        <div
          class="modal-panel w-full max-w-md max-h-[85dvh] overflow-y-auto rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-label="Version history"
          @keydown="onKeydown"
        >
          <div class="flex items-center justify-between border-b border-border px-4 py-3">
            <div class="flex items-center gap-2 text-sm font-semibold">
              <History class="size-4 text-primary" />
              Version history
            </div>
            <button aria-label="Close" class="-m-3 flex items-center justify-center rounded-md p-3 text-muted-foreground transition-colors hover:text-foreground" @click="open = false">
              <X class="size-4" />
            </button>
          </div>

          <div class="max-h-[60vh] overflow-y-auto p-4 scrollbar-thin">
            <div v-if="store.versions.length === 0" class="py-6 text-center text-xs text-muted-foreground">
              No saved versions yet.
            </div>
            <ol v-else class="relative ml-[7px] border-l border-border">
              <li
                v-for="(v, i) in store.versions" :key="v.id"
                class="relative py-3 pl-5">
                <span
                  class="absolute -left-[6px] top-3.5 size-3 rounded-full ring-2 ring-background"
                  :class="i === 0 ? 'bg-primary' : 'bg-muted-foreground/40'" />
                <div class="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span class="text-xs font-semibold text-foreground">v{{ v.versionNumber }}</span>
                  <span aria-hidden="true">·</span>
                  <span>{{ formatDate(v.createdAt) }}</span>
                </div>
                <div class="mt-0.5 flex items-center justify-between gap-2">
                  <span class="line-clamp-1 text-xs text-muted-foreground">{{ v.title || 'Untitled' }}</span>
                  <button
                    v-if="store.currentPermission === 'OWNER'"
                    type="button"
                    :title="`Restore v${v.versionNumber}`"
                    :aria-label="`Restore version ${v.versionNumber}`"
                    @click="emit('restore', v.id)"
                    class="-m-2 flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary sm:m-0 sm:min-h-0 sm:min-w-0">
                    <RotateCcw class="size-3.5" />
                  </button>
                </div>
              </li>
            </ol>
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
