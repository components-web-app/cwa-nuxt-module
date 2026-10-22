// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { getSchema } from '@tiptap/core'
import { StarterKit } from '@tiptap/starter-kit'
import { acquireYSession } from './y-session'
import type { YSyncData } from './y-sync'

const schema = getSchema([StarterKit])
const IRI = '/component/html_contents/1'
const TAB = {}

function options(send: (data: YSyncData) => boolean, html = '<p>Hello</p>') {
  return { send, others: () => false, html: () => html, schema }
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
})
