import { describe, vi, afterEach, test, expect, beforeEach } from 'vitest'
import { FetchError } from 'ofetch'
import { flushPromises } from '@vue/test-utils'
import * as vueRouter from 'vue-router'
import { FinishFetchManifestType } from '../../storage/stores/fetcher/actions'
import { FetcherStore } from '../../storage/stores/fetcher/fetcher-store'
import Mercure from '../mercure'
import ApiDocumentation from '../api-documentation'
import { ResourcesStore } from '../../storage/stores/resources/resources-store'
import { type CwaResource, CwaResourceTypes } from '../../resources/resource-utils'
import { createCwaResourceError } from '../../errors/cwa-resource-error'
import Fetcher from './fetcher'
import CwaFetch from './cwa-fetch'
import FetchStatusManager from './fetch-status-manager'
import preloadHeaders from './preload-headers'

vi.mock('./cwa-fetch', () => {
  return {
    default: vi.fn(() => ({
      fetch: {
        raw: vi.fn(),
      },
    })),
  }
})
vi.mock('../../storage/stores/fetcher/fetcher-store')
vi.mock('../../storage/stores/resources/resources-store', () => {
  return {
    ResourcesStore: vi.fn(() => ({
      useStore: vi.fn(() => {}),
    })),
  }
})
vi.mock('./fetch-status-manager')
vi.mock('../mercure')
vi.mock('../api-documentation')
vi.mock('vue-router', () => {
  return {
    currentRoute: vi.fn(() => {}),
  }
})

function delay(time: number, returnValue: any = undefined) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(returnValue)
    }, time)
  })
}

function createFetcher(query?: { [key: string]: string }): Fetcher {
  const cwaFetch = new CwaFetch('https://api-url')
  const resourcesStore = new ResourcesStore()
  const statusManager = new FetchStatusManager(new FetcherStore(), new Mercure(), new ApiDocumentation(), resourcesStore)

  vi.spyOn(vueRouter, 'currentRoute', 'get').mockImplementation(() => ({ value: { path: '/current-path', query } }))

  return new Fetcher(cwaFetch, statusManager, vueRouter, resourcesStore)
}

const validCwaResource = {
  '@id': 'resource-id',
  '@type': 'MyType',
  '_metadata': {
    persisted: true,
  },
}

