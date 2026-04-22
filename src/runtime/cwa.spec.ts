import { describe, expect, test, vi, beforeEach } from 'vitest'
import type { CwaModuleOptions } from '#cwa/types'
import type { Router } from 'vue-router'
import Cwa from './cwa'
import { Storage } from './storage/storage'
import ApiDocumentation from './api/api-documentation'
import Mercure from './api/mercure'
import Fetcher from './api/fetcher/fetcher'
import CwaFetch from './api/fetcher/cwa-fetch'
import FetchStatusManager from './api/fetcher/fetch-status-manager'
import { ResourcesManager } from './resources/resources-manager'
import { Resources } from './resources/resources'
import * as processComposables from './composables/process'
import Admin from './admin/admin'
import NavigationGuard from './admin/navigation-guard'
import Auth from './api/auth'
import * as nuxtApp from '#app/nuxt'

vi.mock('#app/composables/cookie.js', () => {
  return {
    useCookie: vi.fn((...args) => ([...args])),
  }
})

vi.mock('./storage/storage', () => {
  return {
    Storage: vi.fn(function () {
      return {
        stores: {
          apiDocumentation: {
            useStore: vi.fn(),
          },
          resources: {
            useStore: vi.fn(),
          },
          fetcher: {
            useStore: vi.fn(),
          },
          mercure: {
            useStore: vi.fn(),
          },
          admin: {
            useStore: vi.fn(),
          },
          auth: {
            useStore: vi.fn(),
          },
          error: {
            useStore: vi.fn(),
          },
          siteConfig: {
            useStore: vi.fn(),
          },
        },
      }
    }),
  }
})

vi.mock('./api/fetcher/fetcher', function () {
  return {
    default: vi.fn(function () {}),
  }
})

vi.mock('./api/mercure', function () {
  const MercureInstance = vi.fn(function () {
    return {
      name: 'MERCURE',
      setFetcher: vi.fn(),
      setRequestCount: vi.fn(),
    }
  })

  return {
    default: MercureInstance,
  }
})

vi.mock('./api/api-documentation', function () {
  const getApiDocumentation = vi.fn((refresh = false) => {
    return 'refresh:' + refresh
  })

  return {
    default: vi.fn(function () {
      return {
        getApiDocumentation,
      }
    }),
  }
})
vi.mock('./api/fetcher/cwa-fetch')
vi.mock('./api/fetcher/fetch-status-manager')
vi.mock('./resources/resources-manager', function () {
  return {
    ResourcesManager: vi.fn(function () {
      return {
        requestCount: 999,
      }
    }),
  }
})
vi.mock('./resources/resources')
vi.mock('./api/auth', function () {
  return {
    default: vi.fn(function () {
      return {
        signedIn: 'am-i-signed-in?',
      }
    }),
  }
})
vi.mock('./api/forms')
vi.mock('./admin/admin', function () {
  return {
    default: vi.fn(function () {
      return {
        resourceManager: 'resourceManagerMockAsString',
      }
    }),
  }
})
vi.mock('./admin/navigation-guard', function () {
  return {
    default: vi.fn(function () {
      return {
        adminNavigationGuardFn: vi.fn(),
      }
    }),
  }
})

const storeName = 'dummystore'
const $router = vi.fn()
function createCwa({ apiUrlBrowser, apiUrl }: CwaModuleOptions) {
  vi.spyOn(nuxtApp, 'useRuntimeConfig').mockImplementation(() => ({
    public: {
      cwa: {
        apiUrlBrowser,
        apiUrl,
      },
    },
  }))
  return new Cwa($router as Router, {
    storeName,
  }, {
    version: 'abc',
    name: 'named',
  })
}

describe('$cwa.apiUrl tests', () => {
  test('API Url set correctly for client-side requests', () => {
    let $cwa
    vi.spyOn(processComposables, 'useProcess').mockImplementation(() => {
      return {
        isClient: true,
        isServer: false,
      }
    })

    $cwa = createCwa({ storeName })
    expect($cwa.apiUrl).toBe('https://api-url-not-set.com')

    $cwa = createCwa({ storeName, apiUrl: 'https://api-url', apiUrlBrowser: 'https://api-url-browser' })
    expect($cwa.apiUrl).toBe('https://api-url-browser')

    $cwa = createCwa({ storeName, apiUrl: 'https://api-url' })
    expect($cwa.apiUrl).toBe('https://api-url')
  })

  test('API Url set correctly for server-side requests', () => {
    let $cwa
    vi.spyOn(processComposables, 'useProcess').mockImplementation(() => {
      return {
        isClient: false,
        isServer: true,
      }
    })

    $cwa = createCwa({ storeName })
    expect($cwa.apiUrl).toBe('https://api-url-not-set.com')

    $cwa = createCwa({ storeName, apiUrl: 'https://api-url', apiUrlBrowser: 'https://api-url-browser' })
    expect($cwa.apiUrl).toBe('https://api-url')

    $cwa = createCwa({ storeName, apiUrlBrowser: 'https://api-url-browser' })
    expect($cwa.apiUrl).toBe('https://api-url-browser')
  })
})

