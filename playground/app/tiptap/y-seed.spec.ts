// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import * as Y from 'yjs'
import { createDocument, getHTMLFromFragment, getSchema } from '@tiptap/core'
import { StarterKit } from '@tiptap/starter-kit'
import { prosemirrorToYXmlFragment, yXmlFragmentToProseMirrorRootNode } from '@tiptap/y-tiptap'
import { createYSync, encodeUpdate } from './y-sync'
import type { YSyncData } from './y-sync'
import { FIELD, joinOrSeed, seedClientId, seedUpdate } from './y-seed'
import { createCoalescingChannel } from './fake-realtime-channel'

const extensions = [StarterKit]
const schema = getSchema(extensions)

function html(doc: Y.Doc) {
  return getHTMLFromFragment(yXmlFragmentToProseMirrorRootNode(doc.getXmlFragment(FIELD), schema).content, schema)
}

function exchange(one: Y.Doc, other: Y.Doc) {
  const toOther = Y.encodeStateAsUpdate(one, Y.encodeStateVector(other))
  const toOne = Y.encodeStateAsUpdate(other, Y.encodeStateVector(one))
  Y.applyUpdate(other, toOther)
  Y.applyUpdate(one, toOne)
}

function randomlySeeded(source: string) {
  const doc = new Y.Doc()
  prosemirrorToYXmlFragment(createDocument(source, schema), doc.getXmlFragment(FIELD))
  return doc
}

function seeded(source: string, clientId?: number) {
  const doc = new Y.Doc()
  Y.applyUpdate(doc, seedUpdate(source, schema, clientId))
  return doc
}

const STORED = '<h1>Title</h1><p>First paragraph</p>'
const SAVED_SINCE = '<h1>Title</h1><p>First paragraph, edited</p>'

describe('two tabs building their Yjs document from the same stored HTML (#435 question 3)', () => {
  test('seeding independently doubles the content when the tabs merge', () => {
    const one = randomlySeeded(STORED)
    const other = randomlySeeded(STORED)

    exchange(one, other)

    expect(html(one)).toBe(html(other))
    expect(html(one)).toBe('<h1>Title</h1><p>First paragraph</p><h1>Title</h1><p>First paragraph</p>')
  })

  test('seeding under one fixed client ID gives identical updates, so merging does not double', () => {
    expect(seedUpdate(STORED, schema, 1)).toEqual(seedUpdate(STORED, schema, 1))
    const one = seeded(STORED, 1)
    const other = seeded(STORED, 1)
    one.getXmlFragment(FIELD).insert(0, [new Y.XmlElement('paragraph')])

    exchange(one, other)

    expect(html(one)).toBe('<p></p><h1>Title</h1><p>First paragraph</p>')
    expect(html(other)).toBe(html(one))
  })

  test('seeding under one fixed client ID from HTML that changed between the loads leaves the tabs disagreeing for good', () => {
    const one = seeded('<p>Hello world</p>', 1)
    const other = seeded('<p>Hullo world</p>', 1)

    exchange(one, other)
    exchange(one, other)

    expect(html(one)).toBe('<p>Hello world</p>')
    expect(html(other)).toBe('<p>Hullo world</p>')
  })

  test('seeding under one fixed client ID from HTML that changed between the loads can garble the text', () => {
    const one = seeded('<p>Hello world, longer</p>', 1)
    const other = seeded('<p>Hi</p>', 1)

    exchange(one, other)
    exchange(one, other)

    expect(html(other)).toBe('<p>Hillo world, longer</p>')
    expect(html(one)).not.toBe(html(other))
  })

  test('a client ID taken from the HTML keeps identical HTML identical and changed HTML apart, which doubles it', () => {
    expect(seedClientId(STORED)).toBe(seedClientId(STORED))
    expect(seedClientId(STORED)).not.toBe(seedClientId(SAVED_SINCE))
    const same = [seeded(STORED), seeded(STORED)] as const
    const changed = [seeded(STORED), seeded(SAVED_SINCE)] as const

    exchange(...same)
    exchange(...changed)

    expect(html(same[0])).toBe(STORED)
    expect(html(changed[0])).toBe(html(changed[1]))
    expect(html(changed[0]).match(/<h1>/g)).toHaveLength(2)
  })
})

describe('seeding with the editor\'s parse options (#435)', () => {
  test('spaces typed in a row are kept, as the editor shows them with pre-wrap', () => {
    const doc = new Y.Doc()
    Y.applyUpdate(doc, seedUpdate('<p>Hello  there,   Sam</p>', schema, undefined, { preserveWhitespace: true }))

    expect(html(doc)).toBe('<p>Hello  there,   Sam</p>')
  })

  test('joining or seeding seeds with them too', async () => {
    const doc = new Y.Doc()

    await joinOrSeed(doc, Promise.resolve(false), '<p>Hello  there</p>', schema, { preserveWhitespace: true })

    expect(html(doc)).toBe('<p>Hello  there</p>')
  })
})

