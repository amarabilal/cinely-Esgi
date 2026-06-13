import { isNative } from './platform';

const ACCESS_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';

// --- Access token: synchronous localStorage on all platforms ---------------
// (Used in the axios request interceptor on every call; must stay sync.
//  The Android WebView persists localStorage across app restarts.)
export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}
export function setAccessToken(token: string): void {
  localStorage.setItem(ACCESS_KEY, token);
}
export function clearAccessToken(): void {
  localStorage.removeItem(ACCESS_KEY);
}

// --- Refresh token: async, native-only -------------------------------------
// On web the refresh token is an httpOnly cookie and never touches JS.
// On native there is no cookie, so we persist it via Capacitor Preferences
// and send it in the refresh request body.
export async function getRefreshToken(): Promise<string | null> {
  if (!isNative) return null;
  const { Preferences } = await import('@capacitor/preferences');
  const { value } = await Preferences.get({ key: REFRESH_KEY });
  return value;
}
export async function setRefreshToken(token: string): Promise<void> {
  if (!isNative) return;
  const { Preferences } = await import('@capacitor/preferences');
  await Preferences.set({ key: REFRESH_KEY, value: token });
}
export async function clearRefreshToken(): Promise<void> {
  if (!isNative) return;
  const { Preferences } = await import('@capacitor/preferences');
  await Preferences.remove({ key: REFRESH_KEY });
}
