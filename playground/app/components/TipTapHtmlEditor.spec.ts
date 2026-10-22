// @vitest-environment nuxt
import { afterEach, describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { computed, nextTick, ref } from 'vue'
import type { Editor } from '@tiptap/core'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import type { FocusedPeer } from '#cwa/composables/cwa-resource-model'
import type { RealtimeEventHandler } from '#cwa/composables/cwa-realtime'
import { BubbleMenu, FloatingMenu } from '@tiptap/vue-3/menus'
import TipTapHtmlEditor from './TipTapHtmlEditor.vue'

const realtime = vi.hoisted(() => ({
  iri: undefined as undefined | (() => string | undefined),
  send: vi.fn(),
  handlers: {} as Record<string, (message: any) => void>,
}))

mockNuxtImport('useCwaRealtime', () => (iri: () => string | undefined) => {
  realtime.iri = iri
  return {
    send: realtime.send,
    on: (event: string, handler: RealtimeEventHandler) => {
      realtime.handlers[event] = handler
      return () => {}
    },
  }
})

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
  const model = resourceModel(html)
  wrapper = mount(TipTapHtmlEditor, { props: { model: model.field as any, iri: '/component/html_contents/1' }, attachTo: document.body })
  await vi.waitFor(() => expect(editorOf(wrapper!)).toBeTruthy())
  return { ...model, wrapper, editor: editorOf(wrapper)! }
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
  realtime.handlers = {}
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
    expect(realtime.send).not.toHaveBeenCalled()

    editor.view.focus()
    await vi.waitFor(() => expect(realtime.send).toHaveBeenLastCalledWith('selection', { selection: { from: 2, to: 4 } }))

    editor.commands.setTextSelection({ from: 3, to: 6 })
    expect(realtime.send).toHaveBeenLastCalledWith('selection', { selection: { from: 3, to: 6 } })

    editor.view.dom.blur()
    await vi.waitFor(() => expect(realtime.send).toHaveBeenLastCalledWith('selection', { selection: null }))
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
