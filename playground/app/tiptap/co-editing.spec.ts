// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { Editor } from '@tiptap/core'
import { StarterKit } from '@tiptap/starter-kit'
import { RemoteCursors, applyRemoteContent, setRemoteCursors } from './co-editing'

const SAM = { id: 'tab-sam', name: 'Sam', colour: '#c084fc' }
const ALEX = { id: 'tab-alex', name: 'Alex', colour: '#14b8a6' }

let editor: Editor | undefined

function createEditor(content: string) {
  editor = new Editor({ element: document.createElement('div'), content, extensions: [StarterKit, RemoteCursors] })
  return editor
}

function carets(on: Editor) {
  return [...on.view.dom.querySelectorAll<HTMLElement>('[data-remote-cursor]')]
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

  test('other admins\' cursors stay drawn, at the positions they sent, which are in the document they saved', () => {
    const on = createEditor('<p>Hello</p>')
    setRemoteCursors(on, [{ ...SAM, from: 1, to: 5 }])

    applyRemoteContent(on, '<p>Big Hello</p>')

    expect(carets(on)).toHaveLength(1)
    expect(on.view.posAtDOM(carets(on)[0]!, 0)).toBe(5)
    expect(on.view.dom.querySelector('[data-remote-selection]')!.textContent).toBe('Big ')
  })

  test('parses another admin\'s save with the editor\'s own parse options, so the spaces they typed arrive as typed', () => {
    editor = new Editor({ element: document.createElement('div'), content: '<p>Hello</p>', extensions: [StarterKit, RemoteCursors], parseOptions: { preserveWhitespace: true } })

    applyRemoteContent(editor, '<p>Hello  there,   Sam</p>')

    expect(editor.getHTML()).toBe('<p>Hello  there,   Sam</p>')
  })

  test('empty HTML empties the editor', () => {
    const on = createEditor('<p>Hello</p>')

    applyRemoteContent(on, null)

    expect(on.isEmpty).toBe(true)
  })
})

describe('RemoteCursors: other admins\' cursors as decorations (#429)', () => {
  test('draws a caret per admin in their colour, named, and highlights a selection', () => {
    const on = createEditor('<p>Hello there</p>')

    setRemoteCursors(on, [{ ...SAM, from: 2, to: 6 }, { ...ALEX, from: 8, to: 8 }])

    const drawn = carets(on)
    expect(drawn.map(caret => caret.textContent)).toEqual(['Sam', 'Alex'])
    expect(drawn[0]!.style.borderLeftColor).toBe('#c084fc')
    expect(drawn[1]!.style.borderLeftColor).toBe('#14b8a6')
    const highlighted = on.view.dom.querySelectorAll<HTMLElement>('[data-remote-selection]')
    expect(highlighted).toHaveLength(1)
    expect(highlighted[0]!.textContent).toBe('ello')
    expect(highlighted[0]!.style.backgroundColor).not.toBe('')
  })

  test('a caret never takes clicks or text from the document', () => {
    const on = createEditor('<p>Hello</p>')

    setRemoteCursors(on, [{ ...SAM, from: 3, to: 3 }])

    expect(carets(on)[0]!.style.pointerEvents).toBe('none')
    expect(on.getText()).toBe('Hello')
    expect(on.getHTML()).toBe('<p>Hello</p>')
  })

  test('a cursor past the end of this admin\'s document is drawn at its end', () => {
    const on = createEditor('<p>Hi</p>')

    setRemoteCursors(on, [{ ...SAM, from: 40, to: 50 }])

    expect(carets(on)).toHaveLength(1)
    expect(on.view.dom.querySelectorAll('[data-remote-selection]')).toHaveLength(0)
  })

  test('a caret moves with this admin\'s own typing before it', () => {
    const on = createEditor('<p>Hello</p>')
    setRemoteCursors(on, [{ ...SAM, from: 4, to: 4 }])

    on.commands.insertContentAt(1, 'Oh, ')

    const caret = carets(on)[0]!
    expect(on.view.posAtDOM(caret, 0)).toBe(8)
  })

  test('a cursor listed again at the position it was sent at stays where this admin\'s typing moved it; a new position moves it', () => {
    const on = createEditor('<p>Hello</p>')
    setRemoteCursors(on, [{ ...SAM, from: 3, to: 3 }])
    on.commands.insertContentAt(1, 'ZZ')

    setRemoteCursors(on, [{ ...SAM, from: 3, to: 3 }, { ...ALEX, from: 2, to: 2 }])
    expect(on.view.posAtDOM(carets(on).find(caret => caret.textContent === 'Sam')!, 0)).toBe(5)

    setRemoteCursors(on, [{ ...SAM, from: 4, to: 4 }])
    expect(on.view.posAtDOM(carets(on)[0]!, 0)).toBe(4)
  })

  test('a cursor no longer listed is removed', () => {
    const on = createEditor('<p>Hello</p>')
    setRemoteCursors(on, [{ ...SAM, from: 2, to: 2 }, { ...ALEX, from: 3, to: 3 }])

    setRemoteCursors(on, [{ ...ALEX, from: 3, to: 3 }])
    expect(carets(on).map(caret => caret.textContent)).toEqual(['Alex'])

    setRemoteCursors(on, [])
    expect(carets(on)).toHaveLength(0)
  })
})
