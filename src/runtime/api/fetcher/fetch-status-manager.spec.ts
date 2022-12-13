import { afterEach, beforeEach, describe, vi, test, expect } from 'vitest'
import Mercure from '../mercure'
import ApiDocumentation from '../api-documentation'
import { FetcherStore } from '../../storage/stores/fetcher/fetcher-store'
import FetchStatusManager from './fetch-status-manager'
import { ResourcesStore } from '../../storage/stores/resources/resources-store'

vi.mock('../../storage/stores/fetcher/fetcher-store', () => ({
  FetcherStore: vi.fn(() => ({
    useStore: vi.fn(() => ({
      startFetch: vi.fn()
    }))
  }))
}))
vi.mock('../../storage/stores/resources/resources-store', () => ({
  ResourcesStore: vi.fn(() => ({
    useStore: vi.fn(() => ({
      setResourceFetchStatus: vi.fn(),
      resetCurrentResources: vi.fn()
    }))
  }))
}))
vi.mock('../mercure')
vi.mock('../api-documentation')

function createFetchStatusManager (): FetchStatusManager {
  const fetcherStore = new FetcherStore()
  const resourcesStore = new ResourcesStore()
  const mercure = new Mercure()
  const apiDocumentation = new ApiDocumentation()
  return new FetchStatusManager(fetcherStore, mercure, apiDocumentation, resourcesStore)
}

describe('Starting a new fetch', () => {
  let fetchStatusManager: FetchStatusManager

  beforeEach(() => {
    fetchStatusManager = createFetchStatusManager()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('the startFetch action in fetcher store is called', () => {
    const startFetchEvent = {
      path: '/fetch-path'
    }
    fetchStatusManager.startFetch(startFetchEvent)
    expect(FetcherStore.mock.results[0].value.useStore.mock.results[0].value.startFetch).toHaveBeenCalledWith(startFetchEvent)
  })

  test.todo('If no start token, initialise mercure')
  test.todo('If primary and a we have a token, clear current resources')
})

describe.todo('startFetchResource', () => {})
describe.todo('finishFetchResource', () => {})
describe.todo('finishFetch', () => {})
