import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { ResourcesStore } from '../storage/stores/resources/resources-store'
import { ResourcesManager } from './resources-manager'

vi.mock('../storage/stores/resources/resources-store', () => {
  return {
    ResourcesStore: vi.fn(() => ({
      useStore: vi.fn(() => {
        return {
          current: {
            currentIds: ['/id1']
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
    expect(resourcesManager.currentIds).toBe(ResourcesStore.mock.results[0].value.useStore.mock.results[0].value.current.currentIds)
  })
})
