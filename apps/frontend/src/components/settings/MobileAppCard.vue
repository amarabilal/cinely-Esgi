<script setup lang="ts">
import { Smartphone } from 'lucide-vue-next';
import { isNative } from '@/lib/platform';
import { Button } from '@/components/ui/button';
import {
  ANDROID_APK_URL,
  ANDROID_APK_SIZE_LABEL,
  ANDROID_MIN_VERSION_LABEL,
} from '@/lib/appLinks';
</script>

<template>
  <!-- An app shouldn't advertise its own APK: hidden inside the native shell. -->
  <div v-if="!isNative" class="bg-card border border-border rounded-xl p-6 space-y-3">
    <div class="flex items-center gap-2">
      <Smartphone class="size-4 text-primary" />
      <h3 class="text-sm font-semibold text-foreground">Mobile app</h3>
    </div>
    <p class="text-sm text-muted-foreground">
      Install Cinely on your Android phone — same account, notes synced in real time.
    </p>
    <div class="flex flex-wrap items-center gap-3">
      <Button :href="ANDROID_APK_URL" size="sm">Download for Android (.apk)</Button>
      <span class="text-xs text-muted-foreground">
        {{ ANDROID_APK_SIZE_LABEL }} · {{ ANDROID_MIN_VERSION_LABEL }}
      </span>
    </div>
    <p class="text-xs text-muted-foreground">
      You may need to allow installs from unknown sources.
    </p>
  </div>
</template>
