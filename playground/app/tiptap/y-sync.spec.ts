import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import * as Y from 'yjs'
import { createYSync, decodeUpdate, encodeUpdate } from './y-sync'
import type { YSyncData } from './y-sync'
import { createCoalescingChannel } from './fake-realtime-channel'
import type { ChannelOptions } from './fake-realtime-channel'

function seededRandom(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

function tabs(names: string[], options: ChannelOptions = {}, syncOptions: { retryMs?: number, joinMs?: number } = {}) {
  const channel = createCoalescingChannel<YSyncData>(options)
  const all = names.map((name) => {
    const doc = new Y.Doc()
    const tab = channel.tab(name)
    const sync = createYSync(doc, { send: tab.send, ...syncOptions })
    tab.on((clientId, data) => sync.receive(clientId, data))
    const joined = sync.start()
    return { name, doc, sync, joined, text: doc.getText('t') }
  })
  return { channel, all }
}

function typeInto(text: Y.Text, char: string, random: () => number) {
  text.insert(Math.floor(random() * (text.length + 1)), char)
}

function count(text: Y.Text, char: string) {
  return text.toString().split(char).length - 1
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('sending Yjs updates through a queue that keeps only the newest data per event (#435 question 1)', () => {
  test('sending each update as it happens loses edits when the queue coalesces them', async () => {
    const channel = createCoalescingChannel<string>()
    const docs = ['a', 'b'].map((name) => {
      const doc = new Y.Doc()
      const tab = channel.tab(name)
      doc.on('update', (update: Uint8Array, origin: unknown) => origin !== 'remote' && tab.send(encodeUpdate(update)))
      tab.on((_clientId, data) => Y.applyUpdate(doc, decodeUpdate(data), 'remote'))
      return { name, doc, text: doc.getText('t') }
    })
    const random = seededRandom(1)
    for (let i = 0; i < 60; i++) {
      typeInto(docs[i % 2]!.text, docs[i % 2]!.name, random)
      await vi.advanceTimersByTimeAsync(30)
    }
    await vi.advanceTimersByTimeAsync(5000)

    expect(docs[0]!.text.toString()).not.toBe(docs[1]!.text.toString())
    expect(count(docs[1]!.text, 'a')).toBeLessThan(30)
  })

  test('two tabs typing at once at random positions converge with every keystroke kept exactly once', async () => {
    const { channel, all: [a, b] } = tabs(['a', 'b'])
    const random = seededRandom(2)
    for (let i = 0; i < 400; i++) {
      typeInto(a!.text, 'a', random)
      typeInto(b!.text, 'b', random)
      await vi.advanceTimersByTimeAsync(Math.floor(random() * 40))
    }
    await vi.advanceTimersByTimeAsync(5000)

    expect(a!.text.toString()).toBe(b!.text.toString())
    expect(count(a!.text, 'a')).toBe(400)
    expect(count(a!.text, 'b')).toBe(400)
    expect(channel.stats.posts).toBeLessThan(400)
  })

  test('two tabs typing at the same position converge with every keystroke kept exactly once', async () => {
    const { all: [a, b] } = tabs(['a', 'b'])
    a!.text.insert(0, '[]')
    await vi.advanceTimersByTimeAsync(1000)
    for (let i = 0; i < 200; i++) {
      a!.text.insert(1, 'a')
      b!.text.insert(1, 'b')
      await vi.advanceTimersByTimeAsync(15)
    }
    await vi.advanceTimersByTimeAsync(5000)

    expect(a!.text.toString()).toBe(b!.text.toString())
    expect(count(a!.text, 'a')).toBe(200)
    expect(count(b!.text, 'b')).toBe(200)
  })

  test('deletions and insertions from three tabs converge', async () => {
    const { all } = tabs(['a', 'b', 'c'])
    all[0]!.text.insert(0, 'The quick brown fox jumps over the lazy dog')
    await vi.advanceTimersByTimeAsync(1000)
    const random = seededRandom(3)
    for (let i = 0; i < 300; i++) {
      const tab = all[i % 3]!
      if (random() < 0.3 && tab.text.length > 0) {
        tab.text.delete(Math.floor(random() * tab.text.length), 1)
      }
      else {
        typeInto(tab.text, tab.name, random)
      }
      await vi.advanceTimersByTimeAsync(Math.floor(random() * 20))
    }
    await vi.advanceTimersByTimeAsync(5000)

    expect(all[1]!.text.toString()).toBe(all[0]!.text.toString())
    expect(all[2]!.text.toString()).toBe(all[0]!.text.toString())
  })

  test('an edit whose message never arrives reaches the other tab by the retry', async () => {
    let dropped = 0
    const { all: [a, b] } = tabs(['a', 'b'], { drop: from => from === 'a' && dropped++ < 3 }, { retryMs: 1000 })
    a!.text.insert(0, 'kept')
    await vi.advanceTimersByTimeAsync(500)
    expect(b!.text.toString()).toBe('')

    await vi.advanceTimersByTimeAsync(5000)

    expect(dropped).toBeGreaterThanOrEqual(1)
    expect(b!.text.toString()).toBe('kept')
  })

  test('a deletion whose message never arrives reaches the other tab by the retry', async () => {
    const drops = { on: false }
    const { all: [a, b] } = tabs(['a', 'b'], { drop: (from, to) => drops.on && from === 'a' && to === 'b' }, { retryMs: 1000 })
    a!.text.insert(0, 'hello world')
    await vi.advanceTimersByTimeAsync(2000)
    expect(b!.text.toString()).toBe('hello world')

    drops.on = true
    a!.text.delete(5, 6)
    await vi.advanceTimersByTimeAsync(500)
    drops.on = false
    await vi.advanceTimersByTimeAsync(5000)

    expect(b!.text.toString()).toBe('hello')
  })

  test('once the tabs are in step a keystroke sends only that keystroke', async () => {
    const { channel, all: [a, b] } = tabs(['a', 'b'])
    a!.text.insert(0, 'x'.repeat(5000))
    await vi.advanceTimersByTimeAsync(3000)
    expect(b!.text.length).toBe(5000)
    const posts = channel.stats.posts

    a!.text.insert(2500, 'y')
    await vi.advanceTimersByTimeAsync(3000)

    expect(b!.text.toString()).toBe(a!.text.toString())
    expect(Math.max(...channel.stats.bodies.slice(posts))).toBeLessThan(400)
  })

  test('the tabs stop sending once they are in step', async () => {
    const { channel, all: [a] } = tabs(['a', 'b'])
    a!.text.insert(0, 'hello')
    await vi.advanceTimersByTimeAsync(3000)
    const posts = channel.stats.posts

    await vi.advanceTimersByTimeAsync(10_000)

    expect(channel.stats.posts).toBe(posts)
  })
})

describe('the real-time channel refusing a send (#435)', () => {
  test('a hello refused because the channel is not ready is sent again, and answers are awaited only once it was accepted', async () => {
    const channel = createCoalescingChannel<YSyncData>()
    const a = new Y.Doc()
    const tabA = channel.tab('a')
    const syncA = createYSync(a, { send: tabA.send })
    tabA.on((clientId, data) => syncA.receive(clientId, data))
    syncA.start()
    a.getText('t').insert(0, 'already here')
    await vi.advanceTimersByTimeAsync(2000)

    const b = new Y.Doc()
    const tabB = channel.tab('b')
    const ready = { now: false }
    const send = vi.fn((data: YSyncData) => ready.now && tabB.send(data))
    const syncB = createYSync(b, { send, joinMs: 1500 })
    tabB.on((clientId, data) => syncB.receive(clientId, data))
    let settled: boolean | undefined
    syncB.start().then((joined) => {
      settled = joined
    })
    await vi.advanceTimersByTimeAsync(3000)
    expect(send).toHaveBeenCalled()
    expect(settled).toBeUndefined()

    ready.now = true
    await vi.advanceTimersByTimeAsync(1000)

    expect(settled).toBe(true)
    expect(b.getText('t').toString()).toBe('already here')
  })

  test('an edit refused while the channel is paused is sent once it accepts again', async () => {
    const channel = createCoalescingChannel<YSyncData>()
    const open = { now: true }
    const [a, b] = ['a', 'b'].map((name) => {
      const doc = new Y.Doc()
      const tab = channel.tab(name)
      const sync = createYSync(doc, { send: data => open.now && tab.send(data), retryMs: 60_000 })
      tab.on((clientId, data) => sync.receive(clientId, data))
      sync.start()
      return doc
    })
    await vi.advanceTimersByTimeAsync(2000)

    open.now = false
    a!.getText('t').insert(0, 'typed while paused')
    await vi.advanceTimersByTimeAsync(2000)
    open.now = true
    await vi.advanceTimersByTimeAsync(2000)

    expect(b!.getText('t').toString()).toBe('typed while paused')
  })
})

describe('knowing whether anyone else is editing (#435)', () => {
  test('has company once another tab is heard, and none once it says goodbye', async () => {
    const { all: [a, b] } = tabs(['a', 'b'])
    expect(a!.sync.hasPeers()).toBe(false)
    b!.text.insert(0, 'hello')
    await vi.advanceTimersByTimeAsync(1000)
    expect(a!.sync.hasPeers()).toBe(true)

    b!.sync.stop()
    await vi.advanceTimersByTimeAsync(1000)

    expect(a!.sync.hasPeers()).toBe(false)
  })
})

describe('a window that has gone without saying goodbye (#435)', () => {
  test('keeps resending everything since that window\'s state until it is forgotten, then sends only what is new', async () => {
    const gone = { now: false }
    const { channel, all: [a, b] } = tabs(['a', 'b'], { drop: (_from, to) => gone.now && to === 'b' }, { retryMs: 1000 })
    a!.text.insert(0, 'hello')
    await vi.advanceTimersByTimeAsync(3000)
    gone.now = true
    a!.text.insert(5, ' world'.repeat(50))
    await vi.advanceTimersByTimeAsync(3000)
    const resending = channel.stats.posts
    await vi.advanceTimersByTimeAsync(3000)
    expect(channel.stats.posts).toBeGreaterThan(resending)

    a!.sync.forget('b')
    await vi.advanceTimersByTimeAsync(3000)
    const settled = channel.stats.posts
    await vi.advanceTimersByTimeAsync(10_000)
    expect(channel.stats.posts).toBe(settled)
    a!.text.insert(0, '!')
    await vi.advanceTimersByTimeAsync(1000)

    expect(a!.sync.hasPeers()).toBe(false)
    expect(channel.stats.bodies.at(-1)).toBeLessThan(400)
    expect(b!.text.toString()).toBe('hello')
  })
})

describe('choosing the one window that saves (#435)', () => {
  test('the window whose Yjs document has the lowest client ID among the live windows saves, and the next lowest takes over when it leaves', async () => {
    const { all } = tabs(['a', 'b', 'c'])
    all[0]!.doc.clientID = 30
    all[1]!.doc.clientID = 10
    all[2]!.doc.clientID = 20
    all[0]!.text.insert(0, 'x')
    await vi.advanceTimersByTimeAsync(3000)
    const live = ['a', 'b', 'c']
    const savers = () => all.filter(tab => tab.sync.isSaver(live.filter(name => name !== tab.name))).map(tab => tab.name)
    expect(savers()).toEqual(['b'])

    live.splice(live.indexOf('b'), 1)

    expect(savers().filter(name => name !== 'b')).toEqual(['c'])
  })

  test('a window joining with everything the others have is still answered, so it knows who else is in the session', async () => {
    const channel = createCoalescingChannel<YSyncData>()
    const [a, b] = ['a', 'b'].map((name) => {
      const doc = new Y.Doc()
      doc.getText('t').insert(0, 'same')
      return { name, doc, tab: channel.tab(name) }
    }) as [{ name: string, doc: Y.Doc, tab: ReturnType<typeof channel.tab> }, { name: string, doc: Y.Doc, tab: ReturnType<typeof channel.tab> }]
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc))
    Y.applyUpdate(a.doc, Y.encodeStateAsUpdate(b.doc))
    const syncA = createYSync(a.doc, { send: a.tab.send })
    a.tab.on((clientId, data) => syncA.receive(clientId, data))
    syncA.start()
    await vi.advanceTimersByTimeAsync(2000)

    const syncB = createYSync(b.doc, { send: b.tab.send })
    b.tab.on((clientId, data) => syncB.receive(clientId, data))
    syncB.start()
    await vi.advanceTimersByTimeAsync(2000)

    expect(syncB.peers().map(peer => peer.clientId)).toEqual(['a'])
    expect(syncA.peers().map(peer => peer.clientId)).toEqual(['b'])
  })

  test('a window heard over the channel but not live counts for nothing, and one that said goodbye counts for nothing', async () => {
    const { all: [a, b] } = tabs(['a', 'b'])
    a!.doc.clientID = 2
    b!.doc.clientID = 1
    a!.text.insert(0, 'x')
    await vi.advanceTimersByTimeAsync(3000)
    expect(a!.sync.isSaver(['b'])).toBe(false)
    expect(a!.sync.isSaver([])).toBe(true)

    b!.sync.stop()
    await vi.advanceTimersByTimeAsync(1000)

    expect(a!.sync.isSaver(['b'])).toBe(true)
  })
})

