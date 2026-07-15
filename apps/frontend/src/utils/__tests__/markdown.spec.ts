import { describe, expect, it } from 'vitest';
import { markdownToNoteHtml } from '../markdown';

describe('markdownToNoteHtml', () => {
  it('converts headings, paragraphs, and emphasis to semantic HTML', () => {
    const html = markdownToNoteHtml(`# Title\n\n## Section\n\nText with **bold** and *italic* content.`);

    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<h2>Section</h2>');
    expect(html).toContain('<p>Text with <strong>bold</strong> and <em>italic</em> content.</p>');
  });

  it('converts ordered, unordered, and nested lists', () => {
    const html = markdownToNoteHtml(`- First\n  - Nested\n\n1. One\n2. Two`);

    expect(html).toContain('<ul>');
    expect(html).toContain('<li>First');
    expect(html.match(/<ul>/g)).toHaveLength(2);
    expect(html).toContain('<ol>');
    expect(html).toContain('<li>Two</li>');
  });

  it('converts blockquotes, fenced code, links, and line breaks', () => {
    const html = markdownToNoteHtml(`> Quoted\n\n\`\`\`ts\nconst ready = true;\n\`\`\`\n\n[Docs](https://example.com)\nnext line`);

    expect(html).toContain('<blockquote>');
    expect(html).toContain('<pre><code class="language-ts">');
    expect(html).toContain('<a href="https://example.com">Docs</a>');
    expect(html).toContain('<br>');
  });

  it('converts Markdown tables to Tiptap-compatible table elements', () => {
    const html = markdownToNoteHtml(`| Name | Value |\n| --- | ---: |\n| Answer | 42 |`);

    expect(html).toContain('<table>');
    expect(html).toContain('<thead>');
    expect(html).toContain('<th>Name</th>');
    expect(html).toContain('<td>Answer</td>');
    expect(html).toContain('<td style="text-align:right">42</td>');
  });

  it('escapes raw HTML and rejects unsafe links', () => {
    const html = markdownToNoteHtml(`<script>alert('xss')</script>\n\n[unsafe](javascript:alert('xss'))`);

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('href="javascript:');
  });

  it('returns an empty string for blank input', () => {
    expect(markdownToNoteHtml('  \n')).toBe('');
  });
});
