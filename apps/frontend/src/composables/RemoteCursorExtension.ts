import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';

export interface RemoteCursorData {
  userId: string;
  userName: string;
  color: string;
  from: number;
  to: number;
}

const pluginKey = new PluginKey<RemoteCursorData[]>('remoteCursors');

export function setCursors(view: EditorView, cursors: RemoteCursorData[]) {
  view.dispatch(view.state.tr.setMeta(pluginKey, cursors));
}

export const RemoteCursorExtension = Extension.create({
  name: 'remoteCursors',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pluginKey,
        state: {
          init: () => [] as RemoteCursorData[],
          apply(tr, prev) {
            const meta = tr.getMeta(pluginKey) as RemoteCursorData[] | undefined;
            return meta !== undefined ? meta : prev;
          },
        },
        props: {
          decorations(state) {
            const cursors = pluginKey.getState(state);
            if (!cursors?.length) return DecorationSet.empty;
            const docSize = state.doc.content.size;
            const decs: Decoration[] = [];

            for (const c of cursors) {
              const pos = Math.max(0, Math.min(c.from, docSize));

              const wrap = document.createElement('span');
              wrap.className = 'remote-cursor-wrap';
              wrap.style.cssText = `
                display: inline;
                position: relative;
                border-left: 2px solid ${c.color};
                margin-left: -1px;
              `;

              const label = document.createElement('div');
              label.style.cssText = `
                position: absolute;
                top: -22px;
                left: -1px;
                background: ${c.color};
                color: white;
                font-size: 11px;
                font-family: ui-sans-serif, system-ui, sans-serif;
                padding: 1px 6px;
                border-radius: 4px;
                white-space: nowrap;
                pointer-events: none;
                z-index: 50;
                line-height: 1.5;
              `;
              label.textContent = c.userName;
              wrap.appendChild(label);

              decs.push(Decoration.widget(pos, wrap, { side: -1, key: c.userId }));
            }

            return DecorationSet.create(state.doc, decs);
          },
        },
      }),
    ];
  },
});