describe('cursors travelling in the Yjs event (#435)', () => {
  test('a cursor change alone is sent, and the other window holds the newest one with that window\'s document ID', async () => {
    const { all: [a, b] } = tabs(['a', 'b'])
    a!.text.insert(0, 'hello')
    await vi.advanceTimersByTimeAsync(3000)
    const onChange = vi.fn()
    b!.sync.onChange(onChange)

    a!.sync.setCursor({ anchor: 1, head: 2 })
    a!.sync.setCursor({ anchor: 3, head: 3 })
    await vi.advanceTimersByTimeAsync(1000)

    expect(b!.sync.peers()).toEqual([{ clientId: 'a', id: a!.doc.clientID, cursor: { anchor: 3, head: 3 } }])
    expect(onChange).toHaveBeenCalled()

    a!.sync.setCursor(null)
    await vi.advanceTimersByTimeAsync(1000)
    expect(b!.sync.peers()[0]!.cursor).toBeNull()
  })

  test('typing and moving the cursor at once share one send', async () => {
    const { channel, all: [a, b] } = tabs(['a', 'b'])
    await vi.advanceTimersByTimeAsync(3000)
    const posts = channel.stats.posts

    a!.text.insert(0, 'h')
    a!.sync.setCursor({ anchor: 1, head: 1 })
    await vi.advanceTimersByTimeAsync(1000)

    expect(channel.stats.senders.slice(posts).filter(sender => sender === 'a')).toHaveLength(1)
    expect(b!.text.toString()).toBe('h')
    expect(b!.sync.peers()[0]!.cursor).toEqual({ anchor: 1, head: 1 })
  })

  test('a forgotten window is no longer listed, and the listeners hear it', async () => {
    const { all: [a, b] } = tabs(['a', 'b'])
    a!.text.insert(0, 'x')
    await vi.advanceTimersByTimeAsync(3000)
    const onChange = vi.fn()
    b!.sync.onChange(onChange)

    b!.sync.forget('a')

    expect(b!.sync.peers()).toEqual([])
    expect(onChange).toHaveBeenCalledOnce()
  })
})

