/**
 * Push-notification registration (expo-notifications + expo-device).
 *
 * IMPORTANT — environment caveats:
 *  - Actually DELIVERING pushes on Android requires a DEV BUILD (or production
 *    build) with a Firebase (google-services.json) config. In Expo Go, or in a
 *    build without Firebase, `getDevicePushTokenAsync()` throws.
 *  - This module therefore DEGRADES GRACEFULLY: every failure path returns a
 *    structured result instead of throwing, so the UI can show a hint and the
 *    app keeps working. Nothing here is allowed to crash the app.
 *
 * Flow:
 *  1. Ensure we're on a physical device (emulators/simulators can't get a token).
 *  2. Request notification permission.
 *  3. Get the native device push token (FCM token on Android).
 *  4. POST /devices { token, platform } so the backend can target this device.
 */
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { api } from './api';

/** Outcome of a registration attempt — never throws. */
export type PushResult =
  | { status: 'registered'; token: string }
  | { status: 'denied' }
  | { status: 'unavailable'; reason: string };

let handlerInstalled = false;

/**
 * Installs a foreground notification handler (show banner + play sound while
 * the app is open). Idempotent; safe to call multiple times.
 */
export function installNotificationHandler(): void {
  if (handlerInstalled) return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    handlerInstalled = true;
  } catch {
    // Handler is a nicety; ignore failures.
  }
}

/**
 * Requests permission, obtains the device push token, and registers it with
 * the backend. Best-effort and crash-proof: returns a structured PushResult.
 *
 * On Android without Firebase (Expo Go / no google-services.json), step 3
 * throws — we catch it and return `unavailable` with a human-readable reason.
 */
export async function registerForPush(): Promise<PushResult> {
  try {
    installNotificationHandler();

    // Push tokens are only issued to real hardware.
    if (!Device.isDevice) {
      return { status: 'unavailable', reason: 'Push needs a physical device.' };
    }

    // 1 + 2: permission (ask only if not already determined).
    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted && existing.canAskAgain) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.granted;
    }
    if (!granted) {
      return { status: 'denied' };
    }

    // Running inside Expo Go cannot obtain a native FCM token (no Firebase).
    if (Constants.appOwnership === 'expo') {
      return {
        status: 'unavailable',
        reason: 'Push needs a production build with Firebase (not Expo Go).',
      };
    }

    // 3: native device push token (FCM on Android). THROWS without Firebase —
    // hence the surrounding try/catch and the graceful message below.
    const tokenResp = await Notifications.getDevicePushTokenAsync();
    const token = tokenResp.data;
    if (!token) {
      return { status: 'unavailable', reason: 'No push token was returned.' };
    }

    // 4: register with the backend.
    await api.post('/devices', {
      token,
      platform: Platform.OS, // 'android' | 'ios'
    });

    return { status: 'registered', token };
  } catch (err) {
    // Most common cause on Android: missing Firebase config in this build.
    // Log for diagnostics; never rethrow.
    // eslint-disable-next-line no-console
    console.warn('[push] registration unavailable:', err);
    return {
      status: 'unavailable',
      reason: 'Push needs a production build with Firebase.',
    };
  }
}

/** Best-effort unregister of a previously registered token. */
export async function unregisterPush(token: string): Promise<void> {
  try {
    await api.delete(`/devices/${encodeURIComponent(token)}`);
  } catch {
    // ignore
  }
}
