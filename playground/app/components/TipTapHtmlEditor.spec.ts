// @vitest-environment nuxt
import { afterEach, describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { computed, nextTick, ref } from 'vue'
import type { Ref } from 'vue'
import type { Editor } from '@tiptap/core'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import type { FocusedPeer } from '#cwa/composables/cwa-resource-model'
import type { RealtimeEventHandler } from '#cwa/composables/cwa-realtime'
import { BubbleMenu, FloatingMenu } from '@tiptap/vue-3/menus'
import type { YSyncData } from '~/tiptap/y-sync'
import TipTapHtmlEditor from './TipTapHtmlEditor.vue'

const realtime = vi.hoisted(() => ({
  iri: undefined as undefined | (() => string | undefined),
  send: vi.fn((..._args: unknown[]) => true),
  handlers: {} as Record<string, (message: any) => void>,
  tabs: [] as { clientId: string, handlers: Record<string, (message: any) => void> }[],
  peers: undefined as undefined | Ref<unknown[]>,
  delayMs: 5,
  scope: {} as object,
}))

mockNuxtImport('useCwa', () => () => realtime.scope)

mockNuxtImport('useCwaRealtime', () => (iri: () => string | undefined) => {
  realtime.iri = iri
  const tab = { clientId: `tab-${realtime.tabs.length}`, handlers: {} as Record<string, (message: any) => void> }
  realtime.tabs.push(tab)
  realtime.handlers = tab.handlers
  return {
    peers: computed(() => realtime.peers?.value ?? []),
    send: (event: string, data: unknown) => {
      realtime.send(event, data)
      const published = JSON.parse(JSON.stringify(data))
      const recipients = realtime.tabs.filter(other => other !== tab)
      setTimeout(() => recipients.forEach(other => other.handlers[event]?.({ ...message(published, { clientId: tab.clientId }), event })), realtime.delayMs)
      return true
    },
    on: (event: string, handler: RealtimeEventHandler) => {
      tab.handlers[event] = handler
      return () => {
        delete tab.handlers[event]
      }
    },
  }
})

const peersOnResource = ref<unknown[]>([])
realtime.peers = peersOnResource

const SAM = { user: { id: '/users/sam', name: 'Sam' }, name: 'Sam', colour: '#c084fc', isSelf: false, clientIds: ['tab-sam'] }
const ME = { user: { id: '/users/me', name: 'Me' }, name: 'You (other window)', colour: '#a8a29e', isSelf: true, clientIds: ['tab-me'] }

let wrapper: VueWrapper | undefined

function resourceModel(html: string) {
  const stored = ref<string | null>(html)
  const held = ref()
  const focused = ref<FocusedPeer[]>([])
  return {
    stored,
    held,
    focused,
    field: {
      model: computed({ get: () => stored.value, set: (value) => { stored.value = value } }),
      remoteChange: computed(() => held.value),
      focusedBy: computed(() => focused.value),
      focusListeners: { onFocusin: vi.fn(), onFocusout: vi.fn(), onPointerdown: vi.fn() },
    },
  }
}

async function mountEditor(html = '<p>Hello there</p>') {
  realtime.scope = {}
  const model = resourceModel(html)
  wrapper = mount(TipTapHtmlEditor, { props: { model: model.field as any, iri: '/component/html_contents/1' }, attachTo: document.body })
  await vi.waitFor(() => expect(editorOf(wrapper!)?.isEditable).toBe(true))
  return { ...model, wrapper, editor: editorOf(wrapper)! }
}

const others: VueWrapper[] = []

async function mountAnother(html: string, timeout = 3000, sameTab = false) {
  realtime.scope = sameTab ? realtime.scope : {}
  const model = resourceModel(html)
  const another = mount(TipTapHtmlEditor, { props: { model: model.field as any, iri: '/component/html_contents/1' }, attachTo: document.body })
  others.push(another)
  await vi.waitFor(() => expect(editorOf(another)?.isEditable).toBe(true), { timeout })
  return { ...model, wrapper: another, editor: editorOf(another)! }
}

function selectionsSent() {
  return realtime.send.mock.calls.filter(([event]) => event === 'selection')
}

function editorOf(on: VueWrapper): Editor | undefined {
  return (on.vm as unknown as { editor?: Editor }).editor
}

function carets() {
  return [...document.querySelectorAll<HTMLElement>('[data-remote-cursor]')].map(caret => caret.textContent)
}

type Sender = Partial<{ clientId: string, user: { id: string, name?: string }, name: string, colour: string, isSelf: boolean }>

function message(data: unknown, sender: Sender = {}) {
  return { clientId: 'tab-sam', user: SAM.user, name: SAM.name, colour: SAM.colour, isSelf: false, event: 'selection', data, sentAt: '2026-10-21T10:00:00Z', ...sender }
}

function selection(from: number, to: number, sender: Sender = {}) {
  realtime.handlers.selection!(message({ selection: { from, to } }, sender))
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  others.splice(0).forEach(other => other.unmount())
  realtime.handlers = {}
  realtime.tabs = []
  peersOnResource.value = []
  realtime.delayMs = 5
})

