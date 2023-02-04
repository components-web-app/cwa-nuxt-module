import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { ResourcesStore } from '../storage/stores/resources/resources-store'
import { CwaResourceApiStatuses } from '../storage/stores/resources/state'
import { FetcherStore } from '../storage/stores/fetcher/fetcher-store'
import { ResourcesManager } from './resources-manager'

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

describe('ResourceManager class tests', () => {
  let resourcesManager: ResourcesManager
  beforeEach(() => {
    const resourcesStore = new ResourcesStore('storeName')
    resourcesManager = new ResourcesManager(resourcesStore, new FetcherStore('storeName', resourcesStore))
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
})
