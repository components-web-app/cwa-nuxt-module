import { describe, vi, afterEach, test, expect, beforeEach } from 'vitest'
import { FetchError } from 'ohmyfetch'
import { FinishFetchManifestType } from '../../storage/stores/fetcher/actions'
import { FetcherStore } from '../../storage/stores/fetcher/fetcher-store'
import Mercure from '../mercure'
import ApiDocumentation from '../api-documentation'
import { ResourcesStore } from '../../storage/stores/resources/resources-store'
import { CwaResourceTypes } from '../../resources/resource-utils'
import { createCwaResourceError } from '../../errors/cwa-resource-error'
import Fetcher from './fetcher'
import CwaFetch from './cwa-fetch'
import FetchStatusManager from './fetch-status-manager'
import preloadHeaders from './preload-headers'

vi.mock('./cwa-fetch', () => {
  return {
    default: vi.fn(() => ({
      fetch: {
        raw: vi.fn()
      }
    }))
  }
})
vi.mock('../../storage/stores/fetcher/fetcher-store')
vi.mock('../../storage/stores/resources/resources-store')
vi.mock('./fetch-status-manager')
vi.mock('../mercure')
vi.mock('../api-documentation')

function delay (time: number, returnValue: any = undefined) {
  return new Promise((resolve) => {
    setTimeout(() => { resolve(returnValue) }, time)
  })
}

function createFetcher (query?: { [key: string]: string }): Fetcher {
  const cwaFetch = new CwaFetch('https://api-url')
  const statusManager = new FetchStatusManager(new FetcherStore(), new Mercure(), new ApiDocumentation(), new ResourcesStore())
  const currentRoute = { path: '/current-path', query }
  return new Fetcher(cwaFetch, statusManager, currentRoute)
}

const validCwaResource = {
  '@id': 'resource-id',
  '@type': 'MyType',
  _metadata: {
    persisted: true
  }
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

  test('Initialises a fetch status. If continue if false, we should abort the fetch.', async () => {
    FetchStatusManager.mock.instances[0].startFetch.mockImplementationOnce(() => {
      return {
        continue: false
      }
    })
    const result = await fetcher.fetchRoute('/some-route')
    expect(FetchStatusManager.mock.instances[0].startFetch).toHaveBeenCalledWith({
      path: '/_/routes//some-route',
      isPrimary: true,
      manifestPath: '/_/routes_manifest//some-route'
    })
    expect(fetcher.fetchResource).not.toHaveBeenCalled()
    expect(result).toBeUndefined()
  })

  test('calls fetchResource with the correct iri. Token produced, should continue', async () => {
    let finishResolved = false
    FetchStatusManager.mock.instances[0].startFetch.mockImplementationOnce(() => {
      return {
        continue: true,
        token: 'some-token'
      }
    })
    FetchStatusManager.mock.instances[0].finishFetch.mockImplementationOnce(() => {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          finishResolved = true
          resolve()
        }, 1)
      })
    })
    fetcher.fetchResource.mockImplementation(() => {
      return {
        '@id': 'something'
      }
    })
    const result = await fetcher.fetchRoute('/some-route')
    expect(fetcher.fetchResource).toHaveBeenCalledWith({ path: '/_/routes//some-route', token: 'some-token', manifestPath: '/_/routes_manifest//some-route' })

    expect(FetchStatusManager.mock.instances[0].startFetch).toHaveBeenCalledTimes(1)
    expect(fetcher.fetchResource.mock.invocationCallOrder[0]).toBeGreaterThan(FetchStatusManager.mock.instances[0].startFetch.mock.invocationCallOrder[0])

    expect(FetchStatusManager.mock.instances[0].finishFetch).toHaveBeenCalledWith({ token: 'some-token' })
    expect(FetchStatusManager.mock.instances[0].finishFetch.mock.invocationCallOrder[0]).toBeGreaterThan(fetcher.fetchResource.mock.invocationCallOrder[0])
    expect(result).toStrictEqual({
      '@id': 'something'
    })
    expect(finishResolved).toBe(true)
  })
})

