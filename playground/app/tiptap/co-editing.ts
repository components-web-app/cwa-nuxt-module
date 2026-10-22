import { Extension } from '@tiptap/core'
import type { Editor } from '@tiptap/core'
import type { Node } from '@tiptap/pm/model'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export interface RemoteCursor {
  id: string
  name: string
  colour: string
  from: number
  to: number
}

const key = new PluginKey<DecorationSet>('remoteCursors')

export function applyRemoteContent(editor: Editor, html: string | null | undefined) {
  const { from, to } = editor.state.selection
  editor.commands.setContent(html || '', { emitUpdate: false })
  editor.commands.setTextSelection({ from, to })
}

export function setRemoteCursors(editor: Editor, cursors: RemoteCursor[]) {
  editor.view.dispatch(editor.state.tr.setMeta(key, cursors))
}

function caret(cursor: RemoteCursor) {
  const element = document.createElement('span')
  element.dataset.remoteCursor = cursor.id
  element.style.cssText = 'position: relative; margin: 0 -1px; border-left: 2px solid; pointer-events: none'
  element.style.borderLeftColor = cursor.colour
  const label = document.createElement('span')
  label.textContent = cursor.name
  label.style.cssText = 'position: absolute; bottom: 100%; left: -2px; padding: 1px 4px; border-radius: 2px 2px 2px 0; font: 500 11px/1.2 sans-serif; white-space: nowrap; color: #1c1917; user-select: none'
  label.style.backgroundColor = cursor.colour
  element.append(label)
  return element
}

function decorations(doc: Node, cursors: RemoteCursor[]) {
  const start = TextSelection.atStart(doc).from
  const end = TextSelection.atEnd(doc).to
  const clamp = (position: number) => Math.min(Math.max(position, start), end)
  return DecorationSet.create(doc, cursors.flatMap((cursor) => {
    const from = clamp(Math.min(cursor.from, cursor.to))
    const to = clamp(Math.max(cursor.from, cursor.to))
    return [
      Decoration.inline(from, to, { 'data-remote-selection': cursor.id, 'style': `background-color: ${cursor.colour}40` }),
      Decoration.widget(to, () => caret(cursor), { key: `${cursor.id}:${cursor.name}:${cursor.colour}`, side: 1 }),
    ]
  }))
}

export const RemoteCursors = Extension.create({
  name: 'remoteCursors',
  addProseMirrorPlugins() {
    return [new Plugin<DecorationSet>({
      key,
      state: {
        init: () => DecorationSet.empty,
        apply: (tr, drawn) => {
          const cursors = tr.getMeta(key) as RemoteCursor[] | undefined
          return cursors ? decorations(tr.doc, cursors) : drawn.map(tr.mapping, tr.doc)
        },
      },
      props: {
        decorations: state => key.getState(state),
      },
    })]
  },
})