describe('Cwa class test', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('Storage class is setup', () => {
    createCwa({ storeName })
    expect(Storage).toBeCalledWith(storeName)
  })

  test('ApiDocumentation is setup and proxy method works', async () => {
    const $cwa = createCwa({ storeName })
    const stores = Storage.mock.results[0].value.stores
    expect(ApiDocumentation).toBeCalledWith(CwaFetch.mock.results[0].value, stores.apiDocumentation)

    expect(await $cwa.getApiDocumentation(true)).toBe('refresh:true')
    expect(await $cwa.getApiDocumentation(false)).toBe('refresh:false')
    expect(await $cwa.getApiDocumentation()).toBe('refresh:false')
    expect(ApiDocumentation.mock.results[0].value.getApiDocumentation).toBeCalledTimes(3)
  })

  test('CwaFetch created to provide a fetch instance with defaults', () => {
    createCwa({ storeName })
    expect(CwaFetch).toBeCalledWith('https://api-url-not-set.com')
  })

  test('FetchStatusManager is initialised', () => {
    createCwa({ storeName })
    const stores = Storage.mock.results[0].value.stores
    expect(FetchStatusManager).toBeCalledWith(stores.fetcher, Mercure.mock.results[0].value, ApiDocumentation.mock.results[0].value, stores.resources)
  })

  test('Fetcher is initialised', () => {
    createCwa({ storeName })
    const stores = Storage.mock.results[0].value.stores
    expect(Fetcher).toBeCalledWith(CwaFetch.mock.results[0].value, FetchStatusManager.mock.results[0].value, $router, stores.resources)
  })

  test('Resources is initialised and accessible', () => {
    const $cwa = createCwa({ storeName })
    const stores = Storage.mock.results[0].value.stores
    expect(Resources).toBeCalledWith(stores.resources, stores.fetcher)
    expect($cwa.resources).toBe(Resources.mock.results[0].value)
  })

  test('ResourcesManager is initialised and accessible', () => {
    const $cwa = createCwa({ storeName })
    const stores = Storage.mock.results[0].value.stores
    expect(ResourcesManager).toBeCalledWith(CwaFetch.mock.results[0].value, stores.resources, FetchStatusManager.mock.results[0].value, stores.error, Fetcher.mock.results[0].value, Admin.mock.results[0].value, Resources.mock.results[0].value)
    expect($cwa.resourcesManager).toBe(ResourcesManager.mock.results[0].value)
  })

  test('Mercure instance created and accessible', () => {
    createCwa({ storeName })
    const stores = Storage.mock.results[0].value.stores
    expect(Mercure).toBeCalledWith(stores.mercure, stores.resources, stores.fetcher)
    expect(Mercure.mock.results[0].value.setFetcher).toBeCalledWith(Fetcher.mock.results[0].value)
    expect(Mercure.mock.results[0].value.setRequestCount).toBeCalledWith(ResourcesManager.mock.results[0].value.requestCount)
  })

  test('Auth is initialised and accessible', () => {
    const $cwa = createCwa({ storeName })
    const stores = Storage.mock.results[0].value.stores

    expect(Auth).toBeCalledWith(
      CwaFetch.mock.results[0].value,
      Mercure.mock.results[0].value,
      Fetcher.mock.results[0].value,
      Admin.mock.results[0].value,
      ApiDocumentation.mock.results[0].value,
      stores.auth,
      stores.resources,
      stores.fetcher,
      ['cwa_auth', { sameSite: 'strict' }],
    )
    expect($cwa.auth).toBe(Auth.mock.results[0].value)
  })

  test('Admin is initialised and accessible', () => {
    const $cwa = createCwa({ storeName })
    const stores = Storage.mock.results[0].value.stores
    expect(Admin).toBeCalledWith(stores.admin, stores.resources, Resources.mock.results[0].value)
    expect($cwa.admin).toBe(Admin.mock.results[0].value)
  })

  test('Admin navigation guard is initialised', () => {
    const $cwa = createCwa({ storeName })
    const stores = Storage.mock.results[0].value.stores
    expect(NavigationGuard).toBeCalledWith($router, stores.admin)
    expect($cwa.adminNavGuard).toBe(NavigationGuard.mock.results[0].value)
    expect($cwa.adminNavigationGuardFn).toBe(NavigationGuard.mock.results[0].value.adminNavigationGuardFn)
  })
})
