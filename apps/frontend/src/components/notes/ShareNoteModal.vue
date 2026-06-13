<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { Users, X } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import PermissionSelect from '@/components/notes/PermissionSelect.vue';
import { useNotesStore } from '@/stores/notes.store';

const open = defineModel<boolean>('open', { default: false });
const store = useNotesStore();

const shareEmail = ref('');
const sharePermission = ref<'READ' | 'WRITE'>('READ');
const shareError = ref('');
const shareLoading = ref(false);
const emailEl = ref<HTMLInputElement | null>(null);

watch(open, async (o) => {
  if (!o) return;
  shareEmail.value = '';
  shareError.value = '';
  sharePermission.value = 'READ';
  if (store.currentNote) await store.fetchShares(store.currentNote.id);
  await nextTick();
  emailEl.value && emailEl.value.focus();
});

async function addShare() {
  if (!shareEmail.value.trim() || !store.currentNote) return;
  shareError.value = '';
  shareLoading.value = true;
  try {
    await store.shareNote(store.currentNote.id, shareEmail.value.trim(), sharePermission.value);
    shareEmail.value = '';
  } catch (e: any) {
    shareError.value = e.response?.data?.message || 'Failed to share note.';
  } finally {
    shareLoading.value = false;
  }
}

async function handlePermissionChange(shareId: string, newPermission: 'READ' | 'WRITE') {
  if (!store.currentNote) return;
  shareError.value = '';
  try {
    await store.updateShare(store.currentNote.id, shareId, newPermission);
  } catch (e: any) {
    shareError.value = e.response?.data?.message || 'Failed to update permission.';
  }
}

async function revoke(shareId: string) {
  if (!store.currentNote) return;
  shareError.value = '';
  try {
    await store.revokeShare(store.currentNote.id, shareId);
  } catch (e: any) {
    shareError.value = e.response?.data?.message || 'Failed to revoke access.';
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false;
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
          aria-label="Share note"
          @keydown="onKeydown"
        >
          <div class="flex items-center justify-between border-b border-border px-4 py-3">
            <div class="flex items-center gap-2 text-sm font-semibold">
              <Users class="size-4 text-primary" />
              Share note
            </div>
            <button aria-label="Close" class="-m-3 flex items-center justify-center rounded-md p-3 text-muted-foreground transition-colors hover:text-foreground" @click="open = false">
              <X class="size-4" />
            </button>
          </div>

          <div class="space-y-4 p-4">
            <!-- Add-share form -->
            <div class="space-y-2">
              <input
                ref="emailEl"
                v-model="shareEmail"
                type="email"
                placeholder="Email address"
                class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <PermissionSelect v-model="sharePermission" />
              <p v-if="shareError" class="text-xs text-destructive">{{ shareError }}</p>
              <Button @click="addShare" :disabled="shareLoading || !shareEmail.trim()" size="sm" class="w-full">
                {{ shareLoading ? 'Sharing…' : 'Share' }}
              </Button>
            </div>

            <!-- Separator -->
            <div class="h-px bg-border" />

            <!-- Existing shares -->
            <div class="max-h-64 space-y-2 overflow-y-auto scrollbar-thin">
              <div v-if="store.shares.length === 0" class="text-center text-xs text-muted-foreground">
                Not shared with anyone yet.
              </div>
              <div v-for="s in store.shares" :key="s.id" class="rounded-lg border border-border bg-card p-3">
                <div class="truncate text-xs font-medium text-foreground">{{ s.sharedWith.email }}</div>
                <div class="mb-2 text-xs text-muted-foreground">{{ s.sharedWith.firstName }} {{ s.sharedWith.lastName }}</div>
                <div class="flex items-center justify-between gap-2">
                  <PermissionSelect
                    :model-value="s.permission"
                    size="sm"
                    @update:model-value="(val) => handlePermissionChange(s.id, val)"
                  />
                  <button
                    @click="revoke(s.id)"
                    class="whitespace-nowrap text-xs text-destructive transition-colors hover:text-destructive"
                  >
                    Revoke
                  </button>
                </div>
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
