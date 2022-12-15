import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { ResourcesStore } from '../storage/stores/resources/resources-store'
import { ResourcesManager } from './resources-manager'

vi.mock('../storage/stores/resources/resources-store', () => {
  return {
    ResourcesStore: vi.fn(() => ({
      useStore: vi.fn(() => {
        return {
          totalResourcesPending: vi.fn(() => 1),
          current: {
            allIds: ['/id1', '/id2'],
            currentIds: ['/id1'],
            byId: {
              '/id1': {
                apiState: {
                  status: 0
                },
                data: {
                  '@id': '/id1'
                }
              },
              '/id2': {
                apiState: {
                  status: 1
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
    resourcesManager = new ResourcesManager(new ResourcesStore('storeName'))
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
          status: 0
        },
        data: {
          '@id': '/id1'
        }
      }
    })
  })
})

describe('ResourceManager -> resourceLoadStatus', () => {
  let resourcesManager: ResourcesManager
  beforeEach(() => {
    resourcesManager = new ResourcesManager(new ResourcesStore('storeName'))
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  test.each([
    { total: 0, complete: 0, expectedPercent: 100 },
    { total: 1, complete: 0, expectedPercent: 0 },
    { total: 2, complete: 1, expectedPercent: 50 },
    { total: 3, complete: 1, expectedPercent: 33 },
    { total: 3, complete: 3, expectedPercent: 100 }
  ])('If the total to fetch is $total and we have loaded $complete the percentage should be $expectedPercent', ({ total, complete, expectedPercent }) => {
    const pending = total - complete
    const currentIds = Array.from(Array(total).keys())
    ResourcesStore.mock.results[0].value.useStore.mockImplementation(() => {
      return {
        totalResourcesPending: pending,
        current: {
          currentIds
        }
      }
    })
    expect(resourcesManager.resourceLoadStatus).toStrictEqual({
      complete,
      pending,
      percent: expectedPercent,
      total
    })
  })
})
