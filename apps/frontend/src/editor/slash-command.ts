import { Extension } from '@tiptap/core';
import type { Editor, Range } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { pickAndInsertImage } from '@/composables/useImageUpload';
import type {
  SuggestionOptions,
  SuggestionProps,
  SuggestionKeyDownProps,
} from '@tiptap/suggestion';

/**
 * A single slash-command entry.
 * `action` receives an editor chain already focused on `range` (the slash text
 * has been deleted) and must run the desired command.
 */
export interface SlashCommandItem {
  title: string;
  description: string;
  /** Lucide-equivalent icon name — unused by the plain DOM menu, kept for reference. */
  icon?: string;
  action: (props: { editor: Editor; range: Range }) => void;
}

/**
 * The full Notion-style command list. Each `action` deletes the slash range
 * first (done in `command` below) then runs the block transformation.
 */
const COMMANDS: SlashCommandItem[] = [
  {
    title: 'Heading 1',
    description: 'Big section heading',
    icon: 'heading-1',
    action: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run(),
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: 'heading-2',
    action: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run(),
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    icon: 'heading-3',
    action: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run(),
  },
  {
    title: 'Bullet list',
    description: 'Create a simple bulleted list',
    icon: 'list',
    action: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: 'Numbered list',
    description: 'Create an ordered list',
    icon: 'list-ordered',
    action: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: 'To-do list',
    description: 'Track tasks with checkboxes',
    icon: 'list-checks',
    action: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    title: 'Quote',
    description: 'Capture a quote',
    icon: 'quote',
    action: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: 'Code block',
    description: 'Capture a code snippet',
    icon: 'code',
    action: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: 'Divider',
    description: 'Visually divide blocks',
    icon: 'minus',
    action: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    title: 'Table',
    description: 'Insert a 3×3 table',
    icon: 'table',
    action: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
  {
    title: 'Image',
    description: 'Upload a photo or pick from gallery',
    icon: 'image-plus',
    action: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      void pickAndInsertImage(editor);
    },
  },
];

/** Case-insensitive filter over the command titles + descriptions. */
function filterItems(query: string): SlashCommandItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return COMMANDS;
  return COMMANDS.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q),
  );
}

/**
 * A self-contained floating menu rendered as plain DOM (no tippy dependency).
 * Positions itself with `props.clientRect()` as a fixed-position element on
 * document.body, supports keyboard navigation and click selection.
 */
class SlashCommandMenu {
  private root: HTMLDivElement;
  private items: SlashCommandItem[] = [];
  private selectedIndex = 0;
  private command!: (item: SlashCommandItem) => void;

  constructor() {
    this.root = document.createElement('div');
    this.root.className =
      'cinely-slash-menu rounded-md border border-border bg-popover text-popover-foreground shadow-lg p-1';
    this.root.style.position = 'fixed';
    this.root.style.zIndex = '60';
    this.root.style.maxHeight = '20rem';
    this.root.style.overflowY = 'auto';
    this.root.style.minWidth = '14rem';

    this.root.style.transformOrigin = 'top';
    this.root.style.opacity = '0';
    this.root.style.transform = 'translateY(-4px) scale(0.98)';
    this.root.style.transition = 'opacity 0.12s ease, transform 0.12s ease';

    this.root.addEventListener('mousedown', (e) => e.preventDefault());
  }

  mount() {
    document.body.appendChild(this.root);

    requestAnimationFrame(() => {
      this.root.style.opacity = '1';
      this.root.style.transform = 'none';
    });
  }

  update(
    items: SlashCommandItem[],
    command: (item: SlashCommandItem) => void,
    clientRect?: (() => DOMRect | null) | null,
  ) {
    this.items = items;
    this.command = command;
    if (this.selectedIndex >= items.length) this.selectedIndex = 0;
    this.renderItems();
    this.position(clientRect);
  }

  private renderItems() {
    this.root.innerHTML = '';
    if (this.items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'px-2 py-1.5 text-sm text-muted-foreground';
      empty.textContent = 'No results';
      this.root.appendChild(empty);
      return;
    }
    this.items.forEach((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      const active = index === this.selectedIndex;
      button.className =
        'cinely-slash-item flex w-full flex-col items-start gap-0.5 rounded px-2 py-1.5 text-left text-sm ' +
        (active
          ? 'bg-accent text-accent-foreground'
          : 'text-popover-foreground');
      const title = document.createElement('span');
      title.className = 'font-medium';
      title.textContent = item.title;
      const desc = document.createElement('span');
      desc.className = 'text-xs text-muted-foreground';
      desc.textContent = item.description;
      button.appendChild(title);
      button.appendChild(desc);
      button.addEventListener('mouseenter', () => {
        this.selectedIndex = index;
        this.renderItems();
      });
      button.addEventListener('click', () => this.select(index));
      this.root.appendChild(button);
    });
  }

  private position(clientRect?: (() => DOMRect | null) | null) {
    if (!clientRect) return;
    const rect = clientRect();
    if (!rect) return;

    const menuHeight = this.root.offsetHeight || 240;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow < menuHeight + 8 && rect.top > menuHeight
        ? rect.top - menuHeight - 4
        : rect.bottom + 4;
    this.root.style.left = `${Math.round(rect.left)}px`;
    this.root.style.top = `${Math.round(top)}px`;
  }

  onKeyDown(event: KeyboardEvent): boolean {
    if (this.items.length === 0) return false;
    if (event.key === 'ArrowUp') {
      this.selectedIndex =
        (this.selectedIndex + this.items.length - 1) % this.items.length;
      this.renderItems();
      return true;
    }
    if (event.key === 'ArrowDown') {
      this.selectedIndex = (this.selectedIndex + 1) % this.items.length;
      this.renderItems();
      return true;
    }
    if (event.key === 'Enter') {
      this.select(this.selectedIndex);
      return true;
    }
    return false;
  }

  private select(index: number) {
    const item = this.items[index];
    if (item && this.command) this.command(item);
  }

  destroy() {
    this.root.remove();
  }
}

export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        startOfLine: false,
        command: ({ editor, range, props }) => {

          (props as SlashCommandItem).action({ editor, range });
        },
        items: ({ query }) => filterItems(query),
        render: () => {
          let menu: SlashCommandMenu | null = null;
          return {
            onStart: (props: SuggestionProps<SlashCommandItem>) => {
              menu = new SlashCommandMenu();
              menu.mount();
              menu.update(props.items, props.command, props.clientRect);
            },
            onUpdate: (props: SuggestionProps<SlashCommandItem>) => {
              menu?.update(props.items, props.command, props.clientRect);
            },
            onKeyDown: (props: SuggestionKeyDownProps) => {
              if (props.event.key === 'Escape') {
                menu?.destroy();
                menu = null;
                return true;
              }
              return menu?.onKeyDown(props.event) ?? false;
            },
            onExit: () => {
              menu?.destroy();
              menu = null;
            },
          };
        },
      } as Omit<SuggestionOptions<SlashCommandItem>, 'editor'>,
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommandItem>({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

export default SlashCommand;
