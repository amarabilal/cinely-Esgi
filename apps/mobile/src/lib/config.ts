/**
 * App-wide configuration. Read all env in one place; import the typed
 * constants everywhere else (no scattered process.env reads).
 *
 * The Android emulator reaches the host machine at 10.0.2.2, so the local
 * Docker backend on the host is at http://10.0.2.2:3000 by default.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3000';
export const API_BASE = `${API_URL}/api`;

/** Sent on every request so the native client receives the refresh token in the body. */
export const CLIENT_PLATFORM = 'capacitor';
