import { describe, it, expect, vi } from 'vitest';

/**
 * Load useShare with the platform mocked to WEB (isNativePlatform=false) so the
 * native @capacitor/share plugin is never imported. We only exercise the pure
 * htmlToText helper here — not the native/web share dispatch.
 */
function loadShare() {
  vi.resetModules();
  vi.doMock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));
  return import('../useShare');
}

describe('htmlToText', () => {
  it('strips tags to plain text', async () => {
    const { htmlToText } = await loadShare();
    expect(htmlToText('<p>Hello <b>world</b></p>')).toBe('Hello world');
  });

  it('collapses 3+ blank lines and trims surrounding whitespace', async () => {
    const { htmlToText } = await loadShare();
    expect(htmlToText('  <div>a\n\n\n\nb</div>  ')).toBe('a\n\nb');
  });

  it('returns an empty string for empty markup', async () => {
    const { htmlToText } = await loadShare();
    expect(htmlToText('')).toBe('');
  });
});
