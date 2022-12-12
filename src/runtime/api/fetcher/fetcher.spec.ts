import { describe, test, vi, expect, afterEach, beforeEach, beforeAll } from 'vitest'
import { RouteLocationNormalizedLoaded } from 'vue-router'
import { FetchError } from 'ohmyfetch'
import consola from 'consola'
import { reactive } from 'vue'
import * as ohmyfetch from 'ohmyfetch'
import { ResourcesStore } from '../../storage/stores/resources/resources-store'
import { FetcherStore } from '../../storage/stores/fetcher/fetcher-store'
import Mercure from '../mercure'
import { MercureStore } from '../../storage/stores/mercure/mercure-store'
import ApiDocumentation from '../api-documentation'
import { ApiDocumentationStore } from '../../storage/stores/api-documentation/api-documentation-store'
import { CwaResourceTypes } from '../../resources/resource-utils'
import InvalidResourceResponse from '../../errors/invalid-resource-response'
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
      init: vi.fn(),
      setMercureHubFromLinkHeader: vi.fn()
    }))
  }
})
vi.mock('../api-documentation', () => {
  return {
    default: vi.fn(() => ({
      setDocsPathFromLinkHeader: vi.fn()
    }))
  }
})
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
vi.mock('ohmyfetch')

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
    const result = await fetcher.fetchRoute('/some-fetch-path')
    expect(consola.warn).toBeCalledWith('Unable to fetch manifest resources')
    expect(result).toBeUndefined()
  })

  test('If there is a network or fetch error getting the manifest, we save the error', async () => {
    const fetchStatusInstance = FetchStatus.mock.results[0].value
    // we will test doFetch elsewhere
    vi.spyOn(fetcher, 'doFetch').mockImplementation(() => {
      throw exampleFetchError
    })
    // Handle errors
    const exampleFetchError = new FetchError()
    const result = await fetcher.fetchRoute('/some-fetch-path')
    expect(fetchStatusInstance.setFetchManifestStatus).toBeCalledWith({
      path: '/_/routes_manifest//some-fetch-path',
      inProgress: false,
      fetchError: exampleFetchError
    })
    expect(result).toBeUndefined()
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

    const result = await fetcher.fetchAndSaveResource(startFetchEvent)
    expect(fetcher.doFetch).not.toHaveBeenCalled()
    expect(result).toBeUndefined()
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
    vi.spyOn(fetcher, 'handleFetchError')
    vi.spyOn(fetcher, 'handleFetchResponse').mockImplementation(() => {})
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
    expect(CwaFetch.mock.results[0].value.fetch.raw.mock.calls[0][0]).toBe('/_/routes//some-fetch-path?queryParam=value')
  })

  test('Use an ampersand delimiter if the current path has a query already', async () => {
    vi.spyOn(fetcher, 'createFetchPromise')

    fetcher.appendQueryToPath.mockClear()
    await fetcher.fetchAndSaveResource({ path: '/_/routes//some-fetch-path?existingQuery' })
    expect(fetcher.appendQueryToPath.mock.results[0].value).toBe('/_/routes//some-fetch-path?existingQuery&queryParam=value')
  })

  test('Requests can handle no query existing so will not append to fetch.raw', async () => {
    currentRoute.query = {}

    fetcher.appendQueryToPath.mockClear()
    await fetcher.fetchAndSaveResource(startFetchEvent)
    expect(fetcher.appendQueryToPath.mock.results[0].value).toBe('/_/routes//some-fetch-path')
  })

  test('Requests can handle no query existing so will not append to fetch.raw', async () => {
    currentRoute.query = undefined

    fetcher.appendQueryToPath.mockClear()
    await fetcher.fetchAndSaveResource(startFetchEvent)
    expect(fetcher.appendQueryToPath.mock.results[0].value).toBe('/_/routes//some-fetch-path')
  })

  test('We create the appropriate request headers', () => {
    expect(fetcher.createRequestHeaders).toBeCalledWith(startFetchEvent)
    expect(fetcher.createRequestHeaders.mock.results[0].value).toStrictEqual({
      path: '/fetch-status-path',
      preload: preloadHeaders[CwaResourceTypes.ROUTE].join(',')
    })
    expect(CwaFetch.mock.results[0].value.fetch.raw.mock.calls[0][1].headers).toStrictEqual(fetcher.createRequestHeaders.mock.results[0].value)
  })

  test('We set the correct handlers for the fetch call', () => {
    CwaFetch.mock.results[0].value.fetch.raw.mock.calls[0][1].onResponse({ ctx: 'value' })
    expect(fetcher.handleFetchResponse).toHaveBeenCalledWith({ ctx: 'value' })
    expect(CwaFetch.mock.results[0].value.fetch.raw.mock.calls[0][1].onRequestError).toBe(fetcher.handleFetchError)
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

describe('handleFetchResponse', () => {
  const startFetchEvent = { path: '/_/routes//some-fetch-path' }
  let fetcher: Fetcher

  beforeAll(() => {
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
    vi.spyOn(fetcher, 'appendQueryToPath')
    vi.spyOn(fetcher, 'createRequestHeaders')
    vi.spyOn(fetcher, 'handleFetchError')
    vi.spyOn(fetcher, 'handleFetchResponse')
    CwaFetch.mock.results[0].value.fetch.raw.mockImplementation(() => {
      return Promise.resolve({
        _data: {
          someKey: 'my value'
        }
      })
    })
  })

  test('call to set the api documentation and mercure url\'s from the link header and return the response data', async () => {
    await fetcher.fetchAndSaveResource(startFetchEvent)
    CwaFetch.mock.results[0].value.fetch.raw.mock.calls[0][1].onResponse({ response: { _data: { dataKey: 'dataValue' }, headers: { get: vi.fn(type => (type === 'link' ? 'linkheader' : undefined)) } } })
    expect(Mercure.mock.results[0].value.setMercureHubFromLinkHeader).toHaveBeenCalledWith('linkheader')
    expect(ApiDocumentation.mock.results[0].value.setDocsPathFromLinkHeader).toHaveBeenCalledWith('linkheader')
    expect(fetcher.handleFetchResponse.mock.results[0].value).toStrictEqual({
      dataKey: 'dataValue'
    })
  })

  test('create a fetch error', () => {
    // @ts-ignore
    vi.spyOn(ohmyfetch, 'createFetchError').mockImplementation(() => {
      return new Error('mocked-fetch-error')
    })
    const omfOnRequestErrorFn = CwaFetch.mock.results[0].value.fetch.raw.mock.calls[0][1].onRequestError
    expect(() => {
      omfOnRequestErrorFn({
        request: 'my-request',
        error: 'this is the error'
      })
    }).toThrowError('mocked-fetch-error')
    expect(ohmyfetch.createFetchError).toHaveBeenCalledWith('my-request', 'this is the error')
  })
})

describe('fetchNestedResources & fetchBatch & bluebird will loop through nested resources to fetch appropriate properties', () => {
  const pageResource = {
    '@id': '/_/pages/page-id',
    layout: '/_/layouts/layout-id',
    componentGroups: [
      '/_/component_groups/cg1',
      '/_/component_groups/cg2'
    ]
  }
  let fetcher: Fetcher

  afterEach(() => {
    vi.clearAllMocks()
  })

  beforeAll(() => {
    fetcher = createFetcher()
    vi.spyOn(fetcher, 'startResourceFetch').mockImplementation((startEvent) => {
      return {
        continueFetching: true,
        startFetchToken: {
          token: 'abc',
          startEvent
        }
      }
    })
    vi.spyOn(fetcher, 'finishResourceFetch').mockImplementation(() => {})
    vi.spyOn(fetcher, 'doFetch').mockImplementation((startFetchEvent) => {
      return startFetchEvent.path
    })
    vi.spyOn(fetcher, 'fetchAndValidateCwaResource').mockImplementation((path) => {
      if (path === '/_/pages/page-id') {
        return Promise.resolve(pageResource)
      }
    })
    vi.spyOn(fetcher, 'fetchNestedResources')
    vi.spyOn(fetcher, 'fetchBatch')
    vi.spyOn(fetcher, 'fetchAndSaveResource')
  })

  test('We populate an array of nested resources and pass this to the fetchBatch function for a specific resource', async () => {
    await fetcher.fetchAndSaveResource({ path: '/_/pages/page-id' })
    expect(fetcher.fetchNestedResources).toBeCalledWith(pageResource)
    expect(fetcher.fetchBatch).toBeCalledWith({
      paths: [
        '/_/layouts/layout-id',
        '/_/component_groups/cg1',
        '/_/component_groups/cg2'
      ]
    })
    expect(fetcher.fetchAndSaveResource).toBeCalledTimes(4)
  })
})

describe('finishResourceFetch functionality', () => {
  let fetcher: Fetcher

  beforeEach(() => {
    fetcher = createFetcher()
    vi.spyOn(fetcher, 'startResourceFetch').mockImplementation((startEvent) => {
      return {
        continueFetching: true,
        startFetchToken: {
          token: 'abc',
          startEvent
        }
      }
    })
    vi.spyOn(fetcher, 'finishResourceFetch')
    vi.spyOn(fetcher, 'doFetch').mockImplementation(() => {})
    vi.spyOn(fetcher, 'fetchAndValidateCwaResource').mockImplementation(() => {
      return Promise.resolve({
        '@id': 'my-resource'
      })
    })
    vi.spyOn(fetcher, 'handleEventFetchError')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('We set the resource state to successful', async () => {
    FetchStatus.mock.results[0].value.finishFetch.mockImplementation(() => {
      return Promise.resolve(true)
    })

    await fetcher.fetchAndSaveResource({ path: 'my-resource' })
    expect(fetcher.finishResourceFetch).toBeCalledWith({
      fetchSuccess: true,
      path: 'my-resource',
      token: 'abc'
    })
    expect(FetchStatus.mock.results[0].value.finishFetch).toHaveBeenCalledWith({
      token: 'abc',
      pageIri: undefined,
      fetchSuccess: true
    })
    expect(Mercure.mock.results[0].value.init).toHaveBeenCalledTimes(1)

    const setResourceFetchStatusMock = ResourcesStore.mock.results[0].value.useStore.mock.results[0].value.setResourceFetchStatus
    expect(setResourceFetchStatusMock).toBeCalledWith({
      iri: 'my-resource',
      status: 1
    })
  })

  test('We set the resource state to failure', async () => {
    vi.spyOn(fetcher, 'fetchAndValidateCwaResource').mockImplementationOnce(() => {
      throw new InvalidResourceResponse('The response provided by the API is not a valid CWA Resource')
    })
    FetchStatus.mock.results[0].value.finishFetch.mockImplementation(() => {
      return Promise.resolve(true)
    })

    await fetcher.fetchAndSaveResource({ path: 'my-resource' })
    expect(fetcher.finishResourceFetch).toBeCalledWith({
      fetchSuccess: false,
      path: 'my-resource',
      token: 'abc',
      fetchError: undefined
    })
    expect(FetchStatus.mock.results[0].value.finishFetch).toHaveBeenCalledWith({
      token: 'abc',
      pageIri: undefined,
      fetchSuccess: false
    })
    expect(Mercure.mock.results[0].value.init).toHaveBeenCalledTimes(1)

    const setResourceFetchStatusMock = ResourcesStore.mock.results[0].value.useStore.mock.results[0].value.setResourceFetchError

    expect(setResourceFetchStatusMock).toBeCalledWith({
      iri: 'my-resource',
      fetchError: undefined
    })
  })

  test('We set the resource state to failure with a fetch error', async () => {
    const mockFetchError = new FetchError()
    mockFetchError.statusCode = 101
    mockFetchError.response = 'a response'
    mockFetchError.message = 'error message'
    vi.spyOn(fetcher, 'doFetch').mockImplementationOnce(() => {
      throw mockFetchError
    })

    await fetcher.fetchAndSaveResource({ path: 'my-resource' })
    expect(fetcher.finishResourceFetch).toBeCalledWith({
      fetchSuccess: false,
      path: 'my-resource',
      token: 'abc',
      fetchError: mockFetchError
    })
    const setResourceFetchStatusMock = ResourcesStore.mock.results[0].value.useStore.mock.results[0].value.setResourceFetchError
    expect(setResourceFetchStatusMock).toBeCalledWith({
      iri: 'my-resource',
      fetchError: mockFetchError
    })

    expect(fetcher.handleEventFetchError).toBeCalledWith(mockFetchError)
    expect(consola.error).toHaveBeenCalledTimes(1)
    expect(consola.error).toHaveBeenCalledWith('error message')
  })

  test('Handle event error outputs if there is no response', async () => {
    const mockFetchError = new FetchError()
    mockFetchError.statusCode = 101
    mockFetchError.message = 'error message'
    vi.spyOn(fetcher, 'doFetch').mockImplementationOnce(() => {
      throw mockFetchError
    })

    await fetcher.fetchAndSaveResource({ path: 'my-resource' })
    expect(fetcher.handleEventFetchError).toBeCalledWith(mockFetchError)
    expect(consola.error).toHaveBeenCalledTimes(2)
    expect(consola.error).toHaveBeenCalledWith('error message')
    expect(consola.error).toHaveBeenCalledWith('[NETWORK ERROR]')
  })

  test('Handle event error does not log 404 errors', async () => {
    const mockFetchError = new FetchError('error message')
    mockFetchError.statusCode = 404
    mockFetchError.response = 'a response'
    vi.spyOn(fetcher, 'doFetch').mockImplementationOnce(() => {
      throw mockFetchError
    })

    await fetcher.fetchAndSaveResource({ path: 'my-resource' })
    expect(fetcher.handleEventFetchError).toBeCalledWith(mockFetchError)
    expect(consola.error).not.toHaveBeenCalled()
  })

  test('If all fetches are not finished we do not initialise mercure', async () => {
    FetchStatus.mock.results[0].value.finishFetch.mockImplementationOnce(() => {
      return Promise.resolve(false)
    })

    await fetcher.fetchAndSaveResource({ path: 'my-resource' })
    expect(fetcher.finishResourceFetch).toBeCalledWith({
      fetchSuccess: true,
      path: 'my-resource',
      token: 'abc'
    })

    expect(Mercure.mock.results[0].value.init).not.toHaveBeenCalled()

    const setResourceFetchStatusMock = ResourcesStore.mock.results[0].value.useStore.mock.results[0].value.setResourceFetchStatus
    expect(setResourceFetchStatusMock).toBeCalledWith({
      iri: 'my-resource',
      status: 1
    })
  })
})

describe('fetchRoute functionality, mocking all calls as they are re-used processes from other tests, just ensure functions are all called', () => {
  let fetcher: Fetcher

  beforeEach(() => {
    fetcher = createFetcher()
    vi.spyOn(fetcher, 'startResourceFetch').mockImplementation((startEvent) => {
      return {
        continueFetching: true,
        startFetchToken: {
          token: 'abc',
          startEvent
        }
      }
    })
    vi.spyOn(fetcher, 'fetchAndSaveResource').mockImplementation(() => {
      return Promise.resolve({
        '@id': 'my-resource',
        pageData: 'page-data-iri'
      })
    })
    vi.spyOn(fetcher, 'finishResourceFetch')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('We start and finish resource fetch with page data parameter', async () => {
    const result = await fetcher.fetchRoute('path')
    expect(fetcher.startResourceFetch).toHaveBeenCalledWith({
      path: '/_/routes/path',
      resetCurrentResources: true,
      manifestPath: '/_/routes_manifest/path'
    })
    expect(fetcher.fetchAndSaveResource).toHaveBeenCalledWith({
      path: '/_/routes/path'
    })
    expect(fetcher.finishResourceFetch).toHaveBeenCalledWith({
      token: 'abc',
      path: '/_/routes/path',
      fetchSuccess: true,
      pageIri: 'page-data-iri'
    })
    expect(result).toStrictEqual({
      '@id': 'my-resource',
      pageData: 'page-data-iri'
    })
  })

  test('We start and finish resource fetch with page parameter', async () => {
    vi.spyOn(fetcher, 'fetchAndSaveResource').mockImplementationOnce(() => {
      return Promise.resolve({
        '@id': 'my-resource',
        page: 'page-iri'
      })
    })
    const result = await fetcher.fetchRoute('path')
    expect(fetcher.finishResourceFetch).toHaveBeenCalledWith({
      token: 'abc',
      path: '/_/routes/path',
      fetchSuccess: true,
      pageIri: 'page-iri'
    })
    expect(result).toStrictEqual({
      '@id': 'my-resource',
      page: 'page-iri'
    })
  })

  test('We start and finish resource fetch with no resource returned', async () => {
    vi.spyOn(fetcher, 'fetchAndSaveResource').mockImplementationOnce(() => {
      return Promise.resolve(undefined)
    })
    const result = await fetcher.fetchRoute('path')
    expect(fetcher.finishResourceFetch).toHaveBeenCalledWith({
      token: 'abc',
      path: '/_/routes/path',
      fetchSuccess: false
    })
    expect(result).toBeUndefined()
  })

  test('If startFetchStatusResponse.continueFetching is false we return the result of an existing promise (promise or undefined)', async () => {
    vi.spyOn(fetcher, 'startResourceFetch').mockImplementation((startEvent) => {
      return {
        continueFetching: false,
        startFetchToken: {
          token: 'abc',
          startEvent,
          existingFetchPromise: 'existing-fetch-promise'
        }
      }
    })

    const result = await fetcher.fetchRoute('path')
    expect(fetcher.fetchAndSaveResource).not.toHaveBeenCalled()
    expect(fetcher.finishResourceFetch).not.toHaveBeenCalled()
    expect(result).toBe('existing-fetch-promise')
  })
})
