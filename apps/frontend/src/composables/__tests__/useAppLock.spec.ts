import { describe, it, expect, vi, beforeEach } from 'vitest';

const STORAGE_KEY = 'cinely-biometric-lock';

/**
 * Load useAppLock with the platform mocked to WEB (isNativePlatform=false), so
 * init()/lock() stay inert and no native plugin is loaded. We only exercise the
 * pure localStorage persistence of the enabled flag here.
 */
function loadAppLock() {
  vi.resetModules();
  vi.doMock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));
  return import('../useAppLock');
}

describe('useAppLock flag persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('isEnabled() defaults to false when nothing is stored', async () => {
    const { useAppLock } = await loadAppLock();
    expect(useAppLock().isEnabled()).toBe(false);
  });

  it('setEnabled(true) persists "true" and isEnabled() reads it back', async () => {
    const { useAppLock } = await loadAppLock();
    const lock = useAppLock();
    await lock.setEnabled(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
    expect(lock.isEnabled()).toBe(true);
  });

  it('setEnabled(false) persists "false", clears locked, and isEnabled() is false', async () => {
    const { useAppLock } = await loadAppLock();
    const lock = useAppLock();
    await lock.setEnabled(true);
    await lock.setEnabled(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('false');
    expect(lock.isEnabled()).toBe(false);
    expect(lock.locked.value).toBe(false);
  });

  it('init() and lock() are inert on web (locked stays false)', async () => {
    const { useAppLock } = await loadAppLock();
    const lock = useAppLock();
    localStorage.setItem(STORAGE_KEY, 'true');
    await lock.init();
    lock.lock();
    expect(lock.locked.value).toBe(false);
    expect(lock.available.value).toBe(false);
  });
});
