// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import * as Y from 'yjs'
import { createDocument, getHTMLFromFragment, getSchema } from '@tiptap/core'
import { StarterKit } from '@tiptap/starter-kit'
import { prosemirrorToYXmlFragment, yXmlFragmentToProseMirrorRootNode } from '@tiptap/y-tiptap'
import { acquireYSession } from './y-session'
import type { YSessionOptions } from './y-session'
import { decodeUpdate, encodeUpdate } from './y-sync'
import type { YSyncData } from './y-sync'
import { FIELD, seedUpdate } from './y-seed'
import { htmlHash } from './y-state'
import type { StoredCollaborationState } from './y-state'
import { createCoalescingChannel } from './fake-realtime-channel'

const schema = getSchema([StarterKit])
const IRI = '/component/html_contents/1'
const TAB = {}

function html(doc: Y.Doc) {
  return getHTMLFromFragment(yXmlFragmentToProseMirrorRootNode(doc.getXmlFragment(FIELD), schema).content, schema)
}

function stateClient(stored?: StoredCollaborationState) {
  return { load: vi.fn(async () => stored), save: vi.fn(async (_html: string | null | undefined) => {}) }
}

function options(send: (data: YSyncData) => boolean, overrides: Partial<YSessionOptions> = {}): YSessionOptions {
  return { send, others: () => false, html: () => '<p>Hello</p>', schema, state: () => stateClient(), ...overrides }
}

function storedFrom(source: string, edit?: (doc: Y.Doc) => void) {
  const doc = new Y.Doc()
  Y.applyUpdate(doc, seedUpdate(source, schema))
  edit?.(doc)
  return { doc, stored: { state: encodeUpdate(Y.encodeStateAsUpdate(doc)), htmlHash: htmlHash(source) } }
}

