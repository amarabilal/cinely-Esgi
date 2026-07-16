import { describe, it, expect } from 'vitest';
import { ANDROID_APK_URL, ANDROID_APK_SIZE_LABEL, ANDROID_MIN_VERSION_LABEL } from '../appLinks';

describe('appLinks', () => {
  it('points at the evergreen GitHub Releases asset', () => {
    expect(ANDROID_APK_URL).toBe(
      'https://github.com/amarabilal/cinely-Esgi/releases/latest/download/cinely.apk',
    );
  });

  it('exposes human-readable size and minimum OS labels', () => {
    expect(ANDROID_APK_SIZE_LABEL).toMatch(/MB$/);
    expect(ANDROID_MIN_VERSION_LABEL).toMatch(/^Android /);
  });
});
