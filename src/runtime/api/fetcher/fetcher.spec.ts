import { describe, test, vi, expect, afterEach } from 'vitest'
import { RouteLocationNormalizedLoaded } from 'vue-router'
import { FetchError } from 'ohmyfetch'
import { ResourcesStore } from '../../storage/stores/resources/resources-store'
import { FetcherStore } from '../../storage/stores/fetcher/fetcher-store'
import Mercure from '../mercure'
import { MercureStore } from '../../storage/stores/mercure/mercure-store'
import ApiDocumentation from '../api-documentation'
import { ApiDocumentationStore } from '../../storage/stores/api-documentation/api-documentation-store'
import Fetcher from './fetcher'
import FetchStatus from './fetch-status'

function createRoute (): RouteLocationNormalizedLoaded {
  return {
    name: '',
    path: '/',
    fullPath: '/',
    query: {},
    hash: '',
    matched: [],
    params: {},
    meta: {},
    redirectedFrom: undefined
  }
}

type TestStore = { useStore(): any }

vi.mock('../../storage/stores/resources/resources-store', () => {
  const resourcesStoreInstance = {
    setResourceFetchStatus: vi.fn(),
    setResourceFetchError: vi.fn()
  }
  return {
    ResourcesStore: vi.fn<[], TestStore>(() => ({
      name: 'ResourcesStore',
      useStore: vi.fn(() => (resourcesStoreInstance)
      )
    }))
  }
})
vi.mock('../../storage/stores/fetcher/fetcher-store', () => {
  return {
    FetcherStore: vi.fn<[], TestStore>(() => ({ name: 'FetcherStore', useStore: vi.fn() }))
  }
})
vi.mock('../../storage/stores/mercure/mercure-store', () => {
  return {
    MercureStore: vi.fn<[], TestStore>(() => ({ name: 'MercureStore', useStore: vi.fn() }))
  }
})
vi.mock('../../storage/stores/api-documentation/api-documentation-store', () => {
  return {
    ApiDocumentationStore: vi.fn<[], TestStore>(() => ({ name: 'ApiDocumentationStore', useStore: vi.fn() }))
  }
})

vi.mock('../mercure', () => {
  return {
    default: vi.fn(() => ({
      init: vi.fn()
    }))
  }
})
vi.mock('../api-documentation')
vi.mock('./fetch-status')

let fetcherStoreMock: FetcherStore
function createFetcher () {
  const storeName = 'customStoreName'
  const resourcesStoreMock = new ResourcesStore(storeName)
  fetcherStoreMock = new FetcherStore(storeName, resourcesStoreMock)
  const mercureStoreMock = new MercureStore(storeName)
  const mercureMock = new Mercure(mercureStoreMock, resourcesStoreMock, fetcherStoreMock)
  const apiDocumentationStoreMock = new ApiDocumentationStore(storeName)
  const apiUrl = 'https://api-url'
  const apiDocumentationMock = new ApiDocumentation(apiUrl, apiDocumentationStoreMock)

  return new Fetcher(apiUrl, fetcherStoreMock, resourcesStoreMock, createRoute(), mercureMock, apiDocumentationMock)
}

describe('Initialise a fetcher', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })
  test('Fetch status is initialised', () => {
    createFetcher()
    expect(FetchStatus).toHaveBeenCalledWith(fetcherStoreMock)
  })
})

describe('Fetcher starting resource fetches', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('Fetch status is started and resource is initialised in store', async () => {
    FetchStatus.mockImplementation(() => {
      return {
        startFetch: vi.fn(),
        finishFetch: vi.fn(() => {
          return new Promise(resolve => (resolve(true)))
        })
      }
    })
    const fetcher = createFetcher()

    const fetchStatusInstance = FetchStatus.mock.results[0].value
    const mercureInstance = Mercure.mock.results[0].value

    const startFetchEvent = { path: '/some-fetch-path' }
    vi.spyOn(fetchStatusInstance, 'startFetch').mockImplementation(() => {
      return {
        continueFetching: true,
        startFetchToken: {
          token: 'new-token',
          startEvent: startFetchEvent
        }
      }
    })

    await fetcher.fetchAndSaveResource(startFetchEvent)

    const resourcesStoreInstance = ResourcesStore.mock.results[0].value.useStore.mock.results[0].value
    expect(fetchStatusInstance.startFetch).toBeCalledWith(startFetchEvent)
    expect(resourcesStoreInstance.setResourceFetchStatus).toHaveBeenCalledWith({
      iri: startFetchEvent.path,
      status: 0
    })
    // in the finish it will have been called
    expect(mercureInstance.init).toHaveBeenCalledTimes(1)
  })

  test('Manifest fetching is started and errors are handled', async () => {
    FetchStatus.mockImplementation(() => {
      return {
        startFetch: vi.fn(),
        finishFetch: vi.fn(() => {
          return new Promise(resolve => (resolve(true)))
        }),
        setFetchManifestStatus: vi.fn(() => true)
      }
    })
    const fetcher = createFetcher()

    const fetchStatusInstance = FetchStatus.mock.results[0].value

    const startFetchEvent = { path: '/some-fetch-path' }
    vi.spyOn(fetchStatusInstance, 'startFetch').mockImplementation(() => {
      return {
        continueFetching: true,
        startFetchToken: {
          token: 'new-token',
          startEvent: startFetchEvent
        }
      }
    })

    // we will test doFetch elsewhere
    vi.spyOn(fetcher, 'doFetch').mockImplementation(() => {
      return new Promise((resolve) => {
        resolve({
          _data: {
            resource_iris: [
              '/manifest-resource-1',
              '/manifest-resource-2'
            ]
          }
        })
      })
    })

    vi.spyOn(fetcher, 'fetchBatch').mockImplementation(() => {
      return Promise.resolve()
    })

    // we will actually fetch the resolved manifest endpoints
    await fetcher.fetchRoute(startFetchEvent.path)
    expect(fetcher.fetchBatch).toBeCalledWith({
      paths: [
        '/manifest-resource-1',
        '/manifest-resource-2'
      ]
    })

    // fetch manifest statuses are updated
    expect(fetchStatusInstance.setFetchManifestStatus).toBeCalledTimes(2)
    expect(fetchStatusInstance.setFetchManifestStatus).toBeCalledWith({
      path: '/_/routes_manifest//some-fetch-path',
      inProgress: true
    })
    expect(fetchStatusInstance.setFetchManifestStatus).toBeCalledWith({
      path: '/_/routes_manifest//some-fetch-path',
      inProgress: false
    })

    // Handle errors
    const exampleFetchError = new FetchError()
    vi.spyOn(fetcher, 'fetchBatch').mockImplementation(() => {
      throw exampleFetchError
    })
    await fetcher.fetchRoute('/some-fetch-path')
    expect(fetchStatusInstance.setFetchManifestStatus).toBeCalledWith({
      path: '/_/routes_manifest//some-fetch-path',
      inProgress: false,
      fetchError: exampleFetchError
    })
  })
})
