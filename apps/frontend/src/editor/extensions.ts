import type { AnyExtension, Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import TextAlign from '@tiptap/extension-text-align';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Typography from '@tiptap/extension-typography';
import Image from '@tiptap/extension-image';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight } from 'lowlight';
import { SlashCommand } from './slash-command';

// lowlight v3: start with an EMPTY registry so the heavy highlight.js language
// grammars (the bulk of the editor bundle) are NOT in the initial chunk. The
// CodeBlockLowlight node must exist at editor-creation time (it defines a schema
// node), but its grammars are loaded on demand via loadCodeHighlighting().
const lowlight = createLowlight();

let highlightingLoaded = false;

/**
 * Lazily load + register the syntax-highlighting grammars (a separate async
 * chunk). Call once after the editor mounts. Idempotent. When the grammars
 * finish loading we re-highlight already-rendered code blocks once — but only
 * if the user isn't actively typing, to avoid a cursor jump.
 */
export async function loadCodeHighlighting(editor?: Editor | null): Promise<void> {
  if (highlightingLoaded) return;
  highlightingLoaded = true;
  try {
    const { default: languages } = await import('./highlight-languages');
    for (const [name, grammar] of Object.entries(languages)) {
      try { lowlight.register(name, grammar); } catch { /* already registered */ }
    }
    if (editor && !editor.isDestroyed && !editor.isFocused) {
      // Replacing the doc with itself forces the lowlight plugin to recompute
      // decorations with the now-registered grammars (emitUpdate=false so this
      // does not trigger save/sync). No-op visually except code now highlights.
      editor.commands.setContent(editor.getJSON(), false);
    }
  } catch {
    highlightingLoaded = false; // allow a later retry if the chunk failed to load
  }
}

/**
 * The full rich-text extension set for the Cinely note editor.
 *
 * NOTE: This intentionally does NOT include the Placeholder or
 * RemoteCursorExtension — those are wired in NoteEditorView so the
 * real-time collaboration logic stays untouched.
 */
export function richTextExtensions(): AnyExtension[] {
  return [
    // codeBlock is disabled here and replaced by CodeBlockLowlight below.
    StarterKit.configure({ codeBlock: false }),
    Underline,
    Link.configure({
      openOnClick: false,
      autolink: true,
      HTMLAttributes: {
        rel: 'noopener noreferrer nofollow',
        target: '_blank',
      },
    }),
    Highlight.configure({ multicolor: true }),
    TextStyle, // required by Color
    Color,
    TaskList,
    TaskItem.configure({ nested: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Subscript,
    Superscript,
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    Image.configure({ inline: false, allowBase64: false }),
    Typography, // smart quotes, dashes, arrows like Notion/Docs
    CodeBlockLowlight.configure({ lowlight }),
    SlashCommand,
  ];
}
