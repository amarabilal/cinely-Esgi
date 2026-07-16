import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

async function mountCard(native: boolean) {
  vi.doMock('@capacitor/core', () => ({
    Capacitor: { isNativePlatform: () => native },
  }));
  const { default: MobileAppCard } = await import('../MobileAppCard.vue');
  return mount(MobileAppCard);
}

describe('MobileAppCard', () => {
  it('renders the APK download link on the web', async () => {
    const { ANDROID_APK_URL } = await import('@/lib/appLinks');
    const w = await mountCard(false);
    const a = w.find(`a[href="${ANDROID_APK_URL}"]`);
    expect(a.exists()).toBe(true);
    expect(w.text()).toContain('Mobile app');
  });

  it('renders nothing inside the native (Capacitor) shell', async () => {
    const w = await mountCard(true);
    expect(w.find('a').exists()).toBe(false);
    expect(w.find('div').exists()).toBe(false);
    expect(w.text()).toBe('');
  });
});
