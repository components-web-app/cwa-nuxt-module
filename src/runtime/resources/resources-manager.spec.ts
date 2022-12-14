import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { ResourcesStore } from '../storage/stores/resources/resources-store'
import { ResourcesManager } from './resources-manager'

vi.mock('../storage/stores/resources/resources-store', () => {
  return {
    ResourcesStore: vi.fn(() => ({
      useStore: vi.fn(() => {
        return {
          current: {
            allIds: ['/id1', '/id2'],
            currentIds: ['/id1'],
            byId: {
              '/id1': {
                '@id': '/id1'
              },
              '/id2': {
                '@id': '/id2'
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
        '@id': '/id1'
      }
    })
  })
})