describe('Fetcher -> fetchRoute', () => {
  let fetcher: Fetcher
  beforeEach(() => {
    fetcher = createFetcher()
    vi.spyOn(fetcher, 'fetchResource').mockImplementation(() => (Promise.resolve(validCwaResource)))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test.each([
    {
      path: '/some-route', apiPath: '/_/routes//some-route', manifestPath: '/_/routes_manifest//some-route',
    },
    {
      path: '/page_data/abcdefg', apiPath: '/page_data/abcdefg', manifestPath: undefined,
    },
    {
      path: '/_/pages/abcdefg', apiPath: '/_/pages/abcdefg', manifestPath: undefined,
    },
  ])('If fetchRoute is called with the path $1', async ({ path, apiPath, manifestPath }) => {
    const result = await fetcher.fetchRoute({
      path,
      params: {
        cwaPage0: path,
      },
      matched: [],
      fullPath: '',
      query: {},
      hash: '',
      name: '',
      meta: {},
      redirectedFrom: undefined,
    })

    expect(fetcher.fetchResource).toHaveBeenCalledWith({ path: apiPath, isPrimary: true, manifestPath })
    expect(result).toStrictEqual(validCwaResource)
  })

  test('should NOT fetch resource IF route meta cwa is false', async () => {
    const fetchResourceSpy = vi.spyOn(fetcher, 'fetchResource')

    // @ts-expect-error
    await fetcher.fetchRoute({ meta: { cwa: { disabled: true } } })

    expect(fetchResourceSpy).not.toHaveBeenCalled()
  })
})

describe('Fetcher -> fetchResource', () => {
  let fetcher: Fetcher

  beforeEach(() => {
    fetcher = createFetcher()
    FetchStatusManager.mock.instances[0].startFetch.mockImplementation((obj) => {
      return {
        continue: true,
        token: obj.token || 'new-token',
      }
    })
    vi.spyOn(fetcher, 'fetchManifest').mockImplementation(() => {
      return Promise.resolve()
    })
    vi.spyOn(fetcher, 'fetch').mockImplementation(() => {
      const response = Promise.resolve({
        '@id': '/some-resource',
      })
      return {
        response,
        headers: {
          path: 'my-path',
        },
      }
    })
    FetchStatusManager.mock.instances[0].startFetchResource.mockImplementation(() => true)
    FetchStatusManager.mock.instances[0].abortFetch.mockImplementation(() => {})
    FetchStatusManager.mock.instances[0].getFetchedCurrentResource.mockImplementation((iri: string, timeout?: number) => `Mocked getFetchedCurrentResource Result ${iri} ${timeout}`)
    vi.spyOn(FetchStatusManager.mock.instances[0], 'primaryFetchPath', 'get').mockReturnValue('/primary-fetch-path')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('Start fetch is called and if returns false we stop calling functions', async () => {
    FetchStatusManager.mock.instances[0].startFetch.mockImplementationOnce(() => {
      return {
        continue: false,
      }
    })
    const fetchResourceEvent = {
      path: '/new-path',
      token: 'any',
    }
    const result = await fetcher.fetchResource(fetchResourceEvent)
    expect(FetchStatusManager.mock.instances[0].startFetch).toHaveBeenCalledWith(fetchResourceEvent)
    expect(FetchStatusManager.mock.instances[0].getFetchedCurrentResource).toHaveBeenCalledWith('/new-path')
    expect(fetcher.fetchManifest).not.toHaveBeenCalled()
    expect(FetchStatusManager.mock.instances[0].startFetchResource).not.toHaveBeenCalled()
    expect(result).toBe(FetchStatusManager.mock.instances[0].getFetchedCurrentResource.mock.results[0].value)
  })

  test('startFetchResource (without preload) and fetchManifest are called if startFetch returns continue as true', async () => {
    const fetchResourceEvent = {
      path: '/new-path',
      token: 'any',
      manifestPath: '/my-manifest',
    }
    const result = await fetcher.fetchResource(fetchResourceEvent)

    expect(fetcher.fetchManifest).toHaveBeenCalledWith({
      manifestPath: '/my-manifest',
      token: 'any',
    })
    expect(fetcher.fetchManifest.mock.invocationCallOrder[0]).toBeGreaterThan(FetchStatusManager.mock.instances[0].startFetch.mock.invocationCallOrder[0])

    expect(FetchStatusManager.mock.instances[0].startFetchResource).toHaveBeenCalledWith({
      path: '/new-path',
      resource: fetchResourceEvent.path,
      token: fetchResourceEvent.token,
    })
    expect(FetchStatusManager.mock.instances[0].startFetchResource.mock.invocationCallOrder[0]).toBeGreaterThan(fetcher.fetchManifest.mock.invocationCallOrder[0])

    expect(fetcher.fetch).toHaveBeenCalledWith({
      path: '/new-path',
      preload: undefined,
    })
    expect(fetcher.fetch.mock.invocationCallOrder[0]).toBeGreaterThan(FetchStatusManager.mock.instances[0].startFetchResource.mock.invocationCallOrder[0])

    expect(result).toBeUndefined()
  })

  test('If startFetchResource returns false, do not call the fetch function', async () => {
    FetchStatusManager.mock.instances[0].startFetchResource.mockImplementationOnce(() => false)
    const fetchResourceEvent = {
      path: '/new-path',
      token: 'any',
      manifestPath: '/my-manifest',
    }
    const result = await fetcher.fetchResource(fetchResourceEvent)
    expect(FetchStatusManager.mock.instances[0].getFetchedCurrentResource).toHaveBeenCalledWith('/new-path')
    expect(fetcher.fetch).not.toHaveBeenCalled()
    expect(result).toBe(FetchStatusManager.mock.instances[0].getFetchedCurrentResource.mock.results[0].value)
  })

  test.each([
    { errorMessage: 'fetch error message', statusCode: 101 },
    { errorMessage: undefined, statusCode: undefined },
  ])('If an error is generated with the message $errorMessage and status $statusCode then the resulting message should contain the message $expectedErrorMessage and the same status code', async ({ errorMessage, statusCode }) => {
    const fetchResourceEvent = {
      path: '/new-path',
      token: 'any',
    }

    let error: FetchError
    fetcher.fetch.mockImplementation(() => {
      error = new FetchError('Some error message')
      error.message = errorMessage
      error.statusCode = statusCode
      throw error
    })

    const result = await fetcher.fetchResource(fetchResourceEvent)

    expect(fetcher.fetchManifest).not.toHaveBeenCalled()

    expect(FetchStatusManager.mock.instances[0].finishFetchResource).toHaveBeenCalledWith({
      path: '/new-path',
      resource: fetchResourceEvent.path,
      token: fetchResourceEvent.token,
      success: false,
      error: createCwaResourceError(error),
    })
    expect(FetchStatusManager.mock.instances[0].finishFetchResource.mock.invocationCallOrder[0]).toBeGreaterThan(fetcher.fetch.mock.invocationCallOrder[0])
    expect(result).toBeUndefined()
  })

  test('finishFetchResource after fetch (with preload) is called if startFetch returns continue as true', async () => {
    vi.spyOn(fetcher, 'fetchNestedResources').mockImplementation(() => {})
    FetchStatusManager.mock.instances[0].finishFetchResource.mockImplementationOnce(() => ({ some: 'resource' }))
    const fetchResourceEvent = {
      path: '/new-path',
      token: 'any',
      preload: ['/something'],
    }
    const result = await fetcher.fetchResource(fetchResourceEvent)

    expect(fetcher.fetchManifest).not.toHaveBeenCalled()
    expect(fetcher.fetch).toHaveBeenCalledWith({
      path: '/new-path',
      preload: ['/something'],
    })
    expect(fetcher.fetch.mock.invocationCallOrder[0]).toBeGreaterThan(FetchStatusManager.mock.instances[0].startFetchResource.mock.invocationCallOrder[0])
    expect(FetchStatusManager.mock.instances[0].finishFetchResource).toHaveBeenCalledWith({
      resource: fetchResourceEvent.path,
      token: fetchResourceEvent.token,
      success: true,
      headers: {
        path: 'my-path',
      },
      noSave: undefined,
      path: '/new-path',
      fetchResponse: {
        '@id': '/some-resource',
      },
    })
    expect(FetchStatusManager.mock.instances[0].finishFetchResource.mock.invocationCallOrder[0]).toBeGreaterThan(fetcher.fetch.mock.invocationCallOrder[0])

    expect(fetcher.fetchNestedResources).toBeCalledWith({ resource: { some: 'resource' }, token: 'any', noSave: false, onlyIfNoExist: false })
    expect(fetcher.fetchNestedResources.mock.invocationCallOrder[0]).toBeGreaterThan(FetchStatusManager.mock.instances[0].finishFetchResource.mock.invocationCallOrder[0])
    expect(result).toStrictEqual({ some: 'resource' })
  })

  test('finish fetch is not called if a previous token is provided', async () => {
    const fetchResourceEvent = {
      path: '/new-path',
      token: 'any',
    }
    const result = await fetcher.fetchResource(fetchResourceEvent)
    expect(FetchStatusManager.mock.instances[0].finishFetch).not.toHaveBeenCalled()
    expect(result).toBeUndefined()
  })

  test('finish fetch is called if no previous token is provided', async () => {
    vi.spyOn(fetcher, 'fetchNestedResources').mockImplementation(() => {})
    FetchStatusManager.mock.instances[0].finishFetchResource.mockImplementationOnce(() => ({ some: 'resource' }))

    let finishResolved = false
    FetchStatusManager.mock.instances[0].finishFetch.mockImplementationOnce(() => {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          finishResolved = true
          resolve()
        }, 1)
      })
    })

    const fetchResourceEvent = {
      path: '/new-path',
    }
    const result = await fetcher.fetchResource(fetchResourceEvent)

    expect(FetchStatusManager.mock.instances[0].finishFetch).toHaveBeenCalledWith({
      token: 'new-token',
    })
    expect(FetchStatusManager.mock.instances[0].finishFetch.mock.invocationCallOrder[0]).toBeGreaterThan(fetcher.fetchNestedResources.mock.invocationCallOrder[0])

    expect(result).toStrictEqual({ some: 'resource' })
    expect(finishResolved).toBe(true)
  })

  test('fetch status manager finishFetchResource is called with noSave', async () => {
    vi.spyOn(fetcher, 'fetchNestedResources').mockImplementation(() => {})
    FetchStatusManager.mock.instances[0].finishFetchResource.mockImplementationOnce(() => ({ some: 'resource' }))
    const fetchResourceEvent = {
      path: '/new-path',
      noSave: true,
      token: 'token',
    }
    await fetcher.fetchResource(fetchResourceEvent)
    expect(FetchStatusManager.mock.instances[0].finishFetchResource).toHaveBeenCalledWith({
      resource: fetchResourceEvent.path,
      token: fetchResourceEvent.token,
      noSave: fetchResourceEvent.noSave,
      path: '/new-path',
      success: true,
      headers: {
        path: 'my-path',
      },
      fetchResponse: {
        '@id': '/some-resource',
      },
    })
    expect(fetcher.fetchNestedResources).toBeCalledWith({ resource: { some: 'resource' }, token: 'token', noSave: true, onlyIfNoExist: false })
  })

  test('if shallowFetch is passed, nested resources should not be fetched', async () => {
    vi.spyOn(fetcher, 'fetchNestedResources').mockImplementation(() => {})
    FetchStatusManager.mock.instances[0].finishFetchResource.mockImplementationOnce(() => ({ some: 'resource' }))
    const fetchResourceEvent = {
      path: '/new-path',
      shallowFetch: true,
      token: 'token',
    }
    await fetcher.fetchResource(fetchResourceEvent)
    expect(fetcher.fetchNestedResources).not.toHaveBeenCalled()
  })

  test('if the primary response is a redirect, nested fetches should not occur and the fetch should be aborted', async () => {
    vi.spyOn(FetchStatusManager.mock.instances[0], 'primaryFetchPath', 'get').mockReturnValue('/_/routes//path')
    vi.spyOn(fetcher, 'fetchNestedResources').mockImplementation(() => {})
    FetchStatusManager.mock.instances[0].finishFetchResource.mockImplementationOnce(() => ({ '@id': '/_/routes//path', 'redirectPath': '/my-redirect' }))
    const fetchResourceEvent = {
      path: '/_/routes//path',
      token: 'token',
    }
    await fetcher.fetchResource(fetchResourceEvent)
    expect(fetcher.fetchNestedResources).not.toHaveBeenCalled()
    expect(FetchStatusManager.mock.instances[0].abortFetch).toBeCalledTimes(1)
    expect(FetchStatusManager.mock.instances[0].abortFetch).toBeCalledWith('token')
  })
})

