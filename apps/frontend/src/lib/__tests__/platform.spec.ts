import { describe, it, expect, vi, beforeEach } from 'vitest';

function loadPlatform(native: boolean, envUrl?: string) {
  vi.resetModules();
  vi.doMock('@capacitor/core', () => ({
    Capacitor: { isNativePlatform: () => native },
  }));
  vi.stubEnv('VITE_API_BASE_URL', envUrl ?? '');
  return import('../platform');
}

describe('platform', () => {
  beforeEach(() => vi.unstubAllEnvs());

  it('uses relative /api and same-origin socket on web', async () => {
    const p = await loadPlatform(false);
    expect(p.isNative).toBe(false);
    expect(p.API_BASE_URL).toBe('/api');
    expect(p.SOCKET_URL).toBeUndefined();
  });

  it('uses the live backend origin on native by default', async () => {
    const p = await loadPlatform(true);
    expect(p.isNative).toBe(true);
    expect(p.API_BASE_URL).toBe('https://cinely.fr/api');
    expect(p.SOCKET_URL).toBe('https://cinely.fr');
  });

  it('honours VITE_API_BASE_URL on native', async () => {
    const p = await loadPlatform(true, 'http://10.0.2.2:3000');
    expect(p.API_BASE_URL).toBe('http://10.0.2.2:3000/api');
    expect(p.SOCKET_URL).toBe('http://10.0.2.2:3000');
  });
});
