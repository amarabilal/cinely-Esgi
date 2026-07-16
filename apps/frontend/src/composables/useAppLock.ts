import { ref } from 'vue';
import { isNative } from '@/lib/platform';

/**
 * Biometric app lock (Face ID / fingerprint to open the app).
 *
 * Client-only UI gate — NOT a token-storage rearchitecture. When enabled and
 * available on a native device, an opaque full-screen overlay (`AppLock.vue`)
 * blocks the app until the user passes a biometric prompt. Re-locks on resume.
 *
 * Everything is inert on web (`isNative` false): no plugin is ever imported,
 * the overlay never shows, and the Settings toggle is hidden.
 */

const STORAGE_KEY = 'cinely-biometric-lock';

const locked = ref(false);
/** Whether the device actually has biometric hardware enrolled & usable. */
const available = ref(false);

let resumeListenerAttached = false;

/** Reads the persisted opt-in flag from localStorage. */
function isEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Dynamically loads the native biometric plugin. Web bundle never statically references it. */
async function loadPlugin() {
  const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
  return NativeBiometric;
}

/** Probes biometric hardware availability and caches it into `available`. */
async function refreshAvailability(): Promise<boolean> {
  if (!isNative) {
    available.value = false;
    return false;
  }
  try {
    const NativeBiometric = await loadPlugin();
    const result = await NativeBiometric.isAvailable();
    available.value = !!result?.isAvailable;
  } catch {
    available.value = false;
  }
  return available.value;
}

/** Prompts the biometric verification. Resolves true on success, false on cancel/failure. */
async function verify(): Promise<boolean> {
  try {
    const NativeBiometric = await loadPlugin();
    await NativeBiometric.verifyIdentity({
      reason: 'Unlock Cinely',
      title: 'Unlock Cinely',
      subtitle: 'Confirm your identity to continue',
      description: 'Use your fingerprint or face to open the app.',
    });
    return true;
  } catch {

    return false;
  }
}

let unlocking = false;
/** Attempts to unlock via biometrics. No-op when not locked or a prompt is already in flight. */
async function tryUnlock(): Promise<void> {
  if (!locked.value || unlocking) return;
  unlocking = true;
  try {
    const ok = await verify();
    if (ok) locked.value = false;

  } finally {
    unlocking = false;
  }
}

/** Re-engages the lock (used on app resume). Inert unless enabled, available, and native. */
function lock(): void {
  if (isNative && isEnabled() && available.value) {
    locked.value = true;
  }
}

/** Persists the opt-in flag and reconciles current lock state. */
async function setEnabled(value: boolean): Promise<void> {
  try {
    localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
  } catch {

  }
  if (value) {

    await refreshAvailability();
  } else {

    locked.value = false;
  }
}

/**
 * Wires the lock. Call once from App.vue (alongside useNativeShell).
 * No-op on web. On native: probes availability, locks immediately if enabled,
 * and attaches a resume listener that re-locks when the app returns to foreground.
 */
async function init(): Promise<void> {
  if (!isNative) return;

  await refreshAvailability();

  if (isEnabled() && available.value) {
    locked.value = true;
    void tryUnlock();
  }

  if (!resumeListenerAttached) {
    resumeListenerAttached = true;
    try {
      const { App } = await import('@capacitor/app');

      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          lock();
          void tryUnlock();
        }
      });
    } catch {

    }
  }
}

export function useAppLock() {
  return { locked, available, isEnabled, setEnabled, init, tryUnlock, lock };
}