describe('Fetcher -> fetchManifest', () => {
  let fetcher: Fetcher

  beforeEach(() => {
    fetcher = createFetcher()
    vi.spyOn(fetcher, 'fetch').mockImplementation(() => {
      return Promise.resolve()
    })
    vi.spyOn(fetcher, 'fetchBatch').mockImplementation(() => Promise.resolve())
    FetchStatusManager.mock.instances[0].startFetch.mockImplementation((startEvent) => {
      return {
        continue: true,
        token: startEvent.token,
      }
    })
    FetchStatusManager.mock.instances[0].startFetchResource.mockImplementation(() => {})
    FetchStatusManager.mock.instances[0].finishFetchResource.mockImplementation(() => {})
    FetchStatusManager.mock.instances[0].finishFetch.mockImplementation(() => {})
    FetchStatusManager.mock.instances[0].isCurrentFetchingToken.mockImplementation(() => true)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test
    .each([
      { resourceIris: undefined },
      { resourceIris: [] },
    ])('fetchBatch should not be called if we have not received any IRIs', async ({ resourceIris }) => {
      vi.spyOn(fetcher, 'fetch').mockImplementation((event) => {
        if (event.path !== '/my-manifest') {
          return Promise.resolve()
        }
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              _data: {
                resource_iris: resourceIris,
              },
            })
          }, 1)
        })
      })
      const fetchResourceEvent = {
        path: '/new-path',
        token: 'any',
        manifestPath: '/my-manifest',
      }
      await fetcher.fetchResource(fetchResourceEvent)
      expect(fetcher.fetchBatch).not.toHaveBeenCalled()
      await flushPromises()
      expect(fetcher.fetchBatch).not.toHaveBeenCalled()
    })

  test('fetchBatch should be called before finishing the manifest state', async () => {
    vi.spyOn(fetcher, 'fetch').mockImplementation((event) => {
      if (event.path !== '/my-manifest') {
        return Promise.resolve()
      }
      const responsePromise = new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            _data: {
              resource_iris: ['/resolve-resource'],
            },
          })
        }, 1)
      })
      return {
        response: responsePromise,
      }
    })
    const fetchResourceEvent = {
      path: '/new-path',
      token: 'any',
      manifestPath: '/my-manifest',
    }

    await fetcher.fetchResource(fetchResourceEvent)
    expect(FetchStatusManager.mock.instances[0].isCurrentFetchingToken).not.toHaveBeenCalled()
    expect(fetcher.fetchBatch).not.toHaveBeenCalled()
    await delay(2)
    expect(FetchStatusManager.mock.instances[0].isCurrentFetchingToken).toHaveBeenCalledWith('any')
    expect(fetcher.fetchBatch).toHaveBeenCalledTimes(1)
    expect(fetcher.fetchBatch).toHaveBeenCalledWith({ paths: ['/resolve-resource'], token: 'any' })
    expect(FetchStatusManager.mock.instances[0].finishManifestFetch.mock.invocationCallOrder[0]).greaterThan(fetcher.fetchBatch.mock.invocationCallOrder[0])
  })

  test('We finish the manifest status when completed', async () => {
    vi.spyOn(fetcher, 'fetch').mockImplementation((event) => {
      if (event.path !== '/my-manifest') {
        return Promise.resolve()
      }
      const response = new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            _data: {
              resource_iris: ['/manifest-resource-iri'],
            },
          })
        }, 1)
      })
      return {
        response,
      }
    })

    const fetchResourceEvent = {
      path: '/new-path',
      token: 'any',
      manifestPath: '/my-manifest',
    }
    await fetcher.fetchResource(fetchResourceEvent)
    await delay(2)
    expect(FetchStatusManager.mock.instances[0].finishManifestFetch).toHaveBeenCalledWith({
      resources: ['/manifest-resource-iri'],
      token: 'any',
      type: FinishFetchManifestType.SUCCESS,
    })
  })

  test.each([
    { errorMessage: 'fetch error message', statusCode: 101 },
    { errorMessage: undefined, statusCode: undefined },
  ])('If an error is generated with the message $errorMessage and status $statusCode then the resulting message should contain the message $expectedErrorMessage and the same status code', async ({ errorMessage, statusCode }) => {
    let error: FetchError
    vi.spyOn(fetcher, 'fetch').mockImplementation((event) => {
      if (event.path !== '/my-manifest') {
        return Promise.resolve()
      }
      error = new FetchError('Some error message')
      error.message = errorMessage
      error.statusCode = statusCode
      throw error
    })

    const fetchResourceEvent = {
      path: '/new-path',
      token: 'any',
      manifestPath: '/my-manifest',
    }
    await fetcher.fetchResource(fetchResourceEvent)
    expect(FetchStatusManager.mock.instances[0].finishManifestFetch).toHaveBeenCalledTimes(1)
    expect(FetchStatusManager.mock.instances[0].finishManifestFetch).toHaveBeenCalledWith({
      token: 'any',
      type: FinishFetchManifestType.ERROR,
      error: createCwaResourceError(error),
    })
  })
})

