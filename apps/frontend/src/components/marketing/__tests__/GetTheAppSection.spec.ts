import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import GetTheAppSection from '../GetTheAppSection.vue';
import { ANDROID_APK_URL } from '@/lib/appLinks';

describe('GetTheAppSection', () => {
  it('links the download button to the evergreen APK URL', () => {
    const w = mount(GetTheAppSection);
    const a = w.find(`a[href="${ANDROID_APK_URL}"]`);
    expect(a.exists()).toBe(true);
    expect(a.text()).toContain('Download for Android');
  });

  it('shows the QR code, size and sideload hint', () => {
    const w = mount(GetTheAppSection);
    const img = w.find('img');
    expect(img.attributes('src')).toBe('/qr-android.svg');
    expect(img.attributes('alt')).toContain('QR');
    expect(w.text()).toContain('MB');
    expect(w.text()).toContain('unknown sources');
  });
});
