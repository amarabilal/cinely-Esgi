<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { Calendar, X } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';

const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ submit: [start: string, end: string] }>();

const start = ref('');
const end = ref('');

function formatDateTimeLocal(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

watch(open, async (o) => {
  if (!o) return;
  const now = new Date();

  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

  start.value = formatDateTimeLocal(startDate);
  end.value = formatDateTimeLocal(endDate);
});

function submit() {
  if (!start.value || !end.value) return;
  emit('submit', start.value, end.value);
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
              <Calendar class="size-4 text-primary" />
              Add to Google Calendar
            </div>
            <button class="text-muted-foreground transition-colors hover:text-foreground" @click="open = false">
              <X class="size-4" />
            </button>
          </div>

          <div class="space-y-4 p-4">
            <div class="space-y-1.5">
              <label for="event-start" class="text-sm font-medium text-foreground">Start Date &amp; Time</label>
              <input
                id="event-start"
                v-model="start"
                type="datetime-local"
                class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div class="space-y-1.5">
              <label for="event-end" class="text-sm font-medium text-foreground">End Date &amp; Time</label>
              <input
                id="event-end"
                v-model="end"
                type="datetime-local"
                class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div class="flex items-center gap-2 pt-2">
              <div class="ml-auto flex gap-2">
                <Button variant="outline" size="sm" @click="open = false">Cancel</Button>
                <Button size="sm" :disabled="!start || !end" @click="submit">Sync Event</Button>
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
