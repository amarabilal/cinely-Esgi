import { isNative } from './platform';

const ACCESS_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}
export function setAccessToken(token: string): void {
  localStorage.setItem(ACCESS_KEY, token);
}
export function clearAccessToken(): void {
  localStorage.removeItem(ACCESS_KEY);
}

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
