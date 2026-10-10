// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { consola } from 'consola'
import Mercure from '../mercure'
import ApiDocumentation from '../api-documentation'
import { ResourcesStore } from '../../storage/stores/resources/resources-store'
import { FetcherStore } from '../../storage/stores/fetcher/fetcher-store'
import { CwaResourceApiStatuses } from '../../storage/stores/resources/state'
import type { CwaResource } from '../../resources/resource-utils'
import FetchStatusManager from './fetch-status-manager'
import Fetcher from './fetcher'

vi.mock('../mercure')
vi.mock('../api-documentation')

const componentIri = '/component/html_contents/hero'
const draftIri = '/component/html_contents/hero-draft'
const loadedData = { '@id': componentIri, '@type': 'HtmlContent', '_metadata': { persisted: true }, 'html': '<p>good</p>' } as unknown as CwaResource

let resourcesStoreDef: ResourcesStore
let fetcherStoreDef: FetcherStore
let resourcesStore: ReturnType<ResourcesStore['useStore']>
let rawFetch: ReturnType<typeof vi.fn>

function createFetcher() {
  const manager = new FetchStatusManager(fetcherStoreDef, new Mercure(), new ApiDocumentation(), resourcesStoreDef)
  const vueRouter = { currentRoute: { value: { path: '/', query: {} } } }
  return new Fetcher({ fetch: { raw: rawFetch } } as never, manager, vueRouter as never, resourcesStoreDef)
}

function seedLoadedResource() {
  resourcesStore.setResourceFetchStatus({ iri: componentIri, isComplete: false, path: componentIri, headers: {} })
  resourcesStore.saveResource({ resource: loadedData })
  resourcesStore.setResourceFetchStatus({ iri: componentIri, isComplete: true, path: componentIri, headers: { path: '/' }, responseIri: draftIri })
  return JSON.parse(JSON.stringify(resourcesStore.current.byId[componentIri]))
}

function httpError(statusCode: number) {
  return Object.assign(new Error(`HTTP ${statusCode}`), { statusCode })
}

beforeEach(() => {
  setActivePinia(createPinia())
  resourcesStoreDef = new ResourcesStore('cwa')
  fetcherStoreDef = new FetcherStore('cwa')
  resourcesStore = resourcesStoreDef.useStore()
  fetcherStoreDef.useStore()
  rawFetch = vi.fn()
  vi.spyOn(consola, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('a failed background (noSave) re-fetch', () => {
  test('a failed background re-fetch of a loaded resource keeps its last good state', async () => {
    const before = seedLoadedResource()
    rawFetch.mockRejectedValue(new TypeError('Load failed'))

    await createFetcher().fetchResource({ path: componentIri, noSave: true, shallowFetch: true })

    expect(rawFetch).toHaveBeenCalled()
    expect(resourcesStore.current.byId[componentIri].apiState.status).toBe(CwaResourceApiStatuses.SUCCESS)
    expect(JSON.parse(JSON.stringify(resourcesStore.current.byId[componentIri]))).toEqual(before)
    expect(consola.warn).toHaveBeenCalled()
  })

  test('a 503 on a background re-fetch of a loaded resource also keeps its last good state', async () => {
    const before = seedLoadedResource()
    rawFetch.mockRejectedValue(httpError(503))

    await createFetcher().fetchResource({ path: componentIri, noSave: true, shallowFetch: true })

    expect(rawFetch).toHaveBeenCalled()
    expect(JSON.parse(JSON.stringify(resourcesStore.current.byId[componentIri]))).toEqual(before)
  })

  test('a 404 on a background re-fetch still sets ERROR', async () => {
    seedLoadedResource()
    rawFetch.mockRejectedValue(httpError(404))

    await createFetcher().fetchResource({ path: componentIri, noSave: true, shallowFetch: true })

    const apiState = resourcesStore.current.byId[componentIri].apiState
    expect(apiState.status).toBe(CwaResourceApiStatuses.ERROR)
    expect('error' in apiState && apiState.error?.statusCode).toBe(404)
  })

  test('a failed background fetch of a resource with no data sets ERROR', async () => {
    resourcesStore.setResourceFetchStatus({ iri: componentIri, isComplete: false, path: componentIri, headers: {} })
    resourcesStore.setResourceFetchStatus({ iri: componentIri, isComplete: true, path: componentIri, headers: {}, responseIri: componentIri })
    rawFetch.mockRejectedValue(new TypeError('Load failed'))

    await createFetcher().fetchResource({ path: componentIri, noSave: true, shallowFetch: true })

    expect(rawFetch).toHaveBeenCalled()
    expect(resourcesStore.current.byId[componentIri].apiState.status).toBe(CwaResourceApiStatuses.ERROR)
  })

  test('a failed foreground re-fetch of a loaded resource still sets ERROR', async () => {
    seedLoadedResource()
    rawFetch.mockRejectedValue(new TypeError('Load failed'))

    await createFetcher().fetchResource({ path: componentIri, shallowFetch: true })

    expect(rawFetch).toHaveBeenCalled()
    expect(resourcesStore.current.byId[componentIri].apiState.status).toBe(CwaResourceApiStatuses.ERROR)
  })
})
