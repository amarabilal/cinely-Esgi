import { describe, it, expect, vi, beforeEach } from 'vitest';

const prefs: Record<string, string> = {};

function loadStore(native: boolean) {
  vi.resetModules();
  for (const k of Object.keys(prefs)) delete prefs[k];
  vi.doMock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native } }));
  vi.doMock('@capacitor/preferences', () => ({
    Preferences: {
      get: async ({ key }: { key: string }) => ({ value: prefs[key] ?? null }),
      set: async ({ key, value }: { key: string; value: string }) => { prefs[key] = value; },
      remove: async ({ key }: { key: string }) => { delete prefs[key]; },
    },
  }));
  return import('../tokenStore');
}

describe('tokenStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores the access token in localStorage on every platform', async () => {
    const s = await loadStore(false);
    s.setAccessToken('abc');
    expect(s.getAccessToken()).toBe('abc');
    expect(localStorage.getItem('accessToken')).toBe('abc');
    s.clearAccessToken();
    expect(s.getAccessToken()).toBeNull();
  });

  it('does not persist a refresh token on web (cookie handles it)', async () => {
    const s = await loadStore(false);
    await s.setRefreshToken('r1');
    expect(await s.getRefreshToken()).toBeNull();
  });

  it('persists the refresh token in Preferences on native', async () => {
    const s = await loadStore(true);
    await s.setRefreshToken('r1');
    expect(await s.getRefreshToken()).toBe('r1');
    await s.clearRefreshToken();
    expect(await s.getRefreshToken()).toBeNull();
  });
});
