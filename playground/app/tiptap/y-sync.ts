import * as Y from 'yjs'

export type YCursor = { anchor: unknown, head: unknown } | null

export interface YSyncData {
  id: number
  sv: string
  ds: number
  update: string
  cursor?: YCursor
  bye?: true
}

export interface YSyncPeer {
  clientId: string
  id: number
  cursor: YCursor
}

export interface YSyncOptions {
  send: (data: YSyncData) => boolean
  retryMs?: number
  joinMs?: number
  refusedMs?: number
}

type StateVector = Map<number, number>

const REMOTE = Symbol('y-sync')

export function encodeUpdate(update: Uint8Array) {
  let binary = ''
  for (const byte of update) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

export function decodeUpdate(encoded: string) {
  return Uint8Array.from(atob(encoded), char => char.charCodeAt(0))
}

function stateVector(doc: Y.Doc): StateVector {
  return Y.decodeStateVector(Y.encodeStateVector(doc))
}

function digest(doc: Y.Doc) {
  let hash = 0x811C9DC5
  for (const byte of Y.encodeSnapshot(Y.snapshot(doc))) {
    hash = Math.imul(hash ^ byte, 0x01000193) >>> 0
  }
  return hash
}

function lacks(theirs: StateVector, ours: StateVector) {
  for (const [client, clock] of ours) {
    if ((theirs.get(client) ?? 0) < clock) {
      return true
    }
  }
  return false
}

export function createYSync(doc: Y.Doc, { send, retryMs = 1000, joinMs = 1500, refusedMs = 250 }: YSyncOptions) {
  const peers = new Map<string, { sv: StateVector, ds: number, id: number, cursor: YCursor }>()
  const listeners = new Set<() => void>()
  let cursor: YCursor = null
  let lastSent: StateVector | undefined
  let queued = false
  let running = false
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let joinTimer: ReturnType<typeof setTimeout> | undefined
  let settle: ((joined: boolean) => void) | undefined

  function changed() {
    listeners.forEach(listener => listener())
  }

  function baseline() {
    if (!peers.size) {
      return lastSent ? Y.encodeStateVector(lastSent) : undefined
    }
    const base: StateVector = new Map()
    for (const client of stateVector(doc).keys()) {
      base.set(client, Math.min(...[...peers.values()].map(peer => peer.sv.get(client) ?? 0)))
    }
    return Y.encodeStateVector(base)
  }

  function message(): YSyncData {
    const update = Y.encodeStateAsUpdate(doc, baseline())
    return { id: doc.clientID, sv: encodeUpdate(Y.encodeStateVector(doc)), ds: digest(doc), update: encodeUpdate(update), cursor }
  }

  function behind() {
    const ours = stateVector(doc)
    const ds = digest(doc)
    return [...peers.values()].some(peer => lacks(peer.sv, ours) || peer.ds !== ds)
  }

  function scheduleRetry() {
    clearTimeout(retryTimer)
    retryTimer = running && behind() ? setTimeout(flush, retryMs) : undefined
  }

  function flush() {
    if (queued || !running) {
      return
    }
    queued = true
    queueMicrotask(() => {
      queued = false
      if (!running) {
        return
      }
      if (!send(message())) {
        clearTimeout(retryTimer)
        retryTimer = setTimeout(flush, refusedMs)
        return
      }
      lastSent = stateVector(doc)
      if (settle && !joinTimer) {
        joinTimer = setTimeout(() => settle?.(false), joinMs)
      }
      scheduleRetry()
    })
  }

  function onUpdate(_update: Uint8Array, origin: unknown) {
    origin !== REMOTE && flush()
  }

  function forget(clientId: string) {
    peers.delete(clientId) && changed()
    scheduleRetry()
  }

  function receive(clientId: string, data: YSyncData) {
    if (!running) {
      return
    }
    if (data.bye) {
      forget(clientId)
      return
    }
    const known = peers.has(clientId)
    const before = Y.encodeStateVector(doc).join()
    const beforeDs = digest(doc)
    data.update && Y.applyUpdate(doc, decodeUpdate(data.update), REMOTE)
    const theirs = Y.decodeStateVector(decodeUpdate(data.sv))
    peers.set(clientId, { sv: theirs, ds: data.ds, id: data.id, cursor: data.cursor ?? null })
    changed()
    const ours = stateVector(doc)
    if (settle && theirs.size && !lacks(ours, theirs)) {
      settle(true)
    }
    if (!known || before !== Y.encodeStateVector(doc).join() || beforeDs !== digest(doc) || lacks(theirs, ours)) {
      flush()
      return
    }
    scheduleRetry()
  }

  function start() {
    running = true
    lastSent = stateVector(doc)
    doc.on('update', onUpdate)
    const joined = new Promise<boolean>((resolve) => {
      settle = (value) => {
        clearTimeout(joinTimer)
        settle = undefined
        resolve(value)
      }
    })
    flush()
    return joined
  }

  function stop() {
    if (!running) {
      return
    }
    running = false
    doc.off('update', onUpdate)
    clearTimeout(retryTimer)
    settle?.(false)
    send({ ...message(), update: '', cursor: null, bye: true })
  }

  return {
    start,
    stop,
    receive,
    forget,
    setCursor(next: YCursor) {
      cursor = next
      flush()
    },
    peers: (): YSyncPeer[] => [...peers].map(([clientId, peer]) => ({ clientId, id: peer.id, cursor: peer.cursor })),
    hasPeers: () => peers.size > 0,
    isSaver: (live: string[]) => [...peers].every(([clientId, peer]) => !live.includes(clientId) || peer.id >= doc.clientID),
    onChange(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
