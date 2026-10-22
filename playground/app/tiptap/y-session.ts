import * as Y from 'yjs'
import type { Schema } from '@tiptap/pm/model'
import { createYSync } from './y-sync'
import type { YSyncData } from './y-sync'
import { joinOrSeed } from './y-seed'

interface Session {
  doc: Y.Doc
  sync: ReturnType<typeof createYSync>
  ready: Promise<'joined' | 'seeded'>
  refs: number
}

export interface YSessionOptions {
  send: (data: YSyncData) => boolean
  others: () => boolean
  html: () => string | null | undefined
  schema: Schema
  joinMs?: number
}

const tabs = new WeakMap<object, Map<string, Session>>()

export function acquireYSession(tab: object, iri: string, { send, others, html, schema, joinMs }: YSessionOptions) {
  const sessions = tabs.get(tab) ?? new Map<string, Session>()
  tabs.set(tab, sessions)
  let session = sessions.get(iri)
  if (!session) {
    const doc = new Y.Doc()
    const sync = createYSync(doc, { send, joinMs })
    const joined = sync.start()
    session = { doc, sync, refs: 0, ready: joinOrSeed(doc, others() ? joined : Promise.resolve(false), html(), schema) }
    sessions.set(iri, session)
  }
  const held = session
  held.refs++
  let released = false
  return {
    doc: held.doc,
    sync: held.sync,
    ready: held.ready,
    release() {
      if (released) {
        return
      }
      released = true
      held.refs--
      if (!held.refs) {
        sessions.delete(iri)
        held.sync.stop()
        held.doc.destroy()
      }
    },
  }
}