describe('TipTapHtmlEditor: the co-editing reference editor (#429)', () => {
  test('saves what is typed through the resource model, and talks about the resource it is given', async () => {
    const { editor, stored } = await mountEditor('<p>Hello</p>')

    editor.commands.insertContentAt(6, ' world')

    expect(stored.value).toBe('<p>Hello world</p>')
    expect(realtime.iri?.()).toBe('/component/html_contents/1')
  })

  test('another admin\'s saved HTML is applied in place, keeping the cursor', async () => {
    const { editor, stored } = await mountEditor('<p>Hello there</p>')
    editor.commands.setTextSelection({ from: 3, to: 5 })

    stored.value = '<p>Hello there, Sam</p>'
    await nextTick()

    expect(editor.getHTML()).toBe('<p>Hello there, Sam</p>')
    expect(editor.state.selection.from).toBe(3)
    expect(editor.state.selection.to).toBe(5)
  })

  test('a held conflict shows Use theirs / Keep mine', async () => {
    const { held, wrapper } = await mountEditor()
    expect(wrapper.find('[data-testid="remote-change"]').exists()).toBe(false)

    held.value = { user: { id: '/users/sam', name: 'Sam', isSelf: false }, name: 'Sam', value: '<p>Theirs</p>', accept: vi.fn(), keep: vi.fn() }
    await nextTick()

    expect(wrapper.get('[data-testid="remote-change"]').text()).toContain('Sam changed this')
  })

  test('is outlined for the other admins in it, and reports its own focus', async () => {
    const { focused, field, wrapper } = await mountEditor()

    focused.value = [SAM]
    await nextTick()
    expect(wrapper.get('[data-testid="field-presence-flag"]').text()).toBe('Sam')

    await wrapper.trigger('focusin')
    expect(field.focusListeners.onFocusin).toHaveBeenCalled()
  })

  test('sends its cursor while it has focus, and none once it loses it', async () => {
    const { editor } = await mountEditor()

    editor.commands.setTextSelection({ from: 2, to: 4 })
    expect(selectionsSent()).toEqual([])

    editor.view.focus()
    await vi.waitFor(() => expect(selectionsSent().at(-1)).toEqual(['selection', { selection: { from: 2, to: 4 } }]))

    editor.commands.setTextSelection({ from: 3, to: 6 })
    expect(selectionsSent().at(-1)).toEqual(['selection', { selection: { from: 3, to: 6 } }])

    editor.view.dom.blur()
    await vi.waitFor(() => expect(selectionsSent().at(-1)).toEqual(['selection', { selection: null }]))
  })

  test('draws another admin\'s cursor only while they are in the field', async () => {
    const { focused } = await mountEditor()

    selection(2, 2)
    await nextTick()
    expect(carets()).toEqual([])

    focused.value = [SAM]
    await nextTick()
    expect(carets()).toEqual(['Sam'])

    focused.value = []
    await nextTick()
    expect(carets()).toEqual([])
  })

  test('removes a cursor when that window sends none, keeping the others', async () => {
    const { focused } = await mountEditor()
    focused.value = [SAM, ME]
    selection(2, 2)
    selection(4, 4, { clientId: 'tab-me', user: ME.user, name: ME.name, colour: ME.colour, isSelf: true })
    await nextTick()
    expect(carets()).toEqual(['Sam', 'You (other window)'])

    realtime.handlers.selection!(message({ selection: null }))
    await nextTick()

    expect(carets()).toEqual(['You (other window)'])
  })

  test('another admin\'s cursor stays drawn when their save is applied', async () => {
    const { focused, stored } = await mountEditor('<p>Hello</p>')
    focused.value = [SAM]
    selection(1, 5)
    await nextTick()

    stored.value = '<p>Big Hello</p>'
    await nextTick()

    expect(carets()).toEqual(['Sam'])
    expect(document.querySelector('[data-remote-selection]')!.textContent).toBe('Big ')
  })

  test('a cursor is drawn only for a window that has the field focused, never for another window of the same person', async () => {
    const { focused } = await mountEditor()
    selection(2, 2, { clientId: 'tab-sam-closed' })
    selection(4, 4, { clientId: 'tab-sam' })
    focused.value = [SAM]
    await nextTick()

    expect(carets()).toEqual(['Sam'])
    expect(document.querySelector<HTMLElement>('[data-remote-cursor]')!.dataset.remoteCursor).toBe('tab-sam')
  })

  test('a window that leaves the field loses its cursor, and coming back draws none until it sends one', async () => {
    const { focused } = await mountEditor()
    focused.value = [SAM]
    selection(2, 2)
    await nextTick()

    focused.value = []
    await nextTick()
    focused.value = [SAM]
    await nextTick()
    expect(carets()).toEqual([])

    selection(3, 3)
    await nextTick()
    expect(carets()).toEqual(['Sam'])
  })

  test('a cursor sent before its window\'s focus arrives is drawn once it does', async () => {
    const { focused } = await mountEditor()
    focused.value = [ME]
    await nextTick()
    selection(2, 2)
    await nextTick()

    focused.value = [ME, SAM]
    await nextTick()

    expect(carets()).toEqual(['Sam'])
  })

  test('pressing a menu button never takes focus from the editor, so the field stays focused for the others', async () => {
    const { wrapper } = await mountEditor()

    const menus = [BubbleMenu, FloatingMenu].map(menu => wrapper.getComponent(menu).element as HTMLElement)
    const buttons = menus.flatMap(menu => [...menu.querySelectorAll('button')])
    expect(buttons.map(button => button.textContent!.trim())).toEqual(expect.arrayContaining(['H1', 'Bold', 'Link', 'Bullet List']))
    for (const button of buttons) {
      const press = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
      button.dispatchEvent(press)
      expect(press.defaultPrevented).toBe(true)
    }
  })
})

