// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { Editor } from '@tiptap/core'
import { StarterKit } from '@tiptap/starter-kit'
import { applyRemoteContent, sameContent } from './co-editing'

let editor: Editor | undefined

function createEditor(content: string) {
  editor = new Editor({ element: document.createElement('div'), content, extensions: [StarterKit] })
  return editor
}

afterEach(() => {
  editor?.destroy()
  editor = undefined
})

describe('applyRemoteContent: another admin\'s saved HTML reaching the editor (#429)', () => {
  test('replaces the content without reporting it as this admin\'s own edit', () => {
    const on = createEditor('<p>Hello</p>')
    const update = vi.fn()
    on.on('update', update)

    applyRemoteContent(on, '<p>Hello world</p>')

    expect(on.getHTML()).toBe('<p>Hello world</p>')
    expect(update).not.toHaveBeenCalled()
  })

  test('keeps the cursor where it was', () => {
    const on = createEditor('<p>Hello there</p>')
    on.commands.setTextSelection({ from: 3, to: 5 })

    applyRemoteContent(on, '<p>Hello there, Sam</p>')

    expect(on.state.selection.from).toBe(3)
    expect(on.state.selection.to).toBe(5)
  })

  test('pulls the cursor back inside a shorter document', () => {
    const on = createEditor('<p>A much longer paragraph</p>')
    on.commands.setTextSelection({ from: 10, to: 20 })

    applyRemoteContent(on, '<p>Hi</p>')

    expect(on.state.selection.from).toBe(3)
    expect(on.state.selection.to).toBe(3)
  })

  test('keeps the cursor on the same text when text is added before it', () => {
    const on = createEditor('<p>Hello there</p>')
    on.commands.setTextSelection(7)

    applyRemoteContent(on, '<p>XXXX Hello there</p>')

    expect(on.state.doc.textBetween(on.state.selection.from - 6, on.state.selection.from)).toBe('Hello ')
  })

  test('undo never takes back another admin\'s save', () => {
    const on = createEditor('<p>Hello</p>')

    applyRemoteContent(on, '<p>Hello and peer</p>')
    on.commands.undo()

    expect(on.getHTML()).toBe('<p>Hello and peer</p>')
  })

  test('undo still takes back this admin\'s own typing around another admin\'s save', () => {
    const on = createEditor('<p>Hello</p>')
    on.commands.insertContentAt(6, '!')

    applyRemoteContent(on, '<p>Peer: Hello!</p>')
    on.commands.undo()

    expect(on.getHTML()).toBe('<p>Peer: Hello</p>')
  })

  test('parses another admin\'s save with the editor\'s own parse options, so the spaces they typed arrive as typed', () => {
    editor = new Editor({ element: document.createElement('div'), content: '<p>Hello</p>', extensions: [StarterKit], parseOptions: { preserveWhitespace: true } })

    applyRemoteContent(editor, '<p>Hello  there,   Sam</p>')

    expect(editor.getHTML()).toBe('<p>Hello  there,   Sam</p>')
  })

  test('empty HTML empties the editor', () => {
    const on = createEditor('<p>Hello</p>')

    applyRemoteContent(on, null)

    expect(on.isEmpty).toBe(true)
  })
})

describe('sameContent: whether stored HTML already says what the editor holds (#435)', () => {
  test('HTML written differently but parsing to the same document is the same content', () => {
    const on = createEditor('<p>One</p><p>Two</p>')

    expect(sameContent(on, '<p>One</p>\n    <p>Two</p>')).toBe(true)
    expect(sameContent(on, '<p>One</p><p>Two!</p>')).toBe(false)
  })

  test('no HTML is the same content as an empty editor', () => {
    const on = createEditor('')

    expect(sameContent(on, null)).toBe(true)
    expect(sameContent(on, '<p>Hi</p>')).toBe(false)
  })
})
