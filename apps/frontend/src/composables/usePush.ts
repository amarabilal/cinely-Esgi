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
 * OFF BY DEFAULT until Firebase is configured. `PushNotifications.register()`
 * calls native FirebaseMessaging, which HARD-CRASHES the app (a native FATAL
 * exception on the Capacitor plugins thread — NOT a catchable JS error) when
 * there is no `google-services.json` / FCM config. So registration only runs
 * when explicitly enabled at build time via `VITE_ENABLE_PUSH=true`. Enable it
 * (together with adding google-services.json + the backend FCM credentials)
 * once the Firebase project exists.
 */
const PUSH_ENABLED = isNative && import.meta.env.VITE_ENABLE_PUSH === 'true';

let lastToken: string | null = null;

export function usePush() {
  async function initPush(router: Router): Promise<void> {

    if (!PUSH_ENABLED) return;

    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      const { Capacitor } = await import('@capacitor/core');

      await PushNotifications.addListener('registration', (token) => {
        lastToken = token.value;
        void devicesApi.register(token.value, Capacitor.getPlatform()).catch(() => {});
      });

      await PushNotifications.addListener('registrationError', (err) => {

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

      console.warn('[push] init failed', err);
    }
  }

  async function disablePush(): Promise<void> {
    if (!PUSH_ENABLED) return;

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