describe('TipTapHtmlEditor: edits that merge, over Yjs (#435)', () => {
  test('opening the editor saves nothing, even when the stored HTML is not written the way TipTap writes it', async () => {
    const { stored } = await mountEditor('<p>Hello</p>\n')
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(stored.value).toBe('<p>Hello</p>\n')
  })

  test('selecting and deselecting the component swaps the editors without errors', async () => {
    const errors = vi.spyOn(console, 'error')
    const model = resourceModel('<p>Hello</p>')
    wrapper = mount(TipTapHtmlEditor, { props: { model: model.field as any, iri: '/component/html_contents/1', disabled: true }, attachTo: document.body })
    await vi.waitFor(() => expect(editorOf(wrapper!)).toBeTruthy())

    await wrapper.setProps({ disabled: false })
    await vi.waitFor(() => expect(editorOf(wrapper!)?.isEditable).toBe(true))
    await wrapper.setProps({ disabled: true })
    await vi.waitFor(() => expect(editorOf(wrapper!)?.isEditable).toBe(false))
    await new Promise(resolve => setTimeout(resolve, 20))

    expect(errors.mock.calls.filter(([message]) => String(message).includes('tiptap'))).toEqual([])
    expect(model.stored.value).toBe('<p>Hello</p>')
    errors.mockRestore()
  })

  test('two admins typing at once in one field both end with every keystroke, once, and both save it', async () => {
    const first = await mountEditor('<p>Hello world</p>')
    peersOnResource.value = [{ name: 'Sam' }]
    const second = await mountAnother('<p>Hello world</p>')

    const end = (editor: Editor) => editor.state.doc.content.size - 1
    first.editor.commands.insertContentAt(1, 'Sam: ')
    second.editor.commands.insertContentAt(end(second.editor), '!')
    first.editor.commands.insertContentAt(end(first.editor), ' and Alex')
    second.editor.commands.insertContentAt(1, 'Alex: ')

    const merged = '<p>Alex: Sam: Hello world and Alex!</p>'
    await vi.waitFor(() => {
      expect(first.editor.getHTML()).toBe(second.editor.getHTML())
      expect(first.stored.value).toBe(second.stored.value)
    })
    expect([first.editor.getHTML(), first.stored.value].map(html => html!.length)).toEqual([merged.length, merged.length])
    expect(first.editor.getText()).toMatch(/^(Alex: Sam: |Sam: Alex: )Hello world( and Alex!|! and Alex)$/)
  })

  test('a tab that opens after the field was saved again takes the open document, rather than seeding the saved HTML beside it', async () => {
    const first = await mountEditor('<p>Hello</p>')
    first.editor.commands.insertContentAt(6, ' world')
    peersOnResource.value = [{ name: 'Sam' }]

    const second = await mountAnother('<p>Hello world</p>')

    await vi.waitFor(() => expect(second.editor.getHTML()).toBe('<p>Hello world</p>'))
    expect(first.editor.getHTML()).toBe('<p>Hello world</p>')
  })

  test('a tab waits for a slow co-editor\'s document rather than seeding the saved HTML beside it', async () => {
    realtime.delayMs = 1000
    const first = await mountEditor('<p>Hello</p>')
    first.editor.commands.insertContentAt(6, ' world')
    peersOnResource.value = [{ name: 'Sam' }]

    const second = await mountAnother('<p>Hello world</p>', 6000)
    await new Promise(resolve => setTimeout(resolve, 2500))

    expect(second.editor.getHTML()).toBe('<p>Hello world</p>')
    expect(first.editor.getHTML()).toBe('<p>Hello world</p>')
  }, 12_000)

  test('a second editor for the same resource in one tab, such as a preview, shares the document and never sends a goodbye for it', async () => {
    const first = await mountEditor('<p>Hello</p>')
    const preview = await mountAnother('<p>Hello</p>', 3000, true)

    first.editor.commands.insertContentAt(6, ' world')
    expect(preview.editor.getHTML()).toBe('<p>Hello world</p>')

    others.pop()!.unmount()
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(realtime.send.mock.calls.some(([event, data]) => event === 'yjs' && (data as YSyncData).bye)).toBe(false)
  })

  test('a co-editor\'s save arriving through the model is not applied over the shared document', async () => {
    const first = await mountEditor('<p>Hello</p>')
    peersOnResource.value = [{ name: 'Sam' }]
    const second = await mountAnother('<p>Hello</p>')
    second.editor.commands.insertContentAt(6, ' world')
    await vi.waitFor(() => expect(first.editor.getHTML()).toBe('<p>Hello world</p>'))

    first.stored.value = '<p>Hello world</p>'
    second.stored.value = '<p>Hello</p>'
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(first.editor.getHTML()).toBe('<p>Hello world</p>')
    expect(second.editor.getHTML()).toBe('<p>Hello world</p>')
  })

  test('a save held as a conflict is kept for you while you edit with others, since the edits merge', async () => {
    const first = await mountEditor('<p>Hello</p>')
    peersOnResource.value = [{ name: 'Sam' }]
    await mountAnother('<p>Hello</p>')
    await vi.waitFor(() => expect(realtime.send.mock.calls.filter(([event]) => event === 'yjs').length).toBeGreaterThan(2))
    await new Promise(resolve => setTimeout(resolve, 50))
    const keep = vi.fn()

    first.held.value = { user: { id: '/users/sam', name: 'Sam', isSelf: false }, name: 'Sam', value: '<p>Theirs</p>', accept: vi.fn(), keep }
    await nextTick()

    expect(keep).toHaveBeenCalled()
  })
})
