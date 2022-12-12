import { describe, test, vi, expect, afterEach, beforeEach, beforeAll } from 'vitest'
import { RouteLocationNormalizedLoaded } from 'vue-router'
import { FetchError } from 'ohmyfetch'
import consola from 'consola'
import { reactive } from 'vue'
import { ResourcesStore } from '../../storage/stores/resources/resources-store'
import { FetcherStore } from '../../storage/stores/fetcher/fetcher-store'
import Mercure from '../mercure'
import { MercureStore } from '../../storage/stores/mercure/mercure-store'
import ApiDocumentation from '../api-documentation'
import { ApiDocumentationStore } from '../../storage/stores/api-documentation/api-documentation-store'
import { CwaResourceTypes } from '../../resources/resource-utils'
import Fetcher from './fetcher'
import FetchStatus from './fetch-status'
import CwaFetch from './cwa-fetch'
import preloadHeaders from './preload-headers'

function createRoute (path = '/', query = {}): RouteLocationNormalizedLoaded {
  return reactive({
    name: '',
    path,
    fullPath: '/',
    query,
    hash: '',
    matched: [],
    params: {},
    meta: {},
    redirectedFrom: undefined
  })
}

vi.mock('consola')

type TestStore = { useStore(): any }

vi.mock('../../storage/stores/resources/resources-store', () => {
  const resourcesStoreInstance = {
    setResourceFetchStatus: vi.fn(),
    setResourceFetchError: vi.fn(),
    saveResource: vi.fn()
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
vi.mock('./fetch-status', () => {
  return {
    default: vi.fn(() => {
      return {
        addPath: vi.fn(),
        startFetch: vi.fn(),
        finishFetch: vi.fn(() => {
          return new Promise(resolve => (resolve(true)))
        }),
        setFetchManifestStatus: vi.fn(() => true),
        path: '/fetch-status-path'
      }
    })
  }
})
vi.mock('./cwa-fetch', () => {
  return {
    default: vi.fn(() => ({
      fetch: {
        raw: vi.fn()
      }
    }))
  }
})

let fetcherStoreMock: FetcherStore
let currentRoute: RouteLocationNormalizedLoaded
function createFetcher (currentPath = '/', query = {}) {
  const storeName = 'customStoreName'
  const resourcesStoreMock = new ResourcesStore(storeName)
  fetcherStoreMock = new FetcherStore(storeName, resourcesStoreMock)
  const mercureStoreMock = new MercureStore(storeName)
  const mercureMock = new Mercure(mercureStoreMock, resourcesStoreMock, fetcherStoreMock)
  const apiDocumentationStoreMock = new ApiDocumentationStore(storeName)
  const cwaFetch = new CwaFetch('https://api-url')
  const apiDocumentationMock = new ApiDocumentation(cwaFetch, apiDocumentationStoreMock)
  currentRoute = createRoute(currentPath, query)

  return new Fetcher(cwaFetch, fetcherStoreMock, resourcesStoreMock, currentRoute, mercureMock, apiDocumentationMock)
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

describe('Fetcher startResourceFetch context', () => {
  let fetcher: Fetcher

  beforeEach(() => {
    fetcher = createFetcher()
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

    vi.spyOn(fetcher, 'fetchBatch').mockImplementation(() => {
      return Promise.resolve()
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('Fetch status is started and resource is initialised in store', async () => {
    vi.spyOn(fetcher, 'doFetch').mockImplementation(() => {
      return Promise.resolve({
        _data: {}
      })
    })

    const fetchStatusInstance = FetchStatus.mock.results[0].value
    const mercureInstance = Mercure.mock.results[0].value

    const startFetchEvent = { path: '/some-fetch-path' }

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

  test('Manifest fetching is started', async () => {
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
      return Promise.resolve({
        _data: {
          resource_iris: [
            '/manifest-resource-1',
            '/manifest-resource-2'
          ]
        }
      })
    })

    // we will actually fetch the resolved manifest endpoints
    await fetcher.fetchRoute(startFetchEvent.path)

    // fetch manifest statuses are updated
    expect(fetchStatusInstance.setFetchManifestStatus).toBeCalledWith({
      path: '/_/routes_manifest//some-fetch-path',
      inProgress: true
    })
    expect(fetchStatusInstance.setFetchManifestStatus).toBeCalledWith({
      path: '/_/routes_manifest//some-fetch-path',
      inProgress: false
    })
    expect(fetchStatusInstance.setFetchManifestStatus).toBeCalledTimes(2)

    expect(fetcher.fetchBatch).toBeCalledWith({
      paths: [
        '/manifest-resource-1',
        '/manifest-resource-2'
      ]
    })

    expect(consola.success).toBeCalledWith('Manifest fetched 2 resources')
  })

  test('We log if no manifest resources are found', async () => {
    // we will test doFetch elsewhere
    vi.spyOn(fetcher, 'doFetch').mockImplementation(() => {
      return Promise.resolve({
        _data: {
          resource_iris: []
        }
      })
    })
    await fetcher.fetchRoute('/some-fetch-path')
    expect(consola.info).toBeCalledWith('Manifest fetch did not return any resources')
  })

  test('We log if the data returned does not contain manifest resources', async () => {
    vi.spyOn(fetcher, 'doFetch').mockImplementation(() => {
      return Promise.resolve({
        _data: {}
      })
    })
    await fetcher.fetchRoute('/some-fetch-path')
    expect(consola.warn).toBeCalledWith('Unable to fetch manifest resources')
  })

  test('If there is a network or fetch error getting the manifest, we save the error', async () => {
    const fetchStatusInstance = FetchStatus.mock.results[0].value
    // we will test doFetch elsewhere
    vi.spyOn(fetcher, 'doFetch').mockImplementation(() => {
      throw exampleFetchError
    })
    // Handle errors
    const exampleFetchError = new FetchError()
    await fetcher.fetchRoute('/some-fetch-path')
    expect(fetchStatusInstance.setFetchManifestStatus).toBeCalledWith({
      path: '/_/routes_manifest//some-fetch-path',
      inProgress: false,
      fetchError: exampleFetchError
    })
  })

  test('startResourceFetch will return the fetchStatus.startFetch result', async () => {
    const startFetchEvent = { path: '/some-fetch-path' }
    const startFetchResponse = {
      continueFetching: false,
      startFetchToken: {
        token: 'new-token',
        startEvent: startFetchEvent
      }
    }

    const fetchStatusInstance = FetchStatus.mock.results[0].value
    fetchStatusInstance.startFetch.mockImplementationOnce(() => {
      return startFetchResponse
    })
    vi.spyOn(fetcher, 'startResourceFetch')

    await fetcher.fetchAndSaveResource(startFetchEvent)
    expect(fetcher.startResourceFetch.mock.results[0].value).toStrictEqual(startFetchResponse)
  })
})

describe('fetcher fetchAndSaveResource context', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('doFetch is not called if startResourceFetch.continueFetching is false', async () => {
    const startFetchEvent = { path: '/some-fetch-path' }
    const fetcher = createFetcher()

    vi.spyOn(fetcher, 'doFetch')
    vi.spyOn(fetcher, 'startResourceFetch').mockImplementation(() => {
      return {
        continueFetching: false,
        startFetchToken: {
          existingFetchPromise: undefined
        }
      }
    })

    await fetcher.fetchAndSaveResource(startFetchEvent)
    expect(fetcher.doFetch).not.toHaveBeenCalled()
  })

  test('doFetch is not called if startResourceFetch.continueFetching is false and an existing promise is returned', async () => {
    const startFetchEvent = { path: '/some-fetch-path' }
    const fetcher = createFetcher()

    const existingFetchPromise = vi.fn()
    vi.spyOn(fetcher, 'doFetch')
    vi.spyOn(fetcher, 'startResourceFetch').mockImplementation(() => {
      return {
        continueFetching: false,
        startFetchToken: {
          existingFetchPromise
        }
      }
    })
    vi.spyOn(fetcher, 'fetchAndValidateCwaResource').mockImplementation(() => {
      return 'fetchValidateResponse'
    })

    const resource = await fetcher.fetchAndSaveResource(startFetchEvent)
    expect(fetcher.fetchAndValidateCwaResource).toHaveBeenCalledWith(existingFetchPromise)
    expect(fetcher.doFetch).not.toHaveBeenCalled()
    expect(resource).toBe('fetchValidateResponse')
  })

  test('Resource fetch functions are called and resources saved to store - tests the fetchAndValidateCwaResource function for valid resource', async () => {
    const startFetchEvent = { path: '/some-fetch-path' }
    const fetcher = createFetcher()
    vi.spyOn(fetcher, 'startResourceFetch').mockImplementation(() => {
      return {
        continueFetching: true,
        startFetchToken: {
          token: 'abc',
          startEvent: startFetchEvent
        }
      }
    })

    const apiCwaResource = {
      '@id': '/resource-id',
      '@type': 'mytype',
      _metadata: {}
    }
    vi.spyOn(fetcher, 'doFetch').mockImplementation(() => {
      return Promise.resolve({
        _data: apiCwaResource
      })
    })
    vi.spyOn(fetcher, 'finishResourceFetch').mockImplementation(() => {})
    vi.spyOn(fetcher, 'fetchNestedResources').mockImplementation(() => {})

    const resource = await fetcher.fetchAndSaveResource(startFetchEvent)
    expect(fetcher.doFetch).toHaveBeenCalledTimes(1)
    expect(fetcher.doFetch).toHaveBeenCalledWith(startFetchEvent)

    const resourcesStoreInstance = ResourcesStore.mock.results[0].value.useStore.mock.results[0].value
    expect(resourcesStoreInstance.saveResource).toHaveBeenCalledWith({
      resource: apiCwaResource
    })
    expect(fetcher.fetchNestedResources).toHaveBeenCalledWith(apiCwaResource)
    expect(fetcher.finishResourceFetch).toHaveBeenCalledWith({
      fetchSuccess: true,
      path: '/some-fetch-path',
      token: 'abc'
    })
    expect(resource).toBe(apiCwaResource)
  })

  test('Invalid resources are not saved and the fetchSuccess response is false - tests the fetchAndValidateCwaResource for invalid resource', async () => {
    const startFetchEvent = { path: '/some-fetch-path' }
    const fetcher = createFetcher()
    vi.spyOn(fetcher, 'startResourceFetch').mockImplementation(() => {
      return {
        continueFetching: true,
        startFetchToken: {
          token: 'abc',
          startEvent: startFetchEvent
        }
      }
    })
    vi.spyOn(fetcher, 'doFetch').mockImplementation(() => {
      return 'invalidCwaResourceResponse'
    })
    vi.spyOn(fetcher, 'finishResourceFetch').mockImplementation(() => {})
    vi.spyOn(fetcher, 'fetchNestedResources').mockImplementation(() => {})

    const resource = await fetcher.fetchAndSaveResource(startFetchEvent)

    expect(ResourcesStore.mock.results[0].value.useStore).not.toHaveBeenCalled()
    expect(fetcher.fetchNestedResources).not.toHaveBeenCalled()
    expect(fetcher.finishResourceFetch).toHaveBeenCalledWith({
      fetchSuccess: false,
      path: '/some-fetch-path',
      token: 'abc'
    })
    expect(resource).toBeUndefined()
  })
})

describe('doFetch will add path and call to create the promise and return the generated promise', () => {
  const startFetchEvent = { path: '/some-fetch-path' }
  let fetcher: Fetcher

  afterEach(() => {
    vi.clearAllMocks()
  })

  beforeEach(() => {
    fetcher = createFetcher()
    vi.spyOn(fetcher, 'startResourceFetch').mockImplementation(() => {
      return {
        continueFetching: true,
        startFetchToken: {
          token: 'abc',
          startEvent: startFetchEvent
        }
      }
    })
    vi.spyOn(fetcher, 'finishResourceFetch').mockImplementation(() => {})
    vi.spyOn(fetcher, 'fetchNestedResources').mockImplementation(() => {})
  })

  test('doFetch adds the path to the fetch status', async () => {
    vi.spyOn(fetcher, 'doFetch')
    vi.spyOn(fetcher, 'createFetchPromise').mockImplementation(() => {
      return 'someFetchPromise'
    })
    vi.spyOn(fetcher, 'fetchAndValidateCwaResource').mockImplementation(() => {
      return 'fetchValidateResponse'
    })

    const fetchStatusInstance = FetchStatus.mock.results[0].value
    vi.spyOn(fetchStatusInstance, 'addPath')

    await fetcher.fetchAndSaveResource(startFetchEvent)
    expect(fetcher.createFetchPromise).toHaveBeenCalledTimes(1)
    expect(fetcher.createFetchPromise).toHaveBeenCalledWith(startFetchEvent)
    expect(fetchStatusInstance.addPath).toHaveBeenCalledWith(
      startFetchEvent.path,
      'someFetchPromise'
    )
    expect(fetcher.doFetch).toReturnWith('someFetchPromise')
  })
})

describe('createFetchPromise', () => {
  const startFetchEvent = { path: '/_/routes//some-fetch-path' }
  let fetcher: Fetcher

  beforeAll(() => {
    fetcher = createFetcher('/?queryParam=value', { queryParam: 'value' })
    vi.spyOn(fetcher, 'startResourceFetch').mockImplementation(() => {
      return {
        continueFetching: true,
        startFetchToken: {
          token: 'abc',
          startEvent: startFetchEvent
        }
      }
    })
    vi.spyOn(fetcher, 'finishResourceFetch').mockImplementation(() => {})
    vi.spyOn(fetcher, 'fetchNestedResources').mockImplementation(() => {})
    vi.spyOn(fetcher, 'appendQueryToPath')
    vi.spyOn(fetcher, 'createRequestHeaders')
    CwaFetch.mock.results[0].value.fetch.raw.mockImplementation(() => {
      return Promise.resolve({
        _data: {}
      })
    })
  })

  test('Requests have the current querystring appended and the return is the result of fetch.raw', async () => {
    vi.spyOn(fetcher, 'createFetchPromise')

    await fetcher.fetchAndSaveResource(startFetchEvent)

    expect(fetcher.appendQueryToPath).toBeCalledWith(startFetchEvent.path)
    expect(fetcher.appendQueryToPath.mock.results[0].value).toBe('/_/routes//some-fetch-path?queryParam=value')
    expect(fetcher.createFetchPromise.mock.results[0]).toStrictEqual(CwaFetch.mock.results[0].value.fetch.raw.mock.results[0])
  })

  test('Requests can handle no query existing so will not append to fetch.raw', async () => {
    currentRoute.query = {}

    await fetcher.fetchAndSaveResource(startFetchEvent)
    expect(fetcher.appendQueryToPath.mock.results[1].value).toBe('/_/routes//some-fetch-path')
  })

  test('Requests can handle no query existing so will not append to fetch.raw', async () => {
    currentRoute.query = undefined

    await fetcher.fetchAndSaveResource(startFetchEvent)
    expect(fetcher.appendQueryToPath.mock.results[2].value).toBe('/_/routes//some-fetch-path')
  })

  test('We create the appropriate request headers', () => {
    expect(fetcher.createRequestHeaders).toBeCalledWith(startFetchEvent)
    expect(fetcher.createRequestHeaders.mock.results[0].value).toStrictEqual({
      path: '/fetch-status-path',
      preload: preloadHeaders[CwaResourceTypes.ROUTE].join(',')
    })
  })

  test('We can override the preload headers', async () => {
    vi.clearAllMocks()
    startFetchEvent.preload = ['/some-preload']
    await fetcher.fetchAndSaveResource(startFetchEvent)
    expect(fetcher.createRequestHeaders.mock.results[0].value).toStrictEqual({
      path: '/fetch-status-path',
      preload: '/some-preload'
    })
  })
})

describe.todo('handleFetchResponse', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })
})

describe.todo('handleFetchError', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })
})

describe.todo('fetchNestedResources will loop through nested resources to fetch appropriate properties', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('We only initialise Mercure once', () => {})
})

describe.todo('fetchBatch returns a bluebird promise map', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })
})

describe.todo('finishResourceFetch functionality', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })
})

describe.todo('fetchRoute functionality, mocking all calls as they are re-used processes from other tests, just ensure functions are all called', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })
})
