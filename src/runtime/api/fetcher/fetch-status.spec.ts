import { describe, vi, test, expect, beforeEach } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { FetcherStore } from '../../storage/stores/fetcher/fetcher-store'
import { ResourcesStore } from '../../storage/stores/resources/resources-store'
import FetchStatus from './fetch-status'

let fetcherStore: FetcherStore
function createFetchStatus (): FetchStatus {
  const resourcesStore = new ResourcesStore('storeName')
  fetcherStore = new FetcherStore('storeName', resourcesStore)
  return new FetchStatus(fetcherStore)
}

describe('FetchStatus getters functionality', () => {
  test('Test getters', () => {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      initialState: {
        'storeName.fetcher': {
          status: {
            fetched: {},
            fetch: {
              paths: {
                'existing-endpoint': 'some-promise'
              }
            }
          }
        }
      }
    })
    setActivePinia(pinia)

    const fetchStatus = createFetchStatus()
    const fetcherStoreDefinition = fetcherStore.useStore()

    expect(fetchStatus.path).toBe(undefined)

    fetcherStoreDefinition.$state.status.fetched.path = 'fetched-path'
    expect(fetchStatus.path).toBe('fetched-path')

    fetcherStoreDefinition.$state.status.fetch.path = 'fetch-path'
    expect(fetchStatus.path).toBe('fetch-path')

    expect(fetchStatus.getFetchingPathPromise('existing-endpoint')).toBe('some-promise')

    expect(fetchStatus.getFetchingPathPromise('non-existent-endpoint')).toBeNull()
  })
})

describe('FetchStatus public interface functionality', () => {
  beforeEach(() => {
    const pinia = createTestingPinia({
      createSpy: vi.fn
    })
    setActivePinia(pinia)
  })

  test('Test startFetch function', () => {
    const fetchStatus = createFetchStatus()
    const fetcherStoreDefinition = fetcherStore.useStore()

    fetchStatus.startFetch('any-path')
    expect(fetcherStoreDefinition.initFetchStatus).toHaveBeenCalledWith({
      path: 'any-path'
    })

    // @ts-ignore
    fetcherStoreDefinition.$patch({
      status: {
        fetch: {
          inProgress: true,
          paths: {
            'existing-endpoint': 'some-promise'
          }
        }
      }
    })

    vi.clearAllMocks()
    fetchStatus.startFetch('any-path')
    expect(fetcherStoreDefinition.initFetchStatus).toHaveBeenCalledWith({
      path: 'any-path'
    })

    vi.clearAllMocks()
    expect(fetchStatus.startFetch('existing-endpoint')).toBe('some-promise')
    expect(fetcherStoreDefinition.initFetchStatus).not.toHaveBeenCalled()
  })

  test('Test addEndpoint function', () => {
    const fetchStatus = createFetchStatus()
    const fetcherStoreDefinition = fetcherStore.useStore()
    // @ts-ignore
    fetchStatus.addEndpoint('new-endpoint', 'some-promise')
    expect(fetcherStoreDefinition.addPath).toHaveBeenCalledWith('new-endpoint', 'some-promise')
  })

  test('Test finishFetch function', () => {
    const fetchStatus = createFetchStatus()
    const fetcherStoreDefinition = fetcherStore.useStore()
    const finishFetchObj = {
      path: 'path',
      pageIri: 'iri',
      success: true
    }
    fetchStatus.finishFetch(finishFetchObj)
    expect(fetcherStoreDefinition.initFetchStatus).toHaveBeenCalledWith(finishFetchObj)
  })
})