describe('Fetcher -> fetchResource', () => {
  let fetcher: Fetcher

  beforeEach(() => {
    fetcher = createFetcher()
    FetchStatusManager.mock.instances[0].startFetch.mockImplementation((obj) => {
      return {
        continue: true,
        token: obj.token || 'new-token'
      }
    })
    vi.spyOn(fetcher, 'fetchManifest').mockImplementation(() => {
      return Promise.resolve()
    })
    vi.spyOn(fetcher, 'fetch').mockImplementation(() => {
      return Promise.resolve()
    })
    FetchStatusManager.mock.instances[0].startFetchResource.mockImplementation(() => true)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('Start fetch is called and if returns false we stop calling functions', async () => {
    FetchStatusManager.mock.instances[0].startFetch.mockImplementationOnce(() => {
      return {
        continue: false
      }
    })
    const fetchResourceEvent = {
      path: '/new-path',
      token: 'any'
    }
    const result = await fetcher.fetchResource(fetchResourceEvent)
    expect(FetchStatusManager.mock.instances[0].startFetch).toHaveBeenCalledWith(fetchResourceEvent)
    expect(fetcher.fetchManifest).not.toHaveBeenCalled()
    expect(FetchStatusManager.mock.instances[0].startFetchResource).not.toHaveBeenCalled()
    expect(result).toBeUndefined()
  })

  test('startFetchResource (without preload) and fetchManifest are called if startFetch returns continue as true', async () => {
    const fetchResourceEvent = {
      path: '/new-path',
      token: 'any',
      manifestPath: '/my-manifest'
    }
    const result = await fetcher.fetchResource(fetchResourceEvent)

    expect(fetcher.fetchManifest).toHaveBeenCalledWith({
      manifestPath: '/my-manifest',
      token: 'any'
    })
    expect(fetcher.fetchManifest.mock.invocationCallOrder[0]).toBeGreaterThan(FetchStatusManager.mock.instances[0].startFetch.mock.invocationCallOrder[0])

    expect(FetchStatusManager.mock.instances[0].startFetchResource).toHaveBeenCalledWith({
      resource: fetchResourceEvent.path,
      token: fetchResourceEvent.token
    })
    expect(FetchStatusManager.mock.instances[0].startFetchResource.mock.invocationCallOrder[0]).toBeGreaterThan(fetcher.fetchManifest.mock.invocationCallOrder[0])

    expect(fetcher.fetch).toHaveBeenCalledWith({
      path: '/new-path',
      preload: undefined
    })
    expect(fetcher.fetch.mock.invocationCallOrder[0]).toBeGreaterThan(FetchStatusManager.mock.instances[0].startFetchResource.mock.invocationCallOrder[0])

    expect(result).toBeUndefined()
  })

  test('If startFetchResource returns false, do not call the fetch function', async () => {
    FetchStatusManager.mock.instances[0].startFetchResource.mockImplementationOnce(() => false)
    const fetchResourceEvent = {
      path: '/new-path',
      token: 'any',
      manifestPath: '/my-manifest'
    }
    const result = await fetcher.fetchResource(fetchResourceEvent)

    expect(fetcher.fetch).not.toHaveBeenCalled()
    expect(result).toBeUndefined()
  })

  test.each([
    { errorMessage: 'fetch error message', statusCode: 101 },
    { errorMessage: undefined, statusCode: undefined }
  ])('If an error is generated with the message $errorMessage and status $statusCode then the resulting message should contain the message $expectedErrorMessage and the same status code', async ({ errorMessage, statusCode }) => {
    const fetchResourceEvent = {
      path: '/new-path',
      token: 'any'
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
      resource: fetchResourceEvent.path,
      token: fetchResourceEvent.token,
      success: false,
      error: createCwaResourceError(error)
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
      preload: ['/something']
    }
    const result = await fetcher.fetchResource(fetchResourceEvent)

    expect(fetcher.fetchManifest).not.toHaveBeenCalled()
    expect(fetcher.fetch).toHaveBeenCalledWith({
      path: '/new-path',
      preload: ['/something']
    })
    expect(fetcher.fetch.mock.invocationCallOrder[0]).toBeGreaterThan(FetchStatusManager.mock.instances[0].startFetchResource.mock.invocationCallOrder[0])
    expect(FetchStatusManager.mock.instances[0].finishFetchResource).toHaveBeenCalledWith({
      resource: fetchResourceEvent.path,
      token: fetchResourceEvent.token,
      success: true
    })
    expect(FetchStatusManager.mock.instances[0].finishFetchResource.mock.invocationCallOrder[0]).toBeGreaterThan(fetcher.fetch.mock.invocationCallOrder[0])

    expect(fetcher.fetchNestedResources).toBeCalledWith({ some: 'resource' }, 'any')
    expect(fetcher.fetchNestedResources.mock.invocationCallOrder[0]).toBeGreaterThan(FetchStatusManager.mock.instances[0].finishFetchResource.mock.invocationCallOrder[0])
    expect(result).toStrictEqual({ some: 'resource' })
  })

  test('finish fetch is not called if a previous token is provided', async () => {
    const fetchResourceEvent = {
      path: '/new-path',
      token: 'any'
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
      path: '/new-path'
    }
    const result = await fetcher.fetchResource(fetchResourceEvent)

    expect(FetchStatusManager.mock.instances[0].finishFetch).toHaveBeenCalledWith({
      token: 'new-token'
    })
    expect(FetchStatusManager.mock.instances[0].finishFetch.mock.invocationCallOrder[0]).toBeGreaterThan(fetcher.fetchNestedResources.mock.invocationCallOrder[0])

    expect(result).toStrictEqual({ some: 'resource' })
    expect(finishResolved).toBe(true)
  })
})

describe('Fetcher -> fetchManifest', () => {
  let fetcher: Fetcher

  beforeEach(() => {
    fetcher = createFetcher()
    vi.spyOn(fetcher, 'fetch').mockImplementation(() => {
      return Promise.resolve()
    })
    FetchStatusManager.mock.instances[0].startFetch.mockImplementation((startEvent) => {
      return {
        continue: true,
        token: startEvent.token
      }
    })
    FetchStatusManager.mock.instances[0].startFetchResource.mockImplementation(() => {})
    FetchStatusManager.mock.instances[0].finishFetchResource.mockImplementation(() => {})
    FetchStatusManager.mock.instances[0].finishFetch.mockImplementation(() => {})
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('We finish the manifest status when completed', async () => {
    vi.spyOn(fetcher, 'fetch').mockImplementation((event) => {
      if (event.path !== '/my-manifest') {
        return Promise.resolve()
      }
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            _data: {
              resource_iris: ['/manifest-resource-iri']
            }
          })
        }, 1)
      })
    })

    const fetchResourceEvent = {
      path: '/new-path',
      token: 'any',
      manifestPath: '/my-manifest'
    }
    await fetcher.fetchResource(fetchResourceEvent)
    // we will not be awaiting the manifest
    expect(FetchStatusManager.mock.instances[0].finishManifestFetch).not.toHaveBeenCalled()
    await delay(5)
    expect(FetchStatusManager.mock.instances[0].finishManifestFetch).toHaveBeenCalledWith({
      resources: ['/manifest-resource-iri'],
      token: 'any',
      type: FinishFetchManifestType.SUCCESS
    })
  })

  test.each([
    { errorMessage: 'fetch error message', statusCode: 101 },
    { errorMessage: undefined, statusCode: undefined }
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
      manifestPath: '/my-manifest'
    }
    await fetcher.fetchResource(fetchResourceEvent)
    expect(FetchStatusManager.mock.instances[0].finishManifestFetch).toHaveBeenCalledWith({
      token: 'any',
      type: FinishFetchManifestType.ERROR,
      error: createCwaResourceError(error)
    })
  })
})