function appendParagraph(doc: Y.Doc, text: string) {
  const paragraph = new Y.XmlElement('paragraph')
  paragraph.insert(0, [new Y.XmlText(text)])
  doc.getXmlFragment(FIELD).push([paragraph])
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('one Yjs session per resource in a tab (#435)', () => {
  test('a second editor for the same resource, such as a preview, shares the first one\'s document', async () => {
    const send = vi.fn((_data: YSyncData) => true)
    const first = acquireYSession(TAB, IRI, options(send))
    const second = acquireYSession(TAB, IRI, options(send))
    await vi.advanceTimersByTimeAsync(100)

    expect(second.doc).toBe(first.doc)
    expect(second.state).toBe(first.state)
    expect(send.mock.calls.filter(([data]) => !data.bye)).toHaveLength(2)
    first.release()
    second.release()
  })

  test('an editor that goes away while another still shows the resource does not end the session', async () => {
    const send = vi.fn((_data: YSyncData) => true)
    const kept = acquireYSession(TAB, IRI, options(send))
    const transient = acquireYSession(TAB, IRI, options(send))
    await vi.advanceTimersByTimeAsync(100)

    transient.release()
    transient.release()
    await vi.advanceTimersByTimeAsync(100)

    expect(send.mock.calls.some(([data]) => data.bye)).toBe(false)
    kept.release()
    expect(send.mock.calls.at(-1)![0].bye).toBe(true)
  })

  test('once every editor has gone, the next one starts a new document', async () => {
    const send = vi.fn((_data: YSyncData) => true)
    const first = acquireYSession(TAB, IRI, options(send))
    await vi.advanceTimersByTimeAsync(100)
    first.release()

    const next = acquireYSession(TAB, IRI, options(send))

    expect(next.doc).not.toBe(first.doc)
    next.release()
  })

  test('a session released before its stored state arrived never starts sending', async () => {
    const send = vi.fn((_data: YSyncData) => true)
    let answer: (value: StoredCollaborationState | undefined) => void = () => {}
    const state = () => ({ load: vi.fn(() => new Promise<StoredCollaborationState | undefined>((resolve) => {
      answer = resolve
    })), save: vi.fn() })
    const session = acquireYSession(TAB, IRI, options(send, { state }))

    session.release()
    answer(undefined)
    await vi.advanceTimersByTimeAsync(5000)

    expect(send).not.toHaveBeenCalled()
  })
})

describe('starting from the stored Yjs state (api-components-bundle#563)', () => {
  test('a stored state made from the HTML loaded is used as it is, edits the HTML does not have yet included, without waiting for anyone', async () => {
    const { stored } = storedFrom('<p>Hello</p>', doc => appendParagraph(doc, 'Typed since the save'))
    const session = acquireYSession(TAB, IRI, options(vi.fn(() => true), { others: () => true, state: () => stateClient(stored) }))

    await expect(session.ready).resolves.toBe('loaded')
    expect(html(session.doc)).toBe('<p>Hello</p><p>Typed since the save</p>')
    session.release()
  })

  test('a stored state made from other HTML is discarded, and the HTML is seeded', async () => {
    const { stored } = storedFrom('<p>Older</p>')
    const session = acquireYSession(TAB, IRI, options(vi.fn(() => true), { state: () => stateClient(stored) }))

    await expect(session.ready).resolves.toBe('seeded')
    expect(html(session.doc)).toBe('<p>Hello</p>')
    session.release()
  })

  test('the first message already holds the stored state, so a window that has it answers with only what is new', async () => {
    const channel = createCoalescingChannel<YSyncData>()
    const { stored } = storedFrom('<p>Hello</p>', doc => appendParagraph(doc, 'Lorem ipsum dolor sit amet. '.repeat(800)))
    const sessions = ['a', 'b'].map((name) => {
      const tab = channel.tab(name)
      const session = acquireYSession({}, IRI, options(tab.send, { others: () => name === 'b', state: () => stateClient(stored) }))
      tab.on((clientId, data) => session.sync.receive(clientId, data))
      return session
    })
    await vi.advanceTimersByTimeAsync(3000)
    const posts = channel.stats.posts

    appendParagraph(sessions[0]!.doc, 'New')
    await vi.advanceTimersByTimeAsync(3000)

    expect(html(sessions[1]!.doc)).toBe(html(sessions[0]!.doc))
    expect(html(sessions[1]!.doc)).toContain('<p>New</p>')
    expect(Y.encodeStateAsUpdate(sessions[0]!.doc).length).toBeGreaterThan(16_384)
    expect(channel.stats.largestBody).toBeLessThan(2_000)
    expect(channel.stats.posts).toBeGreaterThan(posts)
    sessions.forEach(session => session.release())
  })

  test('with no stored state, a window joins the open session instead of seeding', async () => {
    const channel = createCoalescingChannel<YSyncData>()
    const tabA = channel.tab('a')
    const first = acquireYSession({}, IRI, options(tabA.send, { html: () => '<p>Hello</p>' }))
    tabA.on((clientId, data) => first.sync.receive(clientId, data))
    await first.ready
    appendParagraph(first.doc, 'Unsaved')
    await vi.advanceTimersByTimeAsync(2000)

    const tabB = channel.tab('b')
    const second = acquireYSession({}, IRI, options(tabB.send, { others: () => true, html: () => '<p>Hello</p>' }))
    tabB.on((clientId, data) => second.sync.receive(clientId, data))
    await vi.advanceTimersByTimeAsync(3000)

    await expect(second.ready).resolves.toBe('joined')
    expect(html(second.doc)).toBe('<p>Hello</p><p>Unsaved</p>')
    first.release()
    second.release()
  })

  test('the state is loaded through the client built for the session\'s document, which can encode it', async () => {
    const built: Y.Doc[] = []
    const session = acquireYSession(TAB, IRI, options(vi.fn(() => true), { state: (doc) => {
      built.push(doc)
      return stateClient()
    } }))
    await session.ready

    expect(built).toEqual([session.doc])
    expect(Y.encodeStateAsUpdate(built[0]!)).toEqual(Y.encodeStateAsUpdate(session.doc))
    session.release()
  })

  test('seeds with the parse options it is given', async () => {
    const session = acquireYSession(TAB, IRI, options(vi.fn(() => true), { html: () => '<p>Hello  there</p>', parseOptions: { preserveWhitespace: true } }))

    await session.ready

    expect(html(session.doc)).toBe('<p>Hello  there</p>')
    session.release()
  })
})

test('the stored state decodes to the document it was encoded from', () => {
  const doc = new Y.Doc()
  prosemirrorToYXmlFragment(createDocument('<p>Round trip</p>', schema), doc.getXmlFragment(FIELD))
  const copy = new Y.Doc()
  Y.applyUpdate(copy, decodeUpdate(encodeUpdate(Y.encodeStateAsUpdate(doc))))

  expect(html(copy)).toBe('<p>Round trip</p>')
})
