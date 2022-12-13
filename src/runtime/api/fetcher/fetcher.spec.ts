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

  test('Initialises a fetch status. No token should not continue to fetch', async () => {
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
    FetchStatusManager.mock.instances[0].startFetch.mockImplementationOnce(() => {
      return 'some-token'
    })
    const result = await fetcher.fetchRoute('/some-route')
    expect(fetcher.fetchResource).toHaveBeenCalledWith('/_/routes//some-route', 'some-token')
    expect(FetchStatusManager.mock.instances[0].finishFetch).toHaveBeenCalledWith({ token: 'some-token' })
    expect(result).toStrictEqual(fetcher.fetchResource.mock.results[0].value)
  })
})
