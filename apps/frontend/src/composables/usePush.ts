import type { Router } from 'vue-router';
import { toast } from 'vue-sonner';
import { isNative } from '@/lib/platform';
import { devicesApi } from '@/api/devices.api';

/**
 * Push-notification registration for the Capacitor native shell.
 *
 * INERT on web: every entry point returns immediately when `!isNative`, and the
 * `@capacitor/push-notifications` plugin is only ever reached via a dynamic
 * import, so the web bundle never statically pulls it in (it stays a lazy
 * chunk that web never loads).
 *
 * GRACEFUL without FCM: if Firebase/FCM isn't configured yet, registration
 * simply fails. All failures are caught and logged via `console.warn` — they
 * never throw, so the app keeps working and push just won't deliver until the
 * Firebase setup is completed.
 */

// Remembered across the app session so `disablePush()` can tell the backend
// which token to drop on logout.
let lastToken: string | null = null;

export function usePush() {
  async function initPush(router: Router): Promise<void> {
    if (!isNative) return;

    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      const { Capacitor } = await import('@capacitor/core');

      // Attach listeners FIRST so we never miss the `registration` event that
      // `register()` triggers.
      await PushNotifications.addListener('registration', (token) => {
        lastToken = token.value;
        void devicesApi.register(token.value, Capacitor.getPlatform()).catch(() => {});
      });

      await PushNotifications.addListener('registrationError', (err) => {
        // No toast: FCM may simply not be configured yet.
        console.warn('[push] registration error', err.error);
      });

      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        toast(notification.title ?? 'Notification', { description: notification.body });
      });

      await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const noteId = action.notification?.data?.noteId;
        if (noteId) void router.push('/notes/' + noteId);
      });

      const perm = await PushNotifications.requestPermissions();
      if (perm.receive === 'granted') await PushNotifications.register();
    } catch (err) {
      // Never throw — an unconfigured FCM (or any plugin failure) must not crash
      // the authenticated app shell.
      console.warn('[push] init failed', err);
    }
  }

  async function disablePush(): Promise<void> {
    if (!isNative) return;

    if (lastToken) {
      void devicesApi.unregister(lastToken).catch(() => {});
    }

    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      await PushNotifications.removeAllListeners();
    } catch (err) {
      console.warn('[push] disable failed', err);
    }

    lastToken = null;
  }

  return { initPush, disablePush };
}
