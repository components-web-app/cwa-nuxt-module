// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import * as Y from 'yjs'
import { Editor } from '@tiptap/core'
import { StarterKit } from '@tiptap/starter-kit'
import { Collaboration } from '@tiptap/extension-collaboration'
import { createCursorChannel, YRemoteCursors } from './y-cursors'
import type { YCursor } from './y-sync'
import { seedUpdate } from './y-seed'

const editors: Editor[] = []

function linked(html: string) {
  const docs = [new Y.Doc(), new Y.Doc()] as const
  docs.forEach((doc, index) => {
    Y.applyUpdate(doc, seedUpdate(html, new Editor({ extensions: [StarterKit] }).schema))
    doc.on('update', (update: Uint8Array, origin: unknown) => origin !== 'peer' && Y.applyUpdate(docs[1 - index]!, update, 'peer'))
  })
  return docs
}

function editorOn(doc: Y.Doc, onLocal: (cursor: YCursor) => void = () => {}) {
  const channel = createCursorChannel(onLocal)
  const element = document.createElement('div')
  document.body.append(element)
  const editor = new Editor({ element, extensions: [StarterKit.configure({ undoRedo: false }), Collaboration.configure({ document: doc }), YRemoteCursors.configure({ channel })] })
  editors.push(editor)
  return { editor, channel }
}

function carets(on: Editor) {
  return [...on.view.dom.querySelectorAll<HTMLElement>('[data-remote-cursor]')]
}

afterEach(() => {
  editors.splice(0).forEach(editor => editor.destroy())
  document.body.innerHTML = ''
})

describe('cursors over Yjs (#435)', () => {
  test('sends this window\'s cursor as Yjs positions while it has focus, and none once it loses it', async () => {
    const [doc] = linked('<p>Hello there</p>')
    const onLocal = vi.fn()
    const { editor } = editorOn(doc, onLocal)
    await vi.waitFor(() => expect(editor.getText()).toBe('Hello there'))

    editor.view.focus()
    editor.commands.setTextSelection({ from: 2, to: 4 })
    await vi.waitFor(() => expect(onLocal).toHaveBeenLastCalledWith({ anchor: expect.objectContaining({ assoc: expect.any(Number) }), head: expect.anything() }))

    editor.view.dom.blur()
    editor.view.dom.dispatchEvent(new FocusEvent('focusout'))
    await vi.waitFor(() => expect(onLocal).toHaveBeenLastCalledWith(null))
  })

  test('draws another window\'s cursor, named, in its colour, with its selection', async () => {
    const [mine, theirs] = linked('<p>Hello there</p>')
    let sent: YCursor = null
    const peer = editorOn(theirs, (cursor) => {
      sent = cursor
    })
    const { editor, channel } = editorOn(mine)
    await vi.waitFor(() => expect(editor.getText()).toBe('Hello there'))
    peer.editor.view.focus()
    peer.editor.commands.setTextSelection({ from: 2, to: 6 })
    await vi.waitFor(() => expect(sent).not.toBeNull())

    channel.setRemote([{ clientId: 'tab-sam', id: theirs.clientID, name: 'Sam', colour: '#c084fc', cursor: sent }])

    await vi.waitFor(() => expect(carets(editor).map(caret => caret.textContent)).toEqual(['Sam']))
    expect(carets(editor)[0]!.dataset.remoteCursor).toBe('tab-sam')
    expect(carets(editor)[0]!.style.borderLeftColor).toBe('#c084fc')
    expect(carets(editor)[0]!.style.pointerEvents).toBe('none')
    expect(editor.view.dom.querySelector('[data-remote-selection]')!.textContent).toBe('ello')
  })

  test('a cursor stays on the same text when an edit before it arrives from another window', async () => {
    const [mine, theirs] = linked('<p>Hello</p>')
    let sent: YCursor = null
    const peer = editorOn(theirs, (cursor) => {
      sent = cursor
    })
    const { editor, channel } = editorOn(mine)
    await vi.waitFor(() => expect(editor.getText()).toBe('Hello'))
    peer.editor.view.focus()
    peer.editor.commands.setTextSelection(4)
    await vi.waitFor(() => expect(sent).not.toBeNull())
    channel.setRemote([{ clientId: 'tab-sam', id: theirs.clientID, name: 'Sam', colour: '#c084fc', cursor: sent }])
    await vi.waitFor(() => expect(carets(editor)).toHaveLength(1))

    peer.editor.chain().insertContentAt(1, 'Oh, ').setTextSelection(8).run()
    await vi.waitFor(() => expect(editor.getText()).toBe('Oh, Hello'))

    await vi.waitFor(() => expect(editor.view.posAtDOM(carets(editor)[0]!, 0)).toBe(8))
  })

  test('a cursor no longer listed is removed', async () => {
    const [mine, theirs] = linked('<p>Hello</p>')
    let sent: YCursor = null
    const peer = editorOn(theirs, (cursor) => {
      sent = cursor
    })
    const { editor, channel } = editorOn(mine)
    await vi.waitFor(() => expect(editor.getText()).toBe('Hello'))
    peer.editor.view.focus()
    peer.editor.commands.setTextSelection(3)
    await vi.waitFor(() => expect(sent).not.toBeNull())
    channel.setRemote([{ clientId: 'tab-sam', id: theirs.clientID, name: 'Sam', colour: '#c084fc', cursor: sent }])
    await vi.waitFor(() => expect(carets(editor)).toHaveLength(1))

    channel.setRemote([])

    await vi.waitFor(() => expect(carets(editor)).toHaveLength(0))
  })
})
