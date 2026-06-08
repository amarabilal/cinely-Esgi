<script setup lang="ts">
import { ref } from 'vue';
import PublicLayout from '@/components/layout/PublicLayout.vue';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-vue-next';

const name = ref('');
const email = ref('');
const message = ref('');
const sent = ref(false);

function submit() {
  // Static form — no backend endpoint. Shown as-is for SEO / demo purposes.
  sent.value = true;
}
</script>

<template>
  <PublicLayout>
    <div class="mx-auto max-w-xl px-6 py-16 sm:py-20">
      <h1 class="text-4xl font-bold tracking-tight text-foreground">Contact</h1>
      <p class="mt-4 text-muted-foreground">Have a question or feedback? Send us a message.</p>

      <div
        v-if="sent"
        class="mt-10 flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-8 text-center"
      >
        <CheckCircle2 class="size-8 text-primary" />
        <p class="font-medium text-foreground">Message sent!</p>
        <p class="text-sm text-muted-foreground">We'll get back to you as soon as possible.</p>
      </div>

      <form v-else @submit.prevent="submit" class="mt-10 space-y-5">
        <div class="space-y-1.5">
          <label class="text-sm font-medium text-foreground">Name</label>
          <input
            v-model="name"
            type="text"
            required
            class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div class="space-y-1.5">
          <label class="text-sm font-medium text-foreground">Email</label>
          <input
            v-model="email"
            type="email"
            required
            class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div class="space-y-1.5">
          <label class="text-sm font-medium text-foreground">Message</label>
          <textarea
            v-model="message"
            rows="5"
            required
            class="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          ></textarea>
        </div>
        <Button type="submit" class="w-full">Send message</Button>
      </form>
    </div>
  </PublicLayout>
</template>
