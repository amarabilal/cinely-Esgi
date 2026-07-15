import MarkdownIt from 'markdown-it';

/**
 * Deep Research returns Markdown, while notes are stored as the semantic HTML
 * consumed by Tiptap. Raw HTML is deliberately disabled so generated content
 * cannot inject arbitrary elements or attributes into previews or saved notes.
 */
const noteMarkdown = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
});

export function markdownToNoteHtml(markdown: string): string {
  if (!markdown.trim()) return '';
  return noteMarkdown.render(markdown);
}
