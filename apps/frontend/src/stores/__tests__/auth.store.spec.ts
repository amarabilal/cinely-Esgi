import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

// Keep the unit run hermetic: the store import chain reaches @capacitor/core
// via platform.ts. Stub it to web (non-native) so no native plugin is touched.
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));

import { useAuthStore } from '../auth.store';

describe('auth.store', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('syncAccessToken sets the accessToken ref (post silent-refresh)', () => {
    const store = useAuthStore();
    store.syncAccessToken('x');
    expect(store.accessToken).toBe('x');
  });
});
