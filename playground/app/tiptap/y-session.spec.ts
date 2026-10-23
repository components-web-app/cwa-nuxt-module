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

function stateClient(stored?: StoredCollaborationState, created: 'created' | 'exists' | 'failed' = 'created') {
  return {
    load: vi.fn(async () => stored),
    create: vi.fn(async (_update: Uint8Array, _html: string | null | undefined) => created),
    save: vi.fn(async (_html: string | null | undefined) => true),
  }
}

function clients(doc: Y.Doc) {
  return [...Y.decodeStateVector(Y.encodeStateVector(doc)).keys()]
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

afterEach(async () => {
  await vi.advanceTimersByTimeAsync(5000)
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
    expect(send.mock.calls.filter(([data]) => !data.bye)).toHaveLength(1)
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
    await vi.advanceTimersByTimeAsync(5000)
    expect(send.mock.calls.at(-1)![0].bye).toBe(true)
  })

  test('an editor given the session back moments after releasing it, as when a save or publish moves it between the live component and its draft, keeps the document and its unsaved typing', async () => {
    const send = vi.fn((_data: YSyncData) => true)
    const first = acquireYSession(TAB, IRI, options(send))
    await vi.advanceTimersByTimeAsync(100)
    appendParagraph(first.doc, 'Unsaved')
    first.release()
    await vi.advanceTimersByTimeAsync(500)

    const next = acquireYSession(TAB, IRI, options(send))
    await vi.advanceTimersByTimeAsync(5000)

    expect(next.doc).toBe(first.doc)
    expect(html(next.doc)).toBe('<p>Hello</p><p>Unsaved</p>')
    expect(send.mock.calls.some(([data]) => data.bye)).toBe(false)
    next.release()
    await vi.advanceTimersByTimeAsync(5000)
  })

  test('how the session started is handed to one editor only, so an editor given a running session never applies it again', async () => {
    const { stored } = storedFrom('<p>Older</p>')
    const first = acquireYSession(TAB, IRI, options(vi.fn(() => true), { state: () => stateClient(stored) }))
    await vi.advanceTimersByTimeAsync(2000)
    await first.ready
    const second = acquireYSession(TAB, IRI, options(vi.fn(() => true)))
    await second.ready

    expect([first.claim(), second.claim(), first.claim()]).toEqual(['stale', 'joined', 'joined'])
    first.release()
    second.release()
    await vi.advanceTimersByTimeAsync(5000)
  })

  test('once every editor has been gone a while, the next one starts a new document', async () => {
    const send = vi.fn((_data: YSyncData) => true)
    const first = acquireYSession(TAB, IRI, options(send))
    await vi.advanceTimersByTimeAsync(100)
    first.release()
    await vi.advanceTimersByTimeAsync(5000)

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
  test('a stored state made from the HTML loaded, holding typing the HTML does not have yet, is reported ahead once nobody answers', async () => {
    const { stored } = storedFrom('<p>Hello</p>', doc => appendParagraph(doc, 'Typed since the save'))
    const session = acquireYSession(TAB, IRI, options(vi.fn(() => true), { others: () => true, state: () => stateClient(stored) }))
    await vi.advanceTimersByTimeAsync(2000)

    await expect(session.ready).resolves.toBe('ahead')
    expect(html(session.doc)).toBe('<p>Hello</p><p>Typed since the save</p>')
    session.release()
  })

  test('a stored state made from other HTML is still the start, never seeded over, and is reported stale', async () => {
    const { doc: older, stored } = storedFrom('<p>Older</p>')
    const session = acquireYSession(TAB, IRI, options(vi.fn(() => true), { state: () => stateClient(stored) }))
    await vi.advanceTimersByTimeAsync(2000)

    await expect(session.ready).resolves.toBe('stale')
    expect(html(session.doc)).toBe('<p>Older</p>')
    expect(clients(session.doc)).toEqual(clients(older))
    session.release()
  })

  test('a stored state that matches the HTML is reported current', async () => {
    const { stored } = storedFrom('<p>Hello</p>')
    const session = acquireYSession(TAB, IRI, options(vi.fn(() => true), { state: () => stateClient(stored) }))

    await expect(session.ready).resolves.toBe('current')
    session.release()
  })

  test('with no stored state, seeds the HTML before sending anything and creates the state from that seed at once', async () => {
    const send = vi.fn((_data: YSyncData) => true)
    const state = stateClient()
    const session = acquireYSession(TAB, IRI, options(send, { state: () => state }))

    await expect(session.ready).resolves.toBe('current')
    expect(state.create).toHaveBeenCalledWith(seedUpdate('<p>Hello</p>', schema), '<p>Hello</p>')
    const first = new Y.Doc()
    Y.applyUpdate(first, decodeUpdate(send.mock.calls[0]![0].update))
    expect(first.getXmlFragment(FIELD).length).toBe(0)
    session.release()
  })

  test('when another window created the state first, starts from that state and throws its own seed away', async () => {
    const { doc: theirs, stored } = storedFrom('<p>Saved by them</p>')
    const state = stateClient(undefined, 'exists')
    state.load.mockResolvedValueOnce(undefined).mockResolvedValueOnce(stored)
    const session = acquireYSession(TAB, IRI, options(vi.fn(() => true), { state: () => state }))
    await vi.advanceTimersByTimeAsync(2000)

    await expect(session.ready).resolves.toBe('stale')
    expect(html(session.doc)).toBe('<p>Saved by them</p>')
    expect(clients(session.doc)).toEqual(clients(theirs))
    session.release()
  })

  test('when the state cannot be created, the seed is used', async () => {
    const session = acquireYSession(TAB, IRI, options(vi.fn(() => true), { state: () => stateClient(undefined, 'failed') }))

    await expect(session.ready).resolves.toBe('current')
    expect(html(session.doc)).toBe('<p>Hello</p>')
    session.release()
  })

  test('two windows opening together with no stored state seed the same document and do not double it', async () => {
    const channel = createCoalescingChannel<YSyncData>()
    const sessions = ['a', 'b'].map((name) => {
      const tab = channel.tab(name)
      const session = acquireYSession({}, IRI, options(tab.send, { others: () => true }))
      tab.on((clientId, data) => session.sync.receive(clientId, data))
      return session
    })
    await vi.advanceTimersByTimeAsync(5000)

    expect(sessions.map(session => html(session.doc))).toEqual(['<p>Hello</p>', '<p>Hello</p>'])
    sessions.forEach(session => session.release())
  })

  test.each([['known', true], ['not yet known', false]])('two windows starting together from a stored state older than the HTML, with their presence %s, are not joined by each other: the lowest applies the HTML and the other waits for it', async (_known, known) => {
    const channel = createCoalescingChannel<YSyncData>()
    const { stored } = storedFrom('<p>Hello</p>')
    const sessions = ['a', 'b'].map((name) => {
      const tab = channel.tab(name)
      const session = acquireYSession({}, IRI, options(tab.send, { others: () => known, html: () => '<p>Hello</p><p>Typed</p>', state: () => stateClient(stored) }))
      tab.on((clientId, data) => session.sync.receive(clientId, data))
      return session
    })
    await vi.advanceTimersByTimeAsync(3000)

    const starts = await Promise.all(sessions.map(session => session.ready))
    const lowest = sessions[0]!.doc.clientID < sessions[1]!.doc.clientID ? 0 : 1
    expect(starts[lowest]).toBe('stale')
    expect(starts[1 - lowest]).toBe('joined')
    sessions.forEach(session => session.release())
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
    expect(html(first.doc)).toBe('<p>Hello</p><p>Unsaved</p>')
    first.release()
    second.release()
  })

  test('a stored state older than the HTML waits for a window that already has the newer HTML, even before its presence arrives, so the change is never applied twice', async () => {
    const channel = createCoalescingChannel<YSyncData>()
    const { stored } = storedFrom('<p>Hello</p>')
    const tabA = channel.tab('a')
    const first = acquireYSession({}, IRI, options(tabA.send, { html: () => '<p>Hello</p>', state: () => stateClient(stored) }))
    tabA.on((clientId, data) => first.sync.receive(clientId, data))
    await vi.advanceTimersByTimeAsync(2000)
    appendParagraph(first.doc, 'Outside')
    await vi.advanceTimersByTimeAsync(2000)

    const tabB = channel.tab('b')
    const second = acquireYSession({}, IRI, options(tabB.send, { html: () => '<p>Hello</p><p>Outside</p>', state: () => stateClient(stored) }))
    tabB.on((clientId, data) => second.sync.receive(clientId, data))
    await vi.advanceTimersByTimeAsync(3000)

    await expect(second.ready).resolves.toBe('joined')
    expect([html(first.doc), html(second.doc)]).toEqual(['<p>Hello</p><p>Outside</p>', '<p>Hello</p><p>Outside</p>'])
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