describe('joining an open session before seeding (#435 question 3)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function tab(channel: ReturnType<typeof createCoalescingChannel<YSyncData>>, name: string, source: string) {
    const doc = new Y.Doc()
    const transport = channel.tab(name)
    const sync = createYSync(doc, { send: transport.send, joinMs: 1500 })
    transport.on((clientId, data) => sync.receive(clientId, data))
    const ready = joinOrSeed(doc, sync.start(), source, schema)
    return { doc, ready }
  }

  test('a tab that opens after the HTML was saved again takes the open session\'s document instead of seeding', async () => {
    const channel = createCoalescingChannel<YSyncData>()
    const first = tab(channel, 'a', STORED)
    await vi.advanceTimersByTimeAsync(2000)
    await expect(first.ready).resolves.toBe('seeded')
    const paragraph = first.doc.getXmlFragment(FIELD).get(1) as Y.XmlElement
    ;(paragraph.get(0) as Y.XmlText).insert('First paragraph'.length, ', edited')
    await vi.advanceTimersByTimeAsync(2000)

    const second = tab(channel, 'b', SAVED_SINCE)
    await vi.advanceTimersByTimeAsync(2000)

    await expect(second.ready).resolves.toBe('joined')
    expect(html(second.doc)).toBe(SAVED_SINCE)
    expect(html(first.doc)).toBe(SAVED_SINCE)
  })

  test('two tabs opening together on the same HTML both seed it and do not double it', async () => {
    const channel = createCoalescingChannel<YSyncData>()
    const one = tab(channel, 'a', STORED)
    const other = tab(channel, 'b', STORED)
    await vi.advanceTimersByTimeAsync(5000)

    await expect(Promise.all([one.ready, other.ready])).resolves.toEqual(['seeded', 'seeded'])
    expect(html(one.doc)).toBe(STORED)
    expect(html(other.doc)).toBe(STORED)
  })

  test('two tabs that both seed different HTML before hearing each other end up with both versions', async () => {
    const channel = createCoalescingChannel<YSyncData>()
    const one = tab(channel, 'a', STORED)
    const other = tab(channel, 'b', SAVED_SINCE)
    await vi.advanceTimersByTimeAsync(5000)

    expect(html(one.doc)).toBe(html(other.doc))
    expect(html(one.doc).match(/<h1>/g)).toHaveLength(2)
  })
})

describe('how much rich text fits in one real-time event (#435 questions 2 and 3)', () => {
  function body(update: Uint8Array) {
    return JSON.stringify({ clientId: crypto.randomUUID(), event: 'yjs', iri: '/component/html_contents/1', data: { sv: 'AAAA', ds: 4294967295, update: encodeUpdate(update) } }).length
  }

  function article(paragraphs: number) {
    return Array.from({ length: paragraphs }, (_, i) => `<h2>Section ${i}</h2><p>Lorem ipsum dolor sit amet, <strong>consectetur</strong> adipiscing elit, sed do eiusmod tempor incididunt ut labore et <em>dolore magna</em> aliqua.</p>`).join('')
  }

  test('a seeded document of about 6 to 7 KB of HTML no longer fits in the API\'s 16 KB event body', () => {
    const fits = article(35)
    const tooLarge = article(40)

    expect(body(seedUpdate(fits, schema))).toBeLessThan(16_384)
    expect(body(seedUpdate(tooLarge, schema))).toBeGreaterThan(16_384)
    expect(fits.length).toBeGreaterThan(6_000)
    expect(tooLarge.length).toBeLessThan(7_000)
  })

  test('editing at scattered positions makes the Yjs state many times larger than the text it holds', () => {
    const doc = new Y.Doc()
    const paragraph = new Y.XmlElement('paragraph')
    doc.getXmlFragment(FIELD).insert(0, [paragraph])
    const text = new Y.XmlText()
    paragraph.insert(0, [text])
    let state = 7
    const random = () => (state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296
    for (let i = 0; i < 2280; i++) {
      text.insert(Math.floor(random() * (text.length + 1)), 'x')
      random() < 0.2 && text.delete(Math.floor(random() * text.length), 1)
    }

    expect(text.length).toBeLessThan(2000)
    expect(body(Y.encodeStateAsUpdate(doc))).toBeGreaterThan(16_384)
  })
})
