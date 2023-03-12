import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { ResourcesStore } from '../storage/stores/resources/resources-store'
import { CwaResourceApiStatuses } from '../storage/stores/resources/state'
import { FetcherStore } from '../storage/stores/fetcher/fetcher-store'
import { Resources } from './resources'

vi.mock('../storage/stores/resources/resources-store', () => {
  return {
    ResourcesStore: vi.fn(() => ({
      useStore: vi.fn(() => {
        return {
          resourceLoadStatus: 'any-load-status-result',
          current: {
            allIds: ['/id1', '/id2'],
            currentIds: ['/id1'],
            byId: {
              '/id1': {
                apiState: {
                  status: CwaResourceApiStatuses.IN_PROGRESS
                },
                data: {
                  '@id': '/id1'
                }
              },
              '/id2': {
                apiState: {
                  status: CwaResourceApiStatuses.SUCCESS
                },
                data: {
                  '@id': '/id2'
                }
              }
            }
          }
        }
      })
    }))
  }
})

describe('Resources class tests', () => {
  let resourcesManager: Resources
  let resourcesStore: ResourcesStore
  let fetcherStore: FetcherStore
  beforeEach(() => {
    resourcesStore = new ResourcesStore('storeName')
    fetcherStore = new FetcherStore('storeName')
    resourcesManager = new Resources(resourcesStore, fetcherStore)
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('currentIds getter', () => {
    expect(resourcesManager.currentIds).toStrictEqual(ResourcesStore.mock.results[0].value.useStore.mock.results[0].value.current.currentIds)
  })

  test('currentResources getter', () => {
    expect(resourcesManager.currentResources).toStrictEqual({
      '/id1': {
        apiState: {
          status: CwaResourceApiStatuses.IN_PROGRESS
        },
        data: {
          '@id': '/id1'
        }
      }
    })
  })

  test('resourceLoadStatus getter', () => {
    const status = resourcesManager.resourceLoadStatus
    expect(status).toStrictEqual('any-load-status-result')
  })

  test.each([
    { fetchesResolved: false, pending: false, result: true },
    { fetchesResolved: true, pending: false, result: false },
    { fetchesResolved: false, pending: true, result: true },
    { fetchesResolved: true, pending: true, result: true }
  ])('isLoading getter', ({ fetchesResolved, pending, result }) => {
    vi.spyOn(resourcesStore, 'useStore').mockImplementationOnce(() => {
      return {
        resourceLoadStatus: {
          pending
        }
      }
    })
    vi.spyOn(fetcherStore, 'useStore').mockImplementationOnce(() => {
      return {
        fetchesResolved
      }
    })
    const isLoading = resourcesManager.isLoading
    expect(isLoading.value).toStrictEqual(result)
  })
})
