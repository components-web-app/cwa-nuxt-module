import { describe, vi, test, expect, beforeEach } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { CwaFetcherStoreInterface, FetcherStore } from '../../storage/stores/fetcher/fetcher-store'
import { ResourcesStore } from '../../storage/stores/resources/resources-store'
import { fetcherInitTypes } from '../../storage/stores/fetcher/actions'
import FetchStatus from './fetch-status'

let fetcherStoreDefinition: FetcherStore
function createFetchStatus (): FetchStatus {
  const resourcesStore = new ResourcesStore('storeName')
  fetcherStoreDefinition = new FetcherStore('storeName', resourcesStore)
  return new FetchStatus(fetcherStoreDefinition)
}

describe('FetchStatus getters functionality', () => {
  test('Test getters', () => {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      initialState: {
        'storeName.fetcher': {
          status: {
            fetched: {},
            fetch: {}
          }
        }
      }
    })
    setActivePinia(pinia)

    const fetchStatus = createFetchStatus()
    const fetcherStore = fetcherStoreDefinition.useStore()

    expect(fetchStatus.path).toBe(undefined)

    fetcherStore.$state.status.fetched.path = 'fetched-path'
    expect(fetchStatus.path).toBe('fetched-path')

    fetcherStore.$state.status.fetch.path = 'fetch-path'
    expect(fetchStatus.path).toBe('fetch-path')

    // @ts-ignore
    fetchStatus.addEndpoint('existing-endpoint', 'some-promise')

    expect(fetchStatus.getFetchingPathPromise('existing-endpoint')).toBe('some-promise')

    expect(fetchStatus.getFetchingPathPromise('non-existent-endpoint')).toBeNull()
  })
})

describe('FetchStatus::startFetch', () => {
  const fetchStatus = createFetchStatus()
  let fetcherStore: CwaFetcherStoreInterface

  beforeEach(() => {
    const pinia = createTestingPinia({
      createSpy: vi.fn
    })
    setActivePinia(pinia)
    vi.clearAllMocks()
    fetcherStore = fetcherStoreDefinition.useStore()
  })

  test('Test startFetch function', () => {
    fetchStatus.startFetch({ path: 'any-path' })
    expect(fetcherStore.initFetchStatus).toHaveBeenCalledWith({
      path: 'any-path',
      type: fetcherInitTypes.START
    })
  })

  test('Test startFetch if in progress without an existing fetch path', () => {
    // @ts-ignore
    fetcherStore.$patch({
      status: {
        fetch: {
          path: 'fetching-path'
        }
      }
    })

    // @ts-ignore
    fetchStatus.addEndpoint('existing-endpoint', 'some-promise')

    fetchStatus.startFetch({ path: 'any-path', resetCurrentResources: true })
    expect(fetcherStore.initFetchStatus).toHaveBeenCalledWith({
      path: 'any-path',
      resetCurrentResources: true,
      type: fetcherInitTypes.START
    })
  })

  test('Test startFetch if in progress where existing fetch exists', () => {
    // @ts-ignore
    fetcherStore.$patch({
      status: {
        fetch: {
          path: 'fetching-path',
          paths: {
            'existing-endpoint': 'some-promise'
          }
        }
      }
    })
    expect(fetchStatus.startFetch({ path: 'existing-endpoint' })).toBe('some-promise')
    expect(fetcherStore.initFetchStatus).not.toHaveBeenCalled()
  })
})

describe('FetchStatus public interface functionality', () => {
  beforeEach(() => {
    const pinia = createTestingPinia({
      createSpy: vi.fn
    })
    setActivePinia(pinia)
  })

  test('Test addEndpoint function', () => {
    const fetchStatus = createFetchStatus()
    const fetcherStore = fetcherStoreDefinition.useStore()
    // @ts-ignore
    fetchStatus.addEndpoint('new-endpoint', 'some-promise')
  })

  test('Test finishFetch function', () => {
    const fetchStatus = createFetchStatus()
    const fetcherStore = fetcherStoreDefinition.useStore()
    const finishFetchObj = {
      path: 'path',
      pageIri: 'iri',
      fetchSuccess: true
    }
    fetchStatus.finishFetch(finishFetchObj)
    expect(fetcherStore.initFetchStatus).toHaveBeenCalledWith({
      ...finishFetchObj,
      type: fetcherInitTypes.FINISH
    })
  })
})
