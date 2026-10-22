import * as Y from 'yjs'
import type { ParseOptions, Schema } from '@tiptap/pm/model'
import { createYSync, decodeUpdate } from './y-sync'
import type { YSyncData } from './y-sync'
import { joinOrSeed } from './y-seed'
import { htmlHash } from './y-state'
import type { StoredCollaborationState } from './y-state'

export type YSessionStart = 'loaded' | 'joined' | 'seeded'

export interface YSessionState {
  load: () => Promise<StoredCollaborationState | undefined>
  save: (html: string | null | undefined) => Promise<void>
}

interface Session {
  doc: Y.Doc
  sync: ReturnType<typeof createYSync>
  state: YSessionState
  ready: Promise<YSessionStart>
  refs: number
  closed: boolean
}

export interface YSessionOptions {
  send: (data: YSyncData) => boolean
  others: () => boolean
  html: () => string | null | undefined
  schema: Schema
  parseOptions?: ParseOptions
  state: (doc: Y.Doc) => YSessionState
  joinMs?: number
}

const STORED = Symbol('y-session-stored')
const tabs = new WeakMap<object, Map<string, Session>>()

async function begin(session: Session, { others, html, schema, parseOptions }: YSessionOptions): Promise<YSessionStart> {
  const loaded = html()
  const stored = await session.state.load()
  if (session.closed) {
    return 'seeded'
  }
  if (stored && stored.htmlHash === htmlHash(loaded)) {
    Y.applyUpdate(session.doc, decodeUpdate(stored.state), STORED)
    session.sync.start()
    return 'loaded'
  }
  const joined = session.sync.start()
  return joinOrSeed(session.doc, others() ? joined : Promise.resolve(false), html(), schema, parseOptions)
}

export function acquireYSession(tab: object, key: string, options: YSessionOptions) {
  const sessions = tabs.get(tab) ?? new Map<string, Session>()
  tabs.set(tab, sessions)
  let session = sessions.get(key)
  if (!session) {
    const doc = new Y.Doc()
    const created: Session = { doc, sync: createYSync(doc, { send: options.send, joinMs: options.joinMs }), state: options.state(doc), refs: 0, closed: false, ready: Promise.resolve('seeded') }
    created.ready = begin(created, options)
    session = created
    sessions.set(key, session)
  }
  const held = session
  held.refs++
  let released = false
  return {
    doc: held.doc,
    sync: held.sync,
    state: held.state,
    ready: held.ready,
    release() {
      if (released) {
        return
      }
      released = true
      held.refs--
      if (!held.refs) {
        held.closed = true
        sessions.delete(key)
        held.sync.stop()
        held.doc.destroy()
      }
    },
  }
}
