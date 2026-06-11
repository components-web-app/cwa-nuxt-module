// @vitest-environment happy-dom

import { describe, vi, test, expect } from 'vitest'
import type { SpyFn } from 'tinyspy'
import { Storage } from './storage'
import { MercureStore } from './stores/mercure/mercure-store'
import { ResourcesStore } from './stores/resources/resources-store'
import { FetcherStore } from './stores/fetcher/fetcher-store'
import { ApiDocumentationStore } from './stores/api-documentation/api-documentation-store'
import { AuthStore } from './stores/auth/auth-store'
import { AdminStore } from './stores/admin/admin-store'
import { ErrorStore } from './stores/error/error-store'
import { SiteConfigStore } from './stores/site-config/site-config-store'

type TestStore = { name: string }
type StoreMock = SpyFn<[], TestStore>

vi.mock('./stores/resources/resources-store', () => {
  return {
    ResourcesStore: vi.fn<[], TestStore>(function () { return { name: 'ResourcesStore' } }),
  }
})
vi.mock('./stores/fetcher/fetcher-store', () => {
  return {
    FetcherStore: vi.fn<[], TestStore>(function () { return { name: 'FetcherStore' } }),
  }
})
vi.mock('./stores/mercure/mercure-store', () => {
  return {
    MercureStore: vi.fn<[], TestStore>(function () { return { name: 'MercureStore' } }),
  }
})
vi.mock('./stores/api-documentation/api-documentation-store', () => {
  return {
    ApiDocumentationStore: vi.fn<[], TestStore>(function () { return { name: 'ApiDocumentationStore' } }),
  }
})

vi.mock('./stores/auth/auth-store', () => {
  return {
    AuthStore: vi.fn<[], TestStore>(function () { return { name: 'AuthStore' } }),
  }
})

vi.mock('./stores/admin/admin-store', () => {
  return {
    AdminStore: vi.fn<[], TestStore>(function () { return { name: 'AdminStore' } }),
  }
})

vi.mock('./stores/error/error-store', () => {
  return {
    ErrorStore: vi.fn<[], TestStore>(function () { return { name: 'ErrorStore' } }),
  }
})

vi.mock('./stores/site-config/site-config-store', () => {
  return {
    SiteConfigStore: vi.fn<[], TestStore>(function () { return { name: 'SiteConfigStore' } }),
  }
})

describe('Storage addUniquePromise', () => {
  test('executes fn for new key and returns undefined', async () => {
    const storage = new Storage('test')
    let resolved = false
    const result = storage.addUniquePromise('scope', 'key', async () => {
      resolved = true
    })
    // first call returns undefined (no return statement for new keys)
    expect(result).toBeUndefined()
    // wait for microtask queue to flush
    await Promise.resolve()
    expect(resolved).toBe(true)
  })

  test('returns existing promise for duplicate key while in flight', () => {
    const storage = new Storage('test')
    let resolveFn: () => void
    const fn = () => new Promise<void>((resolve) => {
      resolveFn = resolve
    })
    storage.addUniquePromise('scope', 'key', fn) // first call - starts promise
    const p2 = storage.addUniquePromise('scope', 'key', fn) // second call - returns existing
    expect(p2).toBeInstanceOf(Promise)
    resolveFn!()
  })

  test('allows a new fn call after previous key completed', async () => {
    const storage = new Storage('test')
    storage.addUniquePromise('scope', 'key', () => Promise.resolve())
    // wait for promise to complete and delete key
    await new Promise(resolve => setTimeout(resolve, 0))
    let ran = false
    storage.addUniquePromise('scope', 'key', async () => {
      ran = true
    })
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(ran).toBe(true)
  })

  test('different scopes maintain separate promise maps', async () => {
    const storage = new Storage('test')
    let ran1 = false
    let ran2 = false
    storage.addUniquePromise('scope1', 'key', async () => {
      ran1 = true
    })
    storage.addUniquePromise('scope2', 'key', async () => {
      ran2 = true
    })
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(ran1).toBe(true)
    expect(ran2).toBe(true)
  })
})

describe('Storage is initialised properly', () => {
  test('Stores are initialised', () => {
    const storeName = 'mystore'
    const storage = new Storage(storeName)

    // @ts-expect-error
    const resourcesStoreMock: StoreMock = ResourcesStore
    // @ts-expect-error
    const fetcherStoreMock: StoreMock = FetcherStore
    // @ts-expect-error
    const mercureStoreMock: StoreMock = MercureStore
    // @ts-expect-error
    const apiDocumentationStoreMock: StoreMock = ApiDocumentationStore
    // @ts-expect-error
    const authStoreMock: StoreMock = AuthStore
    // @ts-expect-error
    const adminStoreMock: StoreMock = AdminStore
    // @ts-expect-error
    const errorStoreMock: StoreMock = ErrorStore
    // @ts-expect-error
    const siteConfigStoreMock: StoreMock = SiteConfigStore

    expect(resourcesStoreMock).toBeCalledWith(storeName)
    expect(fetcherStoreMock).toBeCalledWith(storeName)
    expect(mercureStoreMock).toBeCalledWith(storeName)
    expect(apiDocumentationStoreMock).toBeCalledWith(storeName)
    expect(authStoreMock).toBeCalledWith(storeName)
    expect(errorStoreMock).toBeCalledWith(storeName)
    expect(siteConfigStoreMock).toBeCalledWith(storeName)

    expect(storage.stores).toStrictEqual({
      resources: resourcesStoreMock.mock.results[0].value,
      fetcher: fetcherStoreMock.mock.results[0].value,
      mercure: mercureStoreMock.mock.results[0].value,
      apiDocumentation: apiDocumentationStoreMock.mock.results[0].value,
      auth: authStoreMock.mock.results[0].value,
      admin: adminStoreMock.mock.results[0].value,
      error: errorStoreMock.mock.results[0].value,
      siteConfig: siteConfigStoreMock.mock.results[0].value,
    })
  })
})
