import * as Y from 'yjs'

export interface YSyncData {
  sv: string
  ds: number
  update: string
  bye?: true
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
  const peers = new Map<string, { sv: StateVector, ds: number }>()
  let lastSent: StateVector | undefined
  let queued = false
  let running = false
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let joinTimer: ReturnType<typeof setTimeout> | undefined
  let settle: ((joined: boolean) => void) | undefined

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
    return { sv: encodeUpdate(Y.encodeStateVector(doc)), ds: digest(doc), update: encodeUpdate(update) }
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

  function receive(clientId: string, data: YSyncData) {
    if (!running) {
      return
    }
    if (data.bye) {
      peers.delete(clientId)
      return
    }
    const before = Y.encodeStateVector(doc).join()
    const beforeDs = digest(doc)
    data.update && Y.applyUpdate(doc, decodeUpdate(data.update), REMOTE)
    const theirs = Y.decodeStateVector(decodeUpdate(data.sv))
    peers.set(clientId, { sv: theirs, ds: data.ds })
    const ours = stateVector(doc)
    if (settle && theirs.size && !lacks(ours, theirs)) {
      settle(true)
    }
    if (before !== Y.encodeStateVector(doc).join() || beforeDs !== digest(doc) || lacks(theirs, ours)) {
      flush()
      return
    }
    scheduleRetry()
  }

  function start() {
    running = true
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
    send({ ...message(), update: '', bye: true })
  }

  return { start, stop, receive, hasPeers: () => peers.size > 0 }
}
