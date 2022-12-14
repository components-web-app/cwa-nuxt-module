import { describe, vi, afterEach, test, expect, beforeEach } from 'vitest'
import Fetcher from './fetcher'
import CwaFetch from './cwa-fetch'
import FetchStatusManager from './fetch-status-manager'

vi.mock('./cwa-fetch')
vi.mock('./fetch-status-manager')

function createFetcher (): Fetcher {
  const cwaFetch = new CwaFetch('https://api-url')
  const statusManager = new FetchStatusManager()
  const currentRoute = { path: '/current-path' }
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

  test('startFetchResource and fetchManifest are called if startFetch returns continue as true', async () => {
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
    expect(result).toBeUndefined()
  })

  test('finishFetchResource is called if startFetch returns continue as true', async () => {
    const fetchResourceEvent = {
      path: '/new-path',
      token: 'any'
    }
    const result = await fetcher.fetchResource(fetchResourceEvent)

    expect(fetcher.fetchManifest).not.toHaveBeenCalled()
    expect(FetchStatusManager.mock.instances[0].finishFetchResource.mock.invocationCallOrder[0]).toBeGreaterThan(FetchStatusManager.mock.instances[0].startFetchResource.mock.invocationCallOrder[0])
    expect(FetchStatusManager.mock.instances[0].finishFetchResource).toHaveBeenCalledWith({
      resource: fetchResourceEvent.path,
      token: fetchResourceEvent.token,
      success: true
    })
    expect(result).toBeUndefined()
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

    expect(FetchStatusManager.mock.instances[0].finishFetch.mock.invocationCallOrder[0]).toBeGreaterThan(FetchStatusManager.mock.instances[0].finishFetchResource.mock.invocationCallOrder[0])
    expect(FetchStatusManager.mock.instances[0].finishFetch).toHaveBeenCalledWith({
      token: 'new-token'
    })
    expect(result).toBeUndefined()
    expect(finishResolved).toBe(true)
  })
})

describe.todo('fetchManifest functionality')
