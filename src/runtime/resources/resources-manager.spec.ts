import { describe, vi, test, beforeEach, afterEach } from 'vitest'
import { ResourcesStore } from '../storage/stores/resources/resources-store'
import { FetcherStore } from '../storage/stores/fetcher/fetcher-store'
import { ResourcesManager } from './resources-manager'

describe.todo('ResourceManager class tests', () => {
  let resourcesManager: ResourcesManager
  let resourcesStore: ResourcesStore
  let fetcherStore: FetcherStore
  beforeEach(() => {
    resourcesStore = new ResourcesStore('storeName')
    fetcherStore = new FetcherStore('storeName', resourcesStore)
    resourcesManager = new ResourcesManager(resourcesStore, fetcherStore)
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  test.todo('A test', () => {
    console.log(resourcesManager)
  })
})
