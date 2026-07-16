
/** Human-friendly relative time: "Just now", "5m ago", "3h ago", "2d ago", or a date. */
export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return then.toLocaleDateString();
}

/** Strip HTML tags from a note's content, returning plain text. */
export function stripHtml(content: string | null | undefined): string {
  if (!content) return '';
  if (typeof window === 'undefined') {
    return content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const doc = new DOMParser().parseFromString(content, 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}

/** Return the src of the first <img> in the note's HTML content, or null. */
export function extractFirstImage(content: string | null | undefined): string | null {
  if (!content) return null;
  const match = content.match(/<img [^>]*src="([^"]+)"/);
  return match ? match[1] : null;
}
