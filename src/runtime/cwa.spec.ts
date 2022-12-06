import { describe, expect, SpyInstance, test, vi, beforeEach } from 'vitest'
import { SpyFn } from 'tinyspy'
import { CwaModuleOptions } from '../module'
import Cwa from './cwa'
import { Storage } from './storage/storage'
import ApiDocumentation from './api/api-documentation'
import Mercure from './api/mercure'
import Fetcher from './api/fetcher/fetcher'

interface globalThisType {
  mockApiDocumentation: {
    getApiDocumentation: SpyInstance
  },
  MercureInstance: SpyFn<[], { name: string }>
}
declare const globalThis: globalThisType

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
  vi.stubGlobal('MercureInstance', MercureInstance)
  return {
    default: MercureInstance
  }
})

vi.mock('./api/api-documentation', () => {
  const mockApiDocumentation = {
    getApiDocumentation: vi.fn((refresh = false) => {
      return 'refresh:' + refresh
    })
  }
  vi.stubGlobal('mockApiDocumentation', mockApiDocumentation)
  return {
    default: vi.fn(() => (mockApiDocumentation))
  }
})

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

  test('Storage class is setup', () => {
    expect(Storage).toBeCalledWith(storeName)
    expect($cwa.stores).toHaveProperty('apiDocumentation')
    expect($cwa.stores).toHaveProperty('resources')
    expect($cwa.stores).toHaveProperty('fetcher')
    expect($cwa.stores).toHaveProperty('mercure')
  })

  test('ApiDocumentation is setup and proxy method works', async () => {
    expect(ApiDocumentation).toBeCalledWith('https://api-url-not-set.com', $cwa.stores.apiDocumentation)

    expect(await $cwa.getApiDocumentation(true)).toBe('refresh:true')
    expect(await $cwa.getApiDocumentation(false)).toBe('refresh:false')
    expect(await $cwa.getApiDocumentation()).toBe('refresh:false')
    expect(globalThis.mockApiDocumentation.getApiDocumentation).toBeCalledTimes(3)
  })

  test('Mercure and Fetcher are setup and accessible', () => {
    expect(Mercure).toBeCalledWith($cwa.stores.mercure, $cwa.stores.resources, $cwa.stores.fetcher)
    expect($cwa.mercure).toBe(globalThis.MercureInstance.results[0][1])
    expect(Fetcher).toBeCalledWith('https://api-url-not-set.com', $cwa.stores.fetcher, $cwa.stores.resources, { path }, $cwa.mercure, globalThis.mockApiDocumentation)
  })
})
