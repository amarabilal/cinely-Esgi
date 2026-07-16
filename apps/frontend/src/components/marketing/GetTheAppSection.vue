<script setup lang="ts">
import { Smartphone } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import {
  ANDROID_APK_URL,
  ANDROID_APK_SIZE_LABEL,
  ANDROID_MIN_VERSION_LABEL,
} from '@/lib/appLinks';
</script>

<template>

  <section class="border-t border-border/60 px-6 py-20">
    <div class="mx-auto flex max-w-5xl flex-col items-center gap-10 md:flex-row md:justify-between">
      <div class="max-w-xl text-center md:text-left">
        <h2 class="text-3xl font-bold tracking-tight text-foreground">Take Cinely with you</h2>
        <p class="mt-4 text-pretty text-lg text-muted-foreground">
          Get the Android app and keep your notes in your pocket — same account,
          synced in real time.
        </p>
        <div class="mt-8 flex flex-col items-center gap-3 md:items-start">
          <Button :href="ANDROID_APK_URL" size="lg">
            <Smartphone class="mr-2 size-4" />
            Download for Android (.apk)
          </Button>
          <p class="text-sm text-muted-foreground">
            {{ ANDROID_APK_SIZE_LABEL }} · {{ ANDROID_MIN_VERSION_LABEL }} · You may
            need to allow installs from unknown sources.
          </p>
        </div>
      </div>
      <div class="flex flex-col items-center gap-3">

        <img
          :src="'/qr-android.svg'"
          alt="QR code linking to the Cinely Android APK download"
          class="size-40 rounded-xl bg-white p-3 shadow-sm"
        />
        <p class="text-xs text-muted-foreground">Scan with your phone</p>
      </div>
    </div>
  </section>
</template>
