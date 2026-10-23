// @vitest-environment nuxt
import { afterEach, describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { computed, nextTick, reactive, ref } from 'vue'
import * as Y from 'yjs'
import type { Editor } from '@tiptap/core'
import { getSchema } from '@tiptap/core'
import { StarterKit } from '@tiptap/starter-kit'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import type { FocusedPeer } from '#cwa/composables/cwa-resource-model'
import type { RealtimeEventHandler, RealtimePeer } from '#cwa/composables/cwa-realtime'
import { BubbleMenu, FloatingMenu } from '@tiptap/vue-3/menus'
import { encodeUpdate } from '~/tiptap/y-sync'
import { FIELD, seedUpdate } from '~/tiptap/y-seed'
import { htmlHash } from '~/tiptap/y-state'
import TipTapHtmlEditor from './TipTapHtmlEditor.vue'

const LIVE = '/component/html_contents/1'
const DRAFT = '/component/html_contents/1-draft'

interface Tab {
  clientId: string
  live: boolean
  deaf?: boolean
  name: string
  colour: string
  handlers: Record<string, (message: any) => void>
}

const realtime = vi.hoisted(() => ({
  registry: undefined as undefined | { tabs: Tab[] },
  current: undefined as undefined | { tab: Tab, cwa: object },
  sent: [] as { from: string, event: string, data: any }[],
  delayMs: 5,
  generation: 0,
}))

mockNuxtImport('useCwa', () => () => realtime.current!.cwa)

mockNuxtImport('useCwaRealtime', () => (iri: () => string | undefined) => {
  const tab = realtime.current!.tab
  const registry = realtime.registry!
  return {
    iri,
    peers: computed<RealtimePeer[]>(() => registry.tabs.filter(other => other !== tab && other.live).map(other => ({
      clientId: other.clientId, user: { id: `/users/${other.name}`, name: other.name }, name: other.name, state: 'editing', expiresAt: Date.now() + 45_000, colour: other.colour, isSelf: false, idle: false,
    }))),
    send: (event: string, data: unknown) => {
      if (!tab.live) {
        return false
      }
      const published = JSON.parse(JSON.stringify(data))
      realtime.sent.push({ from: tab.clientId, event, data: published })
      const generation = realtime.generation
      setTimeout(() => generation === realtime.generation && registry.tabs.filter(other => other !== tab && other.live && !other.deaf).forEach(other => other.handlers[event]?.({ clientId: tab.clientId, user: { id: `/users/${tab.name}`, name: tab.name }, name: tab.name, colour: tab.colour, isSelf: false, event, data: published })), realtime.delayMs)
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

realtime.registry = reactive({ tabs: [] as Tab[] })

const schema = getSchema([StarterKit])

function bundle() {
  const items = new Map<string, Record<string, any>>()
  let created = 0
  const latency = { ms: 0 }
  const fetch = vi.fn(async (url: string, options: Record<string, any> = {}) => {
    latency.ms && await new Promise(resolve => setTimeout(resolve, latency.ms))
    if (!options.method) {
      const key = `${options.query.component ?? options.query.pageData}|${options.query.field}`
      return { member: items.has(key) ? [structuredClone(items.get(key))] : [] }
    }
    if (options.method === 'POST') {
      const key = `${options.body.component ?? options.body.pageData}|${options.body.field}`
      if (items.has(key)) {
        throw Object.assign(new Error('422'), { response: { status: 422 } })
      }
      items.set(key, { '@id': `/_/collaboration_states/${++created}`, ...options.body, '_metadata': { version: 1 } })
      return structuredClone(items.get(key))
    }
    const item = [...items.values()].find(stored => stored['@id'] === url)!
    if (options.headers['if-match'] !== `"${item._metadata.version}"`) {
      throw Object.assign(new Error('412'), { response: { status: 412 }, data: structuredClone(item) })
    }
    Object.assign(item, options.body, { _metadata: { version: item._metadata.version + 1 } })
    return structuredClone(item)
  })
  return {
    fetch,
    latency,
    items,
    store(iri: string, html: string, edit?: (doc: Y.Doc) => void) {
      const doc = new Y.Doc()
      Y.applyUpdate(doc, seedUpdate(html, schema, undefined, { preserveWhitespace: true }))
      edit?.(doc)
      items.set(`${iri}|html`, { '@id': `/_/collaboration_states/${++created}`, 'component': iri, 'field': 'html', 'state': encodeUpdate(Y.encodeStateAsUpdate(doc)), 'htmlHash': htmlHash(html), '_metadata': { version: 1 } })
    },
    writes: () => fetch.mock.calls.filter(([, options]) => options?.method),
  }
}

let api = bundle()
const mounted: VueWrapper[] = []

function resourceModel(html: string | null) {
  const stored = ref<string | null>(html)
  const held = ref()
  const focused = ref<FocusedPeer[]>([])
  const submitting = ref(false)
  const lastWrite = ref<string>()
  const writes: (string | null | undefined)[] = []
  return {
    stored,
    lastWrite,
    held,
    focused,
    submitting,
    writes,
    field: {
      model: computed<string | null | undefined>({ get: () => stored.value, set: (value) => {
        writes.push(value)
        stored.value = value ?? null
      } }),
      remoteChange: computed(() => held.value),
      focusedBy: computed(() => focused.value),
      focusListeners: { onFocusin: vi.fn(), onFocusout: vi.fn(), onPointerdown: vi.fn() },
      states: { submitting },
    },
  }
}

function tab(name: string, colour = '#c084fc') {
  const created: Tab = { clientId: `tab-${name}`, live: true, name, colour, handlers: {} }
  realtime.registry!.tabs.push(created)
  return realtime.registry!.tabs.at(-1)!
}

function cwaFor(model: ReturnType<typeof resourceModel>, drafts: Record<string, string> = {}) {
  return {
    cwaFetch: { fetch: api.fetch },
    resources: {
      getResource: (iri: string) => computed(() => ({ data: { '@id': iri, 'html': model.stored.value, '_metadata': { lastWrite: model.lastWrite.value ? { clientId: model.lastWrite.value } : undefined } } })),
      findPublishedComponentIri: (iri: string) => computed(() => drafts[iri]),
    },
  }
}

async function mountEditor(html: string | null = '<p>Hello there</p>', options: { name?: string, iri?: string, disabled?: boolean, sameTabAs?: { tab: Tab, cwa: object }, drafts?: Record<string, string>, editable?: boolean } = {}) {
  const model = resourceModel(html)
  const on = options.sameTabAs?.tab ?? tab(options.name ?? 'me')
  const cwa = options.sameTabAs?.cwa ?? cwaFor(model, options.drafts)
  realtime.current = { tab: on, cwa }
  const wrapper = mount(TipTapHtmlEditor, { props: { model: model.field as any, iri: options.iri ?? LIVE, field: 'html', disabled: options.disabled }, attachTo: document.body })
  mounted.push(wrapper)
  await vi.waitFor(() => expect([editorOf(wrapper)?.isEditable, editorOf(wrapper)?.isInitialized]).toEqual([options.editable ?? !options.disabled, true]), { timeout: 4000 })
  return { ...model, wrapper, tab: on, cwa, editor: () => editorOf(wrapper)! }
}

async function pair(html: string, options: Parameters<typeof mountEditor>[1] = {}) {
  const first = await mountEditor(html, { ...options, name: 'first' })
  const second = await mountEditor(html, { ...options, name: 'second' })
  await vi.waitFor(() => expect([yjsSent('tab-first').length, yjsSent('tab-second').length].every(count => count > 0)).toBe(true))
  await wait(50)
  const id = (from: string) => yjsSent(from).at(-1)!.data.id as number
  return id('tab-first') < id('tab-second') ? [first, second] as const : [second, first] as const
}

function editorOf(on: VueWrapper): Editor | undefined {
  return (on.vm as unknown as { editor?: Editor }).editor
}

function docOf(editor: Editor) {
  return editor.extensionManager.extensions.find(extension => extension.name === 'collaboration')!.options.document as Y.Doc
}

function carets() {
  return [...document.querySelectorAll<HTMLElement>('[data-remote-cursor]')].map(caret => caret.textContent)
}

function yjsSent(from?: string) {
  return realtime.sent.filter(sent => sent.event === 'yjs:html' && (!from || sent.from === from))
}

function end(editor: Editor) {
  return editor.state.doc.content.size - 1
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

afterEach(() => {
  mounted.splice(0).forEach(wrapper => wrapper.unmount())
  realtime.registry!.tabs.splice(0).forEach((gone) => {
    gone.live = false
  })
  realtime.sent = []
  realtime.delayMs = 5
  realtime.generation++
  api = bundle()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('TipTapHtmlEditor: the co-editing reference editor (#429)', () => {
  test('saves what is typed through the resource model', async () => {
    const { editor, stored } = await mountEditor('<p>Hello</p>')

    editor().commands.insertContentAt(6, ' world')

    expect(stored.value).toBe('<p>Hello world</p>')
  })

  test('another admin\'s saved HTML is applied in place while nobody else edits with you, keeping the cursor', async () => {
    const { editor, stored } = await mountEditor('<p>Hello there</p>')
    editor().commands.setTextSelection({ from: 3, to: 5 })

    stored.value = '<p>Hello there, Sam</p>'
    await nextTick()

    expect(editor().getHTML()).toBe('<p>Hello there, Sam</p>')
    expect(editor().state.selection.from).toBe(3)
    expect(editor().state.selection.to).toBe(5)
  })

  test('spaces typed in a row survive loading the stored HTML and another admin\'s save, as the editor shows them with pre-wrap', async () => {
    const { editor, stored } = await mountEditor('<p>Hello  there</p>')
    expect(editor().getHTML()).toBe('<p>Hello  there</p>')

    stored.value = '<p>Hello  there,   Sam</p>'
    await nextTick()

    expect(editor().getHTML()).toBe('<p>Hello  there,   Sam</p>')
  })

  test('stored HTML with line breaks between its blocks loads without empty paragraphs between them', async () => {
    const { editor } = await mountEditor('<p>One</p>\n    <p>Two</p>')
    expect(editor().getHTML()).toBe('<p>One</p><p>Two</p>')
  })

  test('a held conflict shows Use theirs / Keep mine', async () => {
    const { held, wrapper } = await mountEditor()
    expect(wrapper.find('[data-testid="remote-change"]').exists()).toBe(false)

    const keep = vi.fn()
    held.value = { user: { id: '/users/sam', name: 'Sam', isSelf: false }, name: 'Sam', value: '<p>Theirs</p>', accept: vi.fn(), keep }
    await nextTick()

    expect(wrapper.get('[data-testid="remote-change"]').text()).toContain('Sam changed this')
    expect(keep).not.toHaveBeenCalled()
  })

  test('is outlined for the other admins in it, and reports its own focus', async () => {
    const { focused, field, wrapper } = await mountEditor()

    focused.value = [{ user: { id: '/users/sam', name: 'Sam' }, name: 'Sam', colour: '#c084fc', isSelf: false, clientIds: ['tab-sam'] }]
    await nextTick()
    expect(wrapper.get('[data-testid="field-presence-flag"]').text()).toBe('Sam')

    await wrapper.trigger('focusin')
    expect(field.focusListeners.onFocusin).toHaveBeenCalled()
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
    const { writes } = await mountEditor('<p>Hello</p>\n')
    await wait(50)

    expect(writes).toEqual([])
  })

  test('selecting and deselecting the component swaps the editors without errors or saves', async () => {
    const errors = vi.spyOn(console, 'error')
    const { wrapper, writes, editor } = await mountEditor('<p>Hello</p>', { disabled: true })

    await wrapper.setProps({ disabled: false })
    await vi.waitFor(() => expect(editor().isEditable).toBe(true))
    await wrapper.setProps({ disabled: true })
    await vi.waitFor(() => expect(editor().isEditable).toBe(false))
    await wait(20)

    expect(errors.mock.calls.filter(([message]) => String(message).includes('tiptap'))).toEqual([])
    expect(writes).toEqual([])
  })

  test('deselecting before the shared document is ready keeps the read-only editor, which is never bound to it', async () => {
    const { wrapper, editor } = await mountEditor('<p>Hello</p>', { disabled: true })
    api.latency.ms = 50

    await wrapper.setProps({ disabled: false })
    await wrapper.setProps({ disabled: true })
    await wait(150)

    expect(editor().extensionManager.extensions.map((extension: { name: string }) => extension.name)).not.toContain('collaboration')
    expect(api.writes()).toEqual([])
  })

  test('two admins typing at once both end with every keystroke, once, and the saver saves the merge', async () => {
    const [saver, other] = await pair('<p>Hello world</p>')

    saver.editor().commands.insertContentAt(1, 'Sam: ')
    other.editor().commands.insertContentAt(end(other.editor()), '!')
    saver.editor().commands.insertContentAt(end(saver.editor()), ' and Alex')
    other.editor().commands.insertContentAt(1, 'Alex: ')

    await vi.waitFor(() => {
      expect(saver.editor().getHTML()).toBe(other.editor().getHTML())
      expect(saver.editor().getText()).toMatch(/^(Alex: Sam: |Sam: Alex: )Hello world( and Alex!|! and Alex)$/)
      expect(saver.stored.value).toBe(saver.editor().getHTML())
    }, { timeout: 5000 })
  })

  test('every window saves its own typing at once, so Publish in the window that typed waits for it', async () => {
    const [, other] = await pair('<p>Hello</p>')

    other.editor().commands.insertContentAt(6, ' world')

    expect(other.writes).toEqual(['<p>Hello world</p>'])
  })

  test('a window that only received others\' typing does not save it unless it saves for everyone', async () => {
    const [saver, other] = await pair('<p>Hello</p>')

    saver.editor().commands.insertContentAt(1, 'Oh, ')
    await vi.waitFor(() => expect(other.editor().getHTML()).toBe('<p>Oh, Hello</p>'))
    await wait(1800)

    expect(other.writes).toEqual([])
  })

  test('the saver saves what another window typed long after they both started', async () => {
    const [saver, other] = await pair('<p>Hello</p>')
    await wait(1800)

    other.editor().commands.insertContentAt(6, ' world')

    await vi.waitFor(() => expect(saver.stored.value).toBe('<p>Hello world</p>'), { timeout: 4000 })
  }, 10_000)

  test('the next lowest window takes over saving what others typed when the saver leaves', async () => {
    const [saver, other] = await pair('<p>Hello</p>')
    await wait(1800)
    saver.editor().commands.insertContentAt(1, 'Oh, ')
    await vi.waitFor(() => expect(other.editor().getHTML()).toBe('<p>Oh, Hello</p>'))
    await wait(1800)
    expect(other.writes).toEqual([])

    saver.tab.live = false

    await vi.waitFor(() => expect(other.stored.value).toBe('<p>Oh, Hello</p>'), { timeout: 4000 })
  }, 15_000)

  test('a window that has gone without a goodbye is forgotten once its presence goes, so updates stop being resent to it', async () => {
    const [gone, staying] = await pair('<p>Hello</p>')
    gone.tab.deaf = true
    staying.editor().commands.insertContentAt(6, ' world')
    await wait(2200)
    const resending = yjsSent(staying.tab.clientId).length
    await wait(1100)
    expect(yjsSent(staying.tab.clientId).length).toBeGreaterThan(resending)

    gone.tab.live = false
    await wait(100)
    const settled = yjsSent(staying.tab.clientId).length
    await wait(1500)

    expect(yjsSent(staying.tab.clientId).length).toBe(settled)
  }, 10_000)

  test('a co-editor\'s save arriving through the model is not applied over the shared document', async () => {
    const [saver, other] = await pair('<p>Hello</p>')
    other.editor().commands.insertContentAt(6, ' world')
    await vi.waitFor(() => expect(saver.editor().getHTML()).toBe('<p>Hello world</p>'))

    saver.lastWrite.value = other.tab.clientId
    saver.stored.value = '<p>An older save</p>'
    other.lastWrite.value = saver.tab.clientId
    other.stored.value = '<p>Another older save</p>'
    await wait(50)

    expect(saver.editor().getHTML()).toBe('<p>Hello world</p>')
    expect(other.editor().getHTML()).toBe('<p>Hello world</p>')
  })

  test('a save held as a conflict is kept for you while you edit with others, sending what the editor shows now', async () => {
    const [saver, other] = await pair('<p>Hello</p>')
    saver.editor().commands.insertContentAt(1, 'Oh, ')
    await vi.waitFor(() => expect(other.editor().getHTML()).toBe('<p>Oh, Hello</p>'))
    const sentWhenKept: (string | null | undefined)[] = []
    const keep = vi.fn(async () => {
      sentWhenKept.push(other.field.model.value)
    })
    const accept = vi.fn()

    other.held.value = { user: { id: '/users/sam', name: 'Sam', isSelf: false }, name: 'Sam', value: '<p>Theirs</p>', accept, keep }
    await nextTick()

    expect(keep).toHaveBeenCalled()
    expect(accept).not.toHaveBeenCalled()
    expect(sentWhenKept).toEqual(['<p>Oh, Hello</p>'])
  })

  test('a conflict with what the editor already shows is taken, sending nothing', async () => {
    const [, other] = await pair('<p>Hello</p>')
    const keep = vi.fn()
    const accept = vi.fn()

    other.held.value = { user: { id: '/users/sam', name: 'Sam', isSelf: false }, name: 'Sam', value: '<p>Hello</p>\n', accept, keep }
    await nextTick()

    expect(accept).toHaveBeenCalled()
    expect(keep).not.toHaveBeenCalled()
    expect(other.writes).toEqual([])
  })

  test('a save from outside the shared editing, such as the API, is applied by the saver alone and reaches the others through Yjs, writing no HTML', async () => {
    const [saver, other] = await pair('<p>Hello</p>')

    saver.lastWrite.value = undefined
    saver.stored.value = '<p>Hello from outside</p>'
    other.lastWrite.value = undefined
    other.stored.value = '<p>Hello from outside</p>'

    await vi.waitFor(() => expect([saver.editor().getHTML(), other.editor().getHTML()]).toEqual(['<p>Hello from outside</p>', '<p>Hello from outside</p>']))
    await wait(1800)
    expect(saver.editor().getText()).toBe('Hello from outside')
    expect([saver.writes, other.writes]).toEqual([[], []])
  })

  test('typing only another window has saved survives both windows moving to the draft that save made', async () => {
    const [saver, other] = await pair('<p>Hello</p>', { drafts: { [DRAFT]: LIVE } })
    await wait(1800)
    other.editor().commands.insertContentAt(1, 'Oh, ')
    await vi.waitFor(() => expect(saver.editor().getHTML()).toBe('<p>Oh, Hello</p>'))

    await Promise.all([saver, other].map(window => window.wrapper.setProps({ disabled: true })))
    await wait(100)
    await Promise.all([saver, other].map(window => window.wrapper.setProps({ iri: DRAFT, disabled: false })))
    await vi.waitFor(() => expect([saver.editor().isEditable, other.editor().isEditable]).toEqual([true, true]), { timeout: 4000 })
    await wait(2000)

    expect([saver.editor().getHTML(), other.editor().getHTML()]).toEqual(['<p>Oh, Hello</p>', '<p>Oh, Hello</p>'])
  }, 15_000)

  test('moving from a draft published elsewhere to its live component, whose stored copy is older, neither applies nor saves that copy', async () => {
    const [saver] = await pair('<p>Hello draft</p>', { iri: DRAFT, drafts: { [DRAFT]: LIVE } })
    await wait(1800)

    saver.stored.value = '<p>Hello</p>'
    await saver.wrapper.setProps({ iri: LIVE })
    await wait(1800)

    expect([saver.editor().getHTML(), saver.writes]).toEqual(['<p>Hello draft</p>', []])
  }, 10_000)

  test('an older save of this window\'s own arriving late is never applied over what it shows', async () => {
    const [saver] = await pair('<p>Hello</p>')
    saver.editor().commands.insertContentAt(6, ' A')
    saver.editor().commands.insertContentAt(8, 'B')
    expect(saver.writes).toEqual(['<p>Hello A</p>', '<p>Hello AB</p>'])

    saver.stored.value = '<p>Hello A</p>'
    await wait(50)

    expect(saver.editor().getHTML()).toBe('<p>Hello AB</p>')
  })

  test('a second editor for the same resource in one tab, such as a preview, shares the document and never sends a goodbye for it', async () => {
    const first = await mountEditor('<p>Hello</p>')
    const preview = await mountEditor('<p>Hello</p>', { sameTabAs: first })

    first.editor().commands.insertContentAt(6, ' world')
    expect(preview.editor().getHTML()).toBe('<p>Hello world</p>')

    mounted.pop()!.unmount()
    await wait(20)
    expect(yjsSent().some(sent => sent.data.bye)).toBe(false)
  })

  test('an editor on the draft and one on its live component in one tab share one document', async () => {
    const live = await mountEditor('<p>Hello</p>', { drafts: { [DRAFT]: LIVE } })
    const draft = await mountEditor('<p>Hello</p>', { sameTabAs: live, iri: DRAFT })

    live.editor().commands.insertContentAt(6, ' world')

    expect(draft.editor().getHTML()).toBe('<p>Hello world</p>')
  })

  test('sends the Yjs updates as an event named after the field', async () => {
    const { editor } = await mountEditor('<p>Hello</p>')

    editor().commands.insertContentAt(6, '!')

    await vi.waitFor(() => expect(yjsSent('tab-me').length).toBeGreaterThan(0))
    expect(realtime.sent.map(sent => sent.event)).toEqual(realtime.sent.map(() => 'yjs:html'))
  })

  test('undo takes back only this admin\'s typing, never another admin\'s', async () => {
    const first = await mountEditor('<p>Hello</p>', { name: 'first' })
    const second = await mountEditor('<p>Hello</p>', { name: 'second' })
    first.editor().commands.insertContentAt(6, ' mine')
    await vi.waitFor(() => expect(second.editor().getHTML()).toBe('<p>Hello mine</p>'))
    second.editor().commands.insertContentAt(1, 'Theirs: ')
    await vi.waitFor(() => expect(first.editor().getHTML()).toBe('<p>Theirs: Hello mine</p>'))

    first.editor().commands.undo()

    expect(first.editor().getHTML()).toBe('<p>Theirs: Hello</p>')
    await vi.waitFor(() => expect(second.editor().getHTML()).toBe('<p>Theirs: Hello</p>'))
  })
})

describe('TipTapHtmlEditor: the stored Yjs state (api-components-bundle#563)', () => {
  test('starts from a stored state made from the HTML it loaded, including typing that was not saved yet', async () => {
    api.store(LIVE, '<p>Hello</p>', (doc) => {
      const paragraph = new Y.XmlElement('paragraph')
      paragraph.insert(0, [new Y.XmlText('Unsaved')])
      doc.getXmlFragment(FIELD).push([paragraph])
    })

    const { editor, stored } = await mountEditor('<p>Hello</p>')

    expect(api.fetch).toHaveBeenCalledWith('/_/collaboration_states', { query: { component: LIVE, field: 'html' } })
    expect(editor().getHTML()).toBe('<p>Hello</p><p>Unsaved</p>')
    await vi.waitFor(() => expect(stored.value).toBe('<p>Hello</p><p>Unsaved</p>'))
    await wait(20)
    expect(api.writes()).toEqual([])
  })

  test('editing a draft, asks for and stores the state under its published component, where the API keeps it', async () => {
    const { editor, submitting, stored } = await mountEditor('<p>Hello</p>', { iri: DRAFT, drafts: { [DRAFT]: LIVE } })

    expect(api.fetch).toHaveBeenCalledWith('/_/collaboration_states', { query: { component: LIVE, field: 'html' } })
    editor().commands.insertContentAt(6, ' world')
    submitting.value = true
    await nextTick()
    stored.value = '<p>Hello world</p>'
    submitting.value = false
    await vi.waitFor(() => expect(api.items.has(`${LIVE}|html`)).toBe(true))
  })

  test('a stored state older than the HTML stays the start, and is brought up to the HTML as an edit, writing no HTML and storing the state again', async () => {
    api.store(LIVE, '<p>Older</p>')
    const older = api.items.get(`${LIVE}|html`)!.state

    const { editor, writes } = await mountEditor('<p>Hello</p>')

    expect(editor().getHTML()).toBe('<p>Hello</p>')
    const olderClients = [...Y.decodeStateVector(Y.encodeStateVectorFromUpdate(Uint8Array.from(atob(older), char => char.charCodeAt(0)))).keys()]
    expect([...Y.decodeStateVector(Y.encodeStateVector(docOf(editor()))).keys()]).toEqual(expect.arrayContaining(olderClients))
    await vi.waitFor(() => expect(api.items.get(`${LIVE}|html`)).toMatchObject({ htmlHash: htmlHash('<p>Hello</p>'), _metadata: { version: 2 } }), { timeout: 4000 })
    expect(writes).toEqual([])
  })

  test('selecting a field with no stored state creates it from the seed at once, and the next window starts from it', async () => {
    const first = await mountEditor('<p>Hello</p>', { name: 'first' })
    const alone = Y.encodeStateAsUpdate(docOf(first.editor()))
    first.wrapper.unmount()
    const second = await mountEditor('<p>Hello</p>', { name: 'second' })
    await wait(20)

    expect(api.writes().map(([, options]) => options?.method)).toEqual(['POST'])
    expect(Y.encodeStateAsUpdate(docOf(second.editor()))).toEqual(alone)
  })

  test('once the saver\'s HTML save is done, it stores the state with the hash of the HTML now stored', async () => {
    const { editor, submitting, stored } = await mountEditor('<p>Hello</p>')

    editor().commands.insertContentAt(6, ' world')
    submitting.value = true
    await nextTick()
    stored.value = '<p>Hello world</p>'
    submitting.value = false

    await vi.waitFor(() => expect(api.items.get(`${LIVE}|html`)).toMatchObject({ htmlHash: htmlHash('<p>Hello world</p>'), _metadata: { version: 2 } }), { timeout: 4000 })
  })

  test('a window that does not save never writes the state', async () => {
    const [, other] = await pair('<p>Hello</p>')
    const writesBefore = api.writes().length

    other.editor().commands.insertContentAt(6, ' world')
    other.submitting.value = true
    await nextTick()
    other.submitting.value = false
    await wait(50)

    expect(api.writes().slice(writesBefore).filter(([, options]) => options?.method === 'PATCH' && options.body.htmlHash === htmlHash(other.stored.value))).toEqual([])
  })
})

describe('TipTapHtmlEditor: the caret when the editor is rebuilt (#435)', () => {
  test('selecting the component keeps the caret where it was clicked, and focuses the editor', async () => {
    const { wrapper, editor } = await mountEditor('<p>Hello there</p>', { disabled: true })
    const text = editor().view.dom.querySelector('p')!.firstChild!
    document.getSelection()!.collapse(text, 5)

    await wrapper.setProps({ disabled: false })
    await vi.waitFor(() => expect(editor().isEditable).toBe(true))

    await vi.waitFor(() => expect(editor().state.selection.from).toBe(6))
    expect(editor().isFocused).toBe(true)
  })

  test.each([[true, false], [false, true]])('swapping the editors never puts both in the page at once, where the browser\'s scroll anchoring could move a tall field to the top of the page (disabled %s → %s)', async (from, to) => {
    const { wrapper, editor } = await mountEditor('<p>Hello there</p>', { disabled: from })
    const counts: number[] = []
    const observer = new MutationObserver(() => counts.push(document.querySelectorAll('.ProseMirror').length))
    observer.observe(document.body, { childList: true, subtree: true })

    await wrapper.setProps({ disabled: to })
    await vi.waitFor(() => expect(editor().isEditable).toBe(!to))
    await wait(20)
    observer.disconnect()

    expect(counts.length).toBeGreaterThan(0)
    expect(Math.max(...counts)).toBe(1)
  })

  test('a menu opened after selecting keeps focus when the editor becomes editable, so it stays open', async () => {
    const { wrapper, editor } = await mountEditor('<p>Hello there</p>', { disabled: true })
    document.getSelection()!.collapse(editor().view.dom.querySelector('p')!.firstChild!, 5)
    const menu = document.body.appendChild(document.createElement('button'))

    await wrapper.setProps({ disabled: false })
    menu.focus()
    await vi.waitFor(() => expect(editor().isEditable).toBe(true))
    await wait(20)

    expect(document.activeElement).toBe(menu)
    expect(editor().isFocused).toBe(false)
  })
})

describe('TipTapHtmlEditor: cursors (#435)', () => {
  test('sends its cursor inside the Yjs event while it has focus, and none once it loses it, with no selection events', async () => {
    const { editor } = await mountEditor()

    editor().view.focus()
    editor().commands.setTextSelection({ from: 2, to: 4 })
    await vi.waitFor(() => expect(yjsSent('tab-me').at(-1)?.data.cursor).toMatchObject({ anchor: expect.anything(), head: expect.anything() }))

    editor().view.dom.blur()
    editor().view.dom.dispatchEvent(new FocusEvent('focusout'))
    await vi.waitFor(() => expect(yjsSent('tab-me').at(-1)?.data.cursor).toBeNull())
    expect(realtime.sent.filter(sent => sent.event === 'selection')).toEqual([])
  })

  test('draws another admin\'s cursor only while that window is in the field', async () => {
    const mine = await mountEditor('<p>Hello there</p>', { name: 'me' })
    const theirs = await mountEditor('<p>Hello there</p>', { name: 'sam', editable: true })
    theirs.editor().view.focus()
    theirs.editor().commands.setTextSelection({ from: 2, to: 6 })
    await vi.waitFor(() => expect(yjsSent('tab-sam').at(-1)?.data.cursor).toBeTruthy())
    await wait(30)
    expect(carets()).toEqual([])

    mine.focused.value = [{ user: { id: '/users/sam', name: 'sam' }, name: 'sam', colour: '#c084fc', isSelf: false, clientIds: ['tab-sam'] }]
    await vi.waitFor(() => expect(carets()).toEqual(['sam']))
    expect(mine.editor().view.dom.querySelector('[data-remote-selection]')!.textContent).toBe('ello')

    mine.focused.value = []
    await vi.waitFor(() => expect(carets()).toEqual([]))
  })

  test('a cursor is drawn only for a window that has the field focused, never for another window of the same person', async () => {
    const mine = await mountEditor('<p>Hello there</p>', { name: 'me' })
    const theirs = await mountEditor('<p>Hello there</p>', { name: 'sam' })
    theirs.editor().view.focus()
    theirs.editor().commands.setTextSelection(3)
    await vi.waitFor(() => expect(yjsSent('tab-sam').at(-1)?.data.cursor).toBeTruthy())

    mine.focused.value = [{ user: { id: '/users/sam', name: 'sam' }, name: 'sam', colour: '#c084fc', isSelf: false, clientIds: ['tab-sam-other-window'] }]
    await wait(50)

    expect(carets()).toEqual([])
  })

  test('removes a cursor when that window leaves the editor', async () => {
    const mine = await mountEditor('<p>Hello there</p>', { name: 'me' })
    const theirs = await mountEditor('<p>Hello there</p>', { name: 'sam' })
    mine.focused.value = [{ user: { id: '/users/sam', name: 'sam' }, name: 'sam', colour: '#c084fc', isSelf: false, clientIds: ['tab-sam'] }]
    theirs.editor().view.focus()
    theirs.editor().commands.setTextSelection(3)
    await vi.waitFor(() => expect(carets()).toEqual(['sam']))

    theirs.editor().view.dom.blur()
    theirs.editor().view.dom.dispatchEvent(new FocusEvent('focusout'))

    await vi.waitFor(() => expect(carets()).toEqual([]))
  })
})
