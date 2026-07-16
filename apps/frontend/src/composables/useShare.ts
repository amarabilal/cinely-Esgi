import { isNative } from '@/lib/platform';
import { toast } from 'vue-sonner';

/** Strip HTML to a plain-text string for sharing. */
export function htmlToText(html: string): string {
  const el = document.createElement('div');
  el.innerHTML = html;
  return (el.textContent || el.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
}

export function useShare() {
  /**
   * Share a note's title + plain-text content via the OS share sheet.
   * - Native (Capacitor): @capacitor/share (dynamically imported so web never bundles it).
   * - Web: prefers the Web Share API, else copies to the clipboard.
   * User-cancelled shares are swallowed rather than surfaced as errors.
   */
  async function shareNote(opts: { title: string; content?: string; url?: string }): Promise<void> {
    const title = opts.title?.trim() || 'Untitled note';
    const text = opts.content ? htmlToText(opts.content).slice(0, 5000) : title;
    try {
      if (isNative) {
        const { Share } = await import('@capacitor/share');
        await Share.share({ title, text, url: opts.url, dialogTitle: 'Share note' });
        return;
      }

      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title, text, url: opts.url });
        return;
      }
      await navigator.clipboard.writeText(opts.url ? `${title}\n${opts.url}` : `${title}\n\n${text}`);
      toast.success('Copied to clipboard');
    } catch (err: any) {

      if (err?.name === 'AbortError') return;

      const msg = String(err?.message || '');
      if (/cancel/i.test(msg)) return;
      toast.error('Could not share');
    }
  }

  return { shareNote };
}
