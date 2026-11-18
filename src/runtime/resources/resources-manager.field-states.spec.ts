import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { ResourcesManager } from './resources-manager'
import { ResourcesStore } from '#cwa/storage/stores/resources/resources-store'
import { ErrorStore } from '#cwa/storage/stores/error/error-store'
import type { CwaResource } from '#cwa/resources/resource-utils'

const PAGE = '/_/pages/1'
const LIVE = '/component/titles/live'
const DRAFT = '/component/titles/draft'

function httpError(statusCode: number | undefined, data?: unknown) {
  return Object.assign(new Error('Request failed'), { statusCode, data })
}

function setup() {
  setActivePinia(createPinia())
  const storeDefinition = new ResourcesStore('cwa')
  const store = storeDefinition.useStore()
  const fetch = vi.fn()
  const admin = { emptyStack: vi.fn(), resourceStackManager: { forcePublishedVersion: { value: undefined as boolean | undefined } } }
  const manager = new ResourcesManager({ fetch, writeHeaders: {} } as never, storeDefinition, { primaryFetchPath: undefined } as never, new ErrorStore('cwa'), { fetchBatch: vi.fn() } as never, admin as never, {} as never, createApp({}))
  const seed = (resource: CwaResource) => store.saveResource({ resource })
  const stateOf = (iri: string, field: string) => store.current.byId[iri]?.fieldStates?.[field]
  return { store, fetch, manager, seed, stateOf }
}

async function fieldStatesLoaded() {
  const { writeFieldStates } = await import('./field-state-writer')
  await new Promise(resolve => writeFieldStates(resolve))
}

describe('ResourcesManager reports each request to the caller that asked, and writes no field state itself (#458)', () => {
  beforeEach(async () => {
    await fieldStatesLoaded()
  })

  test('updateResource still resolves to the saved resource, or undefined when the save fails', async () => {
    const { fetch, manager, seed } = setup()
    seed({ '@id': PAGE, '@type': 'Page', 'title': 'Old', '_metadata': { persisted: true } })
    const saved = { '@id': PAGE, '@type': 'Page', 'title': 'New', '_metadata': { persisted: true } }
    fetch.mockResolvedValueOnce(saved)
    fetch.mockRejectedValueOnce(httpError(500, { detail: 'Boom' }))

    expect(await manager.updateResource({ endpoint: PAGE, data: { title: 'New' } })).toBe(saved)
    expect(await manager.updateResource({ endpoint: PAGE, data: { title: 'Newer' } })).toBeUndefined()
  })

  test('a page modal\'s save refused with 422 leaves no field state in the store, so nothing is left that no model can clear', async () => {
    const { fetch, manager, seed, store } = setup()
    seed({ '@id': PAGE, '@type': 'Page', 'title': 'Old', 'reference': 'old', '_metadata': { persisted: true } })
    fetch.mockRejectedValueOnce(httpError(422, {
      detail: 'title: Add a title.',
      violations: [{ propertyPath: 'title', message: 'Add a title.' }],
    }))

    await manager.updateResource({ endpoint: PAGE, data: { title: '', reference: '1' } })
    await fieldStatesLoaded()

    expect(fetch).toHaveBeenCalledOnce()
    expect(store.current.byId[PAGE]?.fieldStates).toBeUndefined()
  })

  test('onRequest is told the IRI sent to as the request starts, then what it answered', async () => {
    const { fetch, manager, seed } = setup()
    seed({ '@id': PAGE, '@type': 'Page', 'title': 'Old', '_metadata': { persisted: true } })
    let answer!: (resource: CwaResource) => void
    fetch.mockReturnValueOnce(new Promise((resolve) => {
      answer = resolve
    }))
    const onRequest = vi.fn()

    const saving = manager.updateResource({ endpoint: `${PAGE}?published=false`, data: { title: 'New' }, onRequest })
    await vi.waitFor(() => expect(onRequest).toHaveBeenCalledOnce())
    const [sentTo, done] = onRequest.mock.calls[0]!
    expect(sentTo).toBe(PAGE)
    let outcome: unknown
    done.then((settled: unknown) => {
      outcome = settled
    })
    await Promise.resolve()
    expect(outcome).toBeUndefined()

    const saved = { '@id': PAGE, '@type': 'Page', 'title': 'New', '_metadata': { persisted: true } }
    answer(saved)
    await saving

    expect(outcome).toStrictEqual({ resource: saved, error: undefined })
  })

  test('onRequest is given the error a failed request answered with', async () => {
    const { fetch, manager, seed } = setup()
    seed({ '@id': PAGE, '@type': 'Page', 'title': 'Old', '_metadata': { persisted: true, version: 2 } })
    const refused = httpError(412, { '@id': PAGE, '@type': 'Page', 'title': 'Theirs', '_metadata': { persisted: true, version: 3 } })
    fetch.mockRejectedValueOnce(refused)
    const onRequest = vi.fn()

    await manager.updateResource({ endpoint: PAGE, data: { title: 'Mine' }, onRequest })

    expect(await onRequest.mock.calls[0]![1]).toStrictEqual({ resource: undefined, error: refused })
  })

  test('a change to a component still being added, saved only in the store, tells onRequest no request was made', async () => {
    const { manager, seed, fetch } = setup()
    seed({ '@id': LIVE, '@type': 'Title', 'title': 'Old', '_metadata': { persisted: false } })
    const onRequest = vi.fn()

    await manager.updateResource({ endpoint: LIVE, data: { title: 'New' }, onRequest })

    expect(fetch).not.toHaveBeenCalled()
    expect(onRequest).toHaveBeenCalledExactlyOnceWith(LIVE)
  })

  test('a save queued behind this tab\'s first save of a live component tells onRequest the draft it was sent to', async () => {
    const { fetch, manager, seed } = setup()
    seed({ '@id': LIVE, '@type': 'Title', 'title': 'Live', '_metadata': { persisted: true, version: 1, publishable: { published: true } } })
    const draft = { '@id': DRAFT, '@type': 'Title', 'title': 'a', 'publishedResource': LIVE, '_metadata': { persisted: true, version: 1, publishable: { published: false } } }
    fetch.mockResolvedValueOnce(draft)
    fetch.mockResolvedValueOnce({ ...draft, subtitle: 'b' })
    const onRequest = vi.fn()

    await Promise.all([
      manager.updateResource({ endpoint: LIVE, data: { title: 'a' } }),
      manager.updateResource({ endpoint: LIVE, data: { subtitle: 'b' }, onRequest }),
    ])

    expect(onRequest.mock.calls.map(([iri]) => iri)).toStrictEqual([DRAFT])
  })
})