describe('Fetcher -> fetch', () => {
  let fetcher: Fetcher

  beforeEach(() => {
    fetcher = createFetcher()
    FetchStatusManager.mock.instances[0].startFetch.mockImplementation(() => {
      return {
        continue: true,
      }
    })
    FetchStatusManager.mock.instances[0].startFetchResource.mockImplementation(() => true)
    FetchStatusManager.mock.instances[0].finishFetchResource.mockImplementation(() => {})
    FetchStatusManager.mock.instances[0].finishFetch.mockImplementation(() => {})
    vi.spyOn(fetcher, 'createRequestHeaders').mockImplementation(() => ({ someHeader: 'someValue' }))
    vi.spyOn(FetchStatusManager.mock.instances[0], 'primaryFetchPath', 'get').mockReturnValue('/primary-fetch-path')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('The path has query parameters appended to the fetch url', async () => {
    vi.spyOn(fetcher, 'appendQueryToPath').mockImplementation((path: string): string => {
      return `${path}?query=value`
    })
    const fetchResourceEvent = {
      path: '/mock-path',
      token: 'any',
    }
    await fetcher.fetchResource(fetchResourceEvent)
    expect(CwaFetch.mock.results[0].value.fetch.raw.mock.calls[0][0]).toBe('/mock-path?query=value')
    expect(CwaFetch.mock.results[0].value.fetch.raw.mock.calls[0][1]).toStrictEqual({ headers: { someHeader: 'someValue' } })
    expect(CwaFetch.mock.results[0].value.fetch.raw.mock.invocationCallOrder[0]).toBeGreaterThan(fetcher.appendQueryToPath.mock.invocationCallOrder[0])
  })
})

describe('Fetcher -> appendQueryToPath', () => {
  let fetcher: Fetcher

  function setupMocks(fetcher: Fetcher) {
    vi.spyOn(fetcher, 'createRequestHeaders').mockImplementation(() => ({}))
    FetchStatusManager.mock.instances[0].startFetch.mockImplementation(() => {
      return {
        continue: true,
      }
    })
    FetchStatusManager.mock.instances[0].startFetchResource.mockImplementation(() => true)
    FetchStatusManager.mock.instances[0].finishFetchResource.mockImplementation(() => {})
    FetchStatusManager.mock.instances[0].finishFetch.mockImplementation(() => {})
    CwaFetch.mock.results[0].value.fetch.raw.mockImplementation(() => {})
    vi.spyOn(fetcher, 'appendQueryToPath')
    vi.spyOn(FetchStatusManager.mock.instances[0], 'primaryFetchPath', 'get').mockReturnValue('/primary-fetch-path')
  }

  afterEach(() => {
    vi.clearAllMocks()
  })

  test
    .each([
      { query: { something: 1 }, path: '/mock-path', result: '/mock-path?something=1' },
      { query: { something: 1 }, path: '/mock-path?existing=1', result: '/mock-path?existing=1&something=1' },
      { query: undefined, path: '/mock-path', result: '/mock-path' },
      { query: {}, path: '/mock-path', result: '/mock-path' },
    ])('If query parameters are \'$query\' and the fetch path is $path we should call a fetch to the url $result', async ({
      query,
      path,
      result,
    }) => {
      fetcher = createFetcher(query)
      setupMocks(fetcher)
      const fetchResourceEvent = {
        path,
        token: 'any',
      }
      await fetcher.fetchResource(fetchResourceEvent)
      expect(fetcher.appendQueryToPath).toReturnWith(result)
    })
})

describe('Fetcher -> createRequestHeaders', () => {
  let fetcher: Fetcher

  beforeEach(() => {
    fetcher = createFetcher()
    vi.spyOn(fetcher, 'appendQueryToPath').mockImplementation(() => {})
    FetchStatusManager.mock.instances[0].startFetch.mockImplementation(() => {
      return {
        continue: true,
      }
    })
    FetchStatusManager.mock.instances[0].startFetchResource.mockImplementation(() => true)
    FetchStatusManager.mock.instances[0].finishFetchResource.mockImplementation(() => {})
    FetchStatusManager.mock.instances[0].finishFetch.mockImplementation(() => {})
    vi.spyOn(FetchStatusManager.mock.instances[0], 'primaryFetchPath', 'get').mockReturnValue('/primary-fetch-path')
    vi.spyOn(fetcher, 'createRequestHeaders')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test
    .each([
      { preload: undefined, path: '/some-path', headers: { path: '/primary-fetch-path', preload: undefined } },
      { preload: ['/preload'], path: '/some-path', headers: { path: '/primary-fetch-path', preload: '/preload' } },
      { preload: undefined, path: '/_/routes//', headers: { path: '/primary-fetch-path', preload: preloadHeaders[CwaResourceTypes.ROUTE].join(',') } },
    ])('If I create headers passing preload as \'$preload\' and path as $path the headers should be $headers', async ({
      preload,
      path,
      headers,
    }) => {
      // FetchStatusManager.mock.results[0].value.primaryFetchPath.mockImplementation(() => 'anything')
      const fetchResourceEvent = {
        path,
        preload,
      }
      await fetcher.fetchResource(fetchResourceEvent)
      expect(fetcher.createRequestHeaders).toReturnWith(headers)
    })
})

describe('Fetcher -> fetchNestedResources', () => {
  let fetcher: Fetcher

  beforeEach(() => {
    fetcher = createFetcher()
    FetchStatusManager.mock.instances[0].startFetch.mockImplementation((obj) => {
      return {
        continue: true,
        token: obj.token || 'new-token',
      }
    })
    vi.spyOn(fetcher, 'fetchManifest').mockImplementation(() => {
      return Promise.resolve()
    })
    vi.spyOn(fetcher, 'fetch').mockImplementation(() => {
      return Promise.resolve()
    })
    FetchStatusManager.mock.instances[0].startFetchResource.mockImplementation(() => true)
    vi.spyOn(fetcher, 'fetchBatch').mockImplementation(() => {})
    vi.spyOn(FetchStatusManager.mock.instances[0], 'primaryFetchPath', 'get').mockReturnValue('/primary-fetch-path')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('If we cannot get a resources type, do not fetch any nested resources', async () => {
    const mockResource: CwaResource = {
      '@id': '/unknown-resource',
      '@type': 'Resource',
      '_metadata': {
        persisted: true,
      },
      'layout': '/_/layouts/layout-resource',
      'componentGroups': ['/_/component_groups/component-group-1', '/_/component_groups/component-group-2'],
    }
    FetchStatusManager.mock.instances[0].finishFetchResource.mockImplementationOnce(() => (mockResource))

    const fetchResourceEvent = {
      path: '/new-path',
      token: 'any',
      preload: ['/something'],
    }
    await fetcher.fetchResource(fetchResourceEvent)

    expect(fetcher.fetchBatch).not.toHaveBeenCalled()
  })

  test('We can call and return the fetch batch function results, also with the token, if the returned resource has properties either as an array or a string of nested resources', async () => {
    const mockResource: CwaResource = {
      '@id': '/_/pages/page-id',
      '@type': 'Resource',
      '_metadata': {
        persisted: true,
      },
      'layout': '/_/layouts/layout-resource',
      'componentGroups': ['/_/component_groups/component-group-1', '/_/component_groups/component-group-2'],
    }
    FetchStatusManager.mock.instances[0].finishFetchResource.mockImplementationOnce(() => (mockResource))
    const fetchResourceEvent = {
      path: '/new-path',
      token: 'any',
      preload: ['/something'],
    }
    await fetcher.fetchResource(fetchResourceEvent)

    expect(fetcher.fetchBatch).toHaveBeenCalledTimes(1)
    expect(fetcher.fetchBatch).toHaveBeenCalledWith({
      noSave: false,
      paths: ['/_/layouts/layout-resource',
        '/_/component_groups/component-group-1',
        '/_/component_groups/component-group-2',
      ],
      token: 'any',
    })
  })

  test('If the resource property does not exist, we do continue and do not add anything to the nested resources', async () => {
    const mockResource: CwaResource = {
      '@id': '/_/pages/page-id',
      '@type': 'Resource',
      '_metadata': {
        persisted: true,
      },
      'layout': '/_/layouts/layout-resource',
      // componentGroups has been removed here for the test
    }
    FetchStatusManager.mock.instances[0].finishFetchResource.mockImplementationOnce(() => (mockResource))
    const fetchResourceEvent = {
      path: '/new-path',
      token: 'any',
      preload: ['/something'],
    }
    await fetcher.fetchResource(fetchResourceEvent)

    expect(fetcher.fetchBatch).toHaveBeenCalledTimes(1)
    expect(fetcher.fetchBatch).toHaveBeenCalledWith({
      noSave: false,
      paths: ['/_/layouts/layout-resource'],
      token: 'any',
    })
  })
})

describe('Fetcher -> fetchBatch', () => {
  let fetcher: Fetcher

  beforeEach(() => {
    fetcher = createFetcher()
    vi.spyOn(fetcher, 'fetch').mockImplementation(() => {
      return Promise.resolve()
    })
    FetchStatusManager.mock.instances[0].startFetch.mockImplementation((startEvent) => {
      return {
        continue: true,
        token: startEvent.token,
      }
    })

    FetchStatusManager.mock.instances[0].startFetchResource.mockImplementation(() => false)
    FetchStatusManager.mock.instances[0].getFetchedCurrentResource.mockImplementation(path => ({ path }))
    FetchStatusManager.mock.instances[0].finishFetchResource.mockImplementation(() => {})
    FetchStatusManager.mock.instances[0].finishFetch.mockImplementation(() => {})
    FetchStatusManager.mock.instances[0].isCurrentFetchingToken.mockImplementation(() => true)
    vi.spyOn(fetcher, 'fetch').mockImplementation((event) => {
      if (event.path !== '/my-manifest') {
        return Promise.resolve()
      }
      const response = new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            _data: {
              resource_iris: ['/resolve-resource', '/resolve-another-resource'],
            },
          })
        }, 1)
      })
      return {
        response,
      }
    })
    vi.spyOn(fetcher, 'fetchBatch')
    vi.spyOn(fetcher, 'fetchResource')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('fetchBatch should return the promise all with the results', async () => {
    const fetchResourceEvent = {
      path: '/new-path',
      token: 'any',
      manifestPath: '/my-manifest',
    }
    await fetcher.fetchResource(fetchResourceEvent)
    fetcher.fetchResource.mockClear()
    expect(fetcher.fetchBatch).not.toHaveBeenCalled()

    await delay(2)
    expect(fetcher.fetchBatch).toHaveBeenCalledTimes(1)
    expect(fetcher.fetchBatch).toHaveBeenCalledWith({ paths: ['/resolve-resource', '/resolve-another-resource'], token: 'any' })
    expect(fetcher.fetchResource).toHaveBeenCalledWith({
      path: '/resolve-resource',
      token: 'any',
    })
    expect(fetcher.fetchResource).toHaveBeenCalledWith({
      path: '/resolve-another-resource',
      token: 'any',
    })
    expect(fetcher.fetchResource).toHaveBeenCalledTimes(2)

    expect(await fetcher.fetchBatch.mock.results[0].value).toStrictEqual([
      {
        path: '/resolve-resource',
      },
      {
        path: '/resolve-another-resource',
      },
    ])
  })
})
