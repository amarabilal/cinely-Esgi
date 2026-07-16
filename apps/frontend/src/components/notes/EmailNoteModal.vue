<script setup lang="ts">
import { ref, watch } from 'vue';
import { Mail, X } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { toast } from 'vue-sonner';

const props = defineProps<{
  noteTitle: string;
  noteContentHtml: string;
}>();

const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ (e: 'sent'): void }>();

const to = ref('');
const subject = ref('');
const loading = ref(false);

watch(open, (o) => {
  if (!o) return;
  to.value = '';
  subject.value = props.noteTitle ? `Note: ${props.noteTitle}` : 'Note';
});

async function submit() {
  const recipient = to.value.trim();
  const sub = subject.value.trim();

  if (!recipient || !sub) {
    toast.error('Veuillez remplir le destinataire et le sujet');
    return;
  }

  loading.value = true;
  const toastId = toast.loading("Envoi de l'email via Gmail...");

  try {
    const token = localStorage.getItem('accessToken');
    const res = await fetch('/api/google/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: recipient,
        subject: sub,
        html: props.noteContentHtml,
      }),
    });

    const data = await res.json();

    if (res.ok) {
      toast.success('Email envoyé avec succès !', { id: toastId });
      open.value = false;
      emit('sent');
    } else {
      toast.error(data.message || "Échec de l'envoi de l'email", { id: toastId });
    }
  } catch (error: any) {
    toast.error("Erreur lors de l'envoi de l'email", {
      id: toastId,
      description: error.message,
    });
  } finally {
    loading.value = false;
  }
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
              <Mail class="size-4 text-primary" />
              Envoyer par email (Gmail)
            </div>
            <button class="text-muted-foreground transition-colors hover:text-foreground" @click="open = false">
              <X class="size-4" />
            </button>
          </div>

          <div class="space-y-4 p-4">
            <div class="space-y-1.5">
              <label for="email-to" class="text-sm font-medium text-foreground">Destinataire (Email)</label>
              <input
                id="email-to"
                v-model="to"
                type="email"
                placeholder="recipient@example.com"
                class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div class="space-y-1.5">
              <label for="email-subject" class="text-sm font-medium text-foreground">Sujet</label>
              <input
                id="email-subject"
                v-model="subject"
                type="text"
                placeholder="Sujet de l'email"
                class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div class="flex items-center gap-2 pt-2">
              <div class="ml-auto flex gap-2">
                <Button variant="outline" size="sm" @click="open = false">Annuler</Button>
                <Button size="sm" :disabled="!to || !subject || loading" @click="submit">
                  {{ loading ? 'Envoi...' : 'Envoyer' }}
                </Button>
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
