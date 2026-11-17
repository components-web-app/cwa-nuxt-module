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

describe('ResourcesManager writes each field\'s save state (#458)', () => {
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

  test('each field sent is saving while the request is in flight, then saved', async () => {
    const { fetch, manager, seed, stateOf } = setup()
    seed({ '@id': PAGE, '@type': 'Page', 'title': 'Old', 'reference': 'old', '_metadata': { persisted: true } })
    let answer!: (resource: CwaResource) => void
    fetch.mockReturnValueOnce(new Promise((resolve) => {
      answer = resolve
    }))

    const saving = manager.updateResource({ endpoint: PAGE, data: { title: 'New', reference: 'new' } })
    expect(stateOf(PAGE, 'title')?.status).toBe('saving')
    expect(stateOf(PAGE, 'reference')?.status).toBe('saving')

    answer({ '@id': PAGE, '@type': 'Page', 'title': 'New', 'reference': 'new', '_metadata': { persisted: true } })
    await saving

    expect(stateOf(PAGE, 'title')?.status).toBe('saved')
    expect(stateOf(PAGE, 'reference')?.status).toBe('saved')
  })

  test('a page modal\'s save refused with 422 puts each violation on its own field, and a later save of another field never clears them', async () => {
    const { fetch, manager, seed, stateOf } = setup()
    seed({ '@id': PAGE, '@type': 'Page', 'title': 'Old', 'reference': 'old', 'layout': '/_/layouts/1', '_metadata': { persisted: true } })
    fetch.mockRejectedValueOnce(httpError(422, {
      detail: 'title: Add a title.\nreference: Use letters only.',
      violations: [{ propertyPath: 'title', message: 'Add a title.' }, { propertyPath: 'reference', message: 'Use letters only.' }],
    }))
    fetch.mockResolvedValueOnce({ '@id': PAGE, '@type': 'Page', 'title': 'Old', 'reference': 'old', 'layout': '/_/layouts/2', '_metadata': { persisted: true } })

    await manager.updateResource({ endpoint: PAGE, data: { title: '', reference: '1' } })
    await manager.updateResource({ endpoint: PAGE, data: { layout: '/_/layouts/2' } })

    expect(stateOf(PAGE, 'title')).toMatchObject({ status: 'error', error: { kind: 'violation', status: 422, message: 'Add a title.' } })
    expect(stateOf(PAGE, 'reference')).toMatchObject({ status: 'error', error: { kind: 'violation', status: 422, message: 'Use letters only.' } })
    expect(stateOf(PAGE, 'layout')?.status).toBe('saved')
  })

  test('a 412 marks each field sent as a conflict holding the server\'s value', async () => {
    const { fetch, manager, seed, stateOf } = setup()
    seed({ '@id': PAGE, '@type': 'Page', 'title': 'Old', '_metadata': { persisted: true, version: 2 } })
    fetch.mockRejectedValueOnce(httpError(412, { '@id': PAGE, '@type': 'Page', 'title': 'Theirs', '_metadata': { persisted: true, version: 3 } }))

    await manager.updateResource({ endpoint: PAGE, data: { title: 'Mine' } })

    expect(stateOf(PAGE, 'title')).toMatchObject({ status: 'conflict', held: { value: 'Theirs' }, error: { kind: 'precondition', status: 412 } })
  })

  test('a save of a live component that creates a draft moves the field\'s state to the draft', async () => {
    const { fetch, manager, seed, stateOf } = setup()
    seed({ '@id': LIVE, '@type': 'Title', 'title': 'Live', '_metadata': { persisted: true, publishable: { published: true } } })
    fetch.mockResolvedValueOnce({ '@id': DRAFT, '@type': 'Title', 'title': 'Mine', 'publishedResource': LIVE, '_metadata': { persisted: true, publishable: { published: false } } })

    await manager.updateResource({ endpoint: `${LIVE}?published=false`, data: { title: 'Mine' } })

    expect(stateOf(LIVE, 'title')).toBeUndefined()
    expect(stateOf(DRAFT, 'title')?.status).toBe('saved')
  })

  test('an upload, sent as FormData, writes no field state', async () => {
    const { fetch, manager, seed, store } = setup()
    seed({ '@id': PAGE, '@type': 'Page', '_metadata': { persisted: true } })
    fetch.mockResolvedValueOnce({ '@id': PAGE, '@type': 'Page', '_metadata': { persisted: true } })
    const data = new FormData()
    data.append('file', 'x')

    await manager.updateResource({ endpoint: `${PAGE}/upload`, iri: PAGE, data })

    expect(store.current.byId[PAGE]?.fieldStates).toBeUndefined()
  })

  test('a change to a component still being added, saved only in the store, leaves no pending state behind', async () => {
    const { manager, seed, stateOf, fetch } = setup()
    seed({ '@id': LIVE, '@type': 'Title', 'title': 'Old', '_metadata': { persisted: false } })
    const { writeFieldStates } = await import('./field-state-writer')
    writeFieldStates(states => states.edited(manager['resourcesStore'].getResource(LIVE), 'title'))

    await manager.updateResource({ endpoint: LIVE, data: { title: 'New' } })

    expect(fetch).not.toHaveBeenCalled()
    expect(stateOf(LIVE, 'title')).toBeUndefined()
  })
})