describe('Fetcher -> fetch', () => {
  let fetcher: Fetcher

  beforeEach(() => {
    fetcher = createFetcher()
    FetchStatusManager.mock.instances[0].startFetch.mockImplementation(() => {
      return {
        continue: true
      }
    })
    FetchStatusManager.mock.instances[0].startFetchResource.mockImplementation(() => true)
    FetchStatusManager.mock.instances[0].finishFetchResource.mockImplementation(() => {})
    FetchStatusManager.mock.instances[0].finishFetch.mockImplementation(() => {})
    vi.spyOn(fetcher, 'createRequestHeaders').mockImplementation(() => ({ someHeader: 'someValue' }))
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
      token: 'any'
    }
    await fetcher.fetchResource(fetchResourceEvent)
    expect(CwaFetch.mock.results[0].value.fetch.raw.mock.calls[0][0]).toBe('/mock-path?query=value')
    expect(CwaFetch.mock.results[0].value.fetch.raw.mock.calls[0][1]).toStrictEqual({ headers: { someHeader: 'someValue' } })
    expect(CwaFetch.mock.results[0].value.fetch.raw.mock.invocationCallOrder[0]).toBeGreaterThan(fetcher.appendQueryToPath.mock.invocationCallOrder[0])
  })
})

describe('Fetcher -> appendQueryToPath', () => {
  let fetcher: Fetcher

  function setupMocks (fetcher: Fetcher) {
    vi.spyOn(fetcher, 'createRequestHeaders').mockImplementation(() => ({}))
    FetchStatusManager.mock.instances[0].startFetch.mockImplementation(() => {
      return {
        continue: true
      }
    })
    FetchStatusManager.mock.instances[0].startFetchResource.mockImplementation(() => true)
    FetchStatusManager.mock.instances[0].finishFetchResource.mockImplementation(() => {})
    FetchStatusManager.mock.instances[0].finishFetch.mockImplementation(() => {})
    CwaFetch.mock.results[0].value.fetch.raw.mockImplementation(() => {})
    vi.spyOn(fetcher, 'appendQueryToPath')
  }

  afterEach(() => {
    vi.clearAllMocks()
  })

  test
    .each([
      { query: { something: 1 }, path: '/mock-path', result: '/mock-path?something=1' },
      { query: { something: 1 }, path: '/mock-path?existing=1', result: '/mock-path?existing=1&something=1' },
      { query: undefined, path: '/mock-path', result: '/mock-path' },
      { query: {}, path: '/mock-path', result: '/mock-path' }
    ])("If query parameters are '$query' and the fetch path is $path we should call a fetch to the url $result", async ({
      query,
      path,
      result
    }) => {
      fetcher = createFetcher(query)
      setupMocks(fetcher)
      const fetchResourceEvent = {
        path,
        token: 'any'
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
        continue: true
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
      { preload: undefined, path: '/_/routes//', headers: { path: '/primary-fetch-path', preload: preloadHeaders[CwaResourceTypes.ROUTE].join(',') } }
    ])("If I create headers passing preload as '$preload' and path as $path the headers should be $headers", async ({
      preload,
      path,
      headers
    }) => {
      // FetchStatusManager.mock.results[0].value.primaryFetchPath.mockImplementation(() => 'anything')
      const fetchResourceEvent = {
        path,
        preload
      }
      await fetcher.fetchResource(fetchResourceEvent)
      expect(fetcher.createRequestHeaders).toReturnWith(headers)
    })
})

describe.todo('Fetcher -> fetchNestedResources')
describe.todo('Fetcher -> fetchBatch')
