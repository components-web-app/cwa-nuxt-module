import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import { CwaModuleOptions } from '../module'
import Cwa from './cwa'
import { Storage } from './storage/storage'
import ApiDocumentation from './api/api-documentation'
import Mercure from './api/mercure'
import Fetcher from './api/fetcher/fetcher'
import CwaFetch from './api/fetcher/cwa-fetch'
import FetchStatusManager from './api/fetcher/fetch-status-manager'
import { ResourcesManager } from './resources/resources-manager'

vi.mock('./storage/storage', () => {
  return {
    Storage: vi.fn(() => ({
      stores: {
        apiDocumentation: vi.fn(),
        resources: vi.fn(),
        fetcher: vi.fn(),
        mercure: vi.fn()
      }
    }))
  }
})

vi.mock('./api/fetcher/fetcher', () => {
  return {
    default: vi.fn()
  }
})

vi.mock('./api/mercure', () => {
  const MercureInstance = vi.fn(() => ({ name: 'MERCURE' })).mockReturnThis()
  return {
    default: MercureInstance
  }
})

vi.mock('./api/api-documentation', () => {
  const getApiDocumentation = vi.fn((refresh = false) => {
    return 'refresh:' + refresh
  })
  return {
    default: vi.fn(() => ({
      getApiDocumentation
    }))
  }
})
vi.mock('./api/fetcher/cwa-fetch')
vi.mock('./api/fetcher/fetch-status-manager')
vi.mock('./resources/resources-manager')

const path = 'something'
const storeName = 'dummystore'
function createCwa ({ apiUrlBrowser, apiUrl }: CwaModuleOptions) {
  // @ts-ignore
  return new Cwa({
    _route: {
      path
    }
  }, {
    apiUrlBrowser,
    apiUrl,
    storeName
  })
}

describe('$cwa.apiUrl tests', () => {
  test('API Url set correctly for client-side requests', () => {
    let $cwa
    process.client = true

    $cwa = createCwa({ storeName })
    expect($cwa.apiUrl).toBe('https://api-url-not-set.com')

    $cwa = createCwa({ storeName, apiUrl: 'https://api-url', apiUrlBrowser: 'https://api-url-browser' })
    expect($cwa.apiUrl).toBe('https://api-url-browser')

    $cwa = createCwa({ storeName, apiUrl: 'https://api-url' })
    expect($cwa.apiUrl).toBe('https://api-url')
  })

  test('API Url set correctly for server-side requests', () => {
    let $cwa
    process.client = false

    $cwa = createCwa({ storeName })
    expect($cwa.apiUrl).toBe('https://api-url-not-set.com')

    $cwa = createCwa({ storeName, apiUrl: 'https://api-url', apiUrlBrowser: 'https://api-url-browser' })
    expect($cwa.apiUrl).toBe('https://api-url')

    $cwa = createCwa({ storeName, apiUrlBrowser: 'https://api-url-browser' })
    expect($cwa.apiUrl).toBe('https://api-url-browser')
  })
})

describe('Cwa class test', () => {
  let $cwa: Cwa

  beforeEach(() => {
    $cwa = createCwa({ storeName })
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('Storage class is setup', () => {
    expect(Storage).toBeCalledWith(storeName)
  })

  test('ApiDocumentation is setup and proxy method works', async () => {
    const stores = Storage.mock.results[0].value.stores
    expect(ApiDocumentation).toBeCalledWith(CwaFetch.mock.instances[0], stores.apiDocumentation)

    expect(await $cwa.getApiDocumentation(true)).toBe('refresh:true')
    expect(await $cwa.getApiDocumentation(false)).toBe('refresh:false')
    expect(await $cwa.getApiDocumentation()).toBe('refresh:false')
    expect(ApiDocumentation.mock.results[0].value.getApiDocumentation).toBeCalledTimes(3)
  })

  test('Mercure instance created and accessible', () => {
    const stores = Storage.mock.results[0].value.stores
    expect(Mercure).toBeCalledWith(stores.mercure, stores.resources)
  })

  test('CwaFetch created to provide a fetch instance with defaults', () => {
    expect(CwaFetch).toBeCalledWith('https://api-url-not-set.com')
  })

  test('FetchStatusManager is initialised', () => {
    const stores = Storage.mock.results[0].value.stores
    expect(FetchStatusManager).toBeCalledWith(stores.fetcher, Mercure.mock.results[0].value, ApiDocumentation.mock.results[0].value, stores.resources)
  })

  test('Fetcher is initialised', () => {
    expect(Fetcher).toBeCalledWith(CwaFetch.mock.instances[0], FetchStatusManager.mock.instances[0], { path })
  })

  test('ResourcesManager is initialised and accessible', () => {
    const stores = Storage.mock.results[0].value.stores
    expect(ResourcesManager).toBeCalledWith(stores.resources)
    expect($cwa.resourcesManager).toBe(ResourcesManager.mock.instances[0])
  })
})