describe('a tab joining after the others have edited (#435 question 2)', () => {
  test('catches up by sending its state vector and receiving the difference', async () => {
    const channel = createCoalescingChannel<YSyncData>()
    const a = { doc: new Y.Doc() }
    const tabA = channel.tab('a')
    const syncA = createYSync(a.doc, { send: tabA.send })
    tabA.on((clientId, data) => syncA.receive(clientId, data))
    syncA.start()
    a.doc.getText('t').insert(0, 'written before the other tab opened')
    await vi.advanceTimersByTimeAsync(60_000)

    const b = { doc: new Y.Doc() }
    const tabB = channel.tab('b')
    const syncB = createYSync(b.doc, { send: tabB.send })
    tabB.on((clientId, data) => syncB.receive(clientId, data))
    const joined = syncB.start()
    await vi.advanceTimersByTimeAsync(1000)

    await expect(joined).resolves.toBe(true)
    expect(b.doc.getText('t').toString()).toBe('written before the other tab opened')
  })

  test('is not reported as joined by a change it cannot apply yet, only once it holds everything that tab has', async () => {
    const channel = createCoalescingChannel<YSyncData>({ deliverMs: 1000 })
    const a = new Y.Doc()
    const tabA = channel.tab('a')
    const syncA = createYSync(a, { send: tabA.send })
    tabA.on((clientId, data) => syncA.receive(clientId, data))
    syncA.start()
    a.getText('t').insert(0, 'Hello')
    await vi.advanceTimersByTimeAsync(5000)

    const b = new Y.Doc()
    const tabB = channel.tab('b')
    const syncB = createYSync(b, { send: tabB.send, joinMs: 10_000 })
    tabB.on((clientId, data) => syncB.receive(clientId, data))
    let joinedWith: string | undefined
    syncB.start().then(() => {
      joinedWith = b.getText('t').toString()
    })
    a.getText('t').insert(5, ' world')
    await vi.advanceTimersByTimeAsync(5000)

    expect(joinedWith).toBe('Hello world')
  })

  test('reports that nobody answered when it is alone', async () => {
    const { all: [a] } = tabs(['a'], {}, { joinMs: 1500 })
    await vi.advanceTimersByTimeAsync(1500)

    await expect(a!.joined).resolves.toBe(false)
  })

  test('two tabs opening together with nothing to share both report that nobody had content', async () => {
    const { all: [a, b] } = tabs(['a', 'b'], {}, { joinMs: 1500 })
    await vi.advanceTimersByTimeAsync(1500)

    await expect(Promise.all([a!.joined, b!.joined])).resolves.toEqual([false, false])
  })

  test('a document whose difference is larger than the API accepts in one event cannot be sent', () => {
    const doc = new Y.Doc()
    doc.getText('t').insert(0, 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(220))
    const body = JSON.stringify({ clientId: crypto.randomUUID(), event: 'yjs', iri: '/component/html_contents/1', data: { sv: '', ds: 0, update: encodeUpdate(Y.encodeStateAsUpdate(doc)) } })

    expect(doc.getText('t').length).toBeLessThan(13_000)
    expect(body.length).toBeGreaterThan(16_384)
  })
})
