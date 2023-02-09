import { describe, vi, test, expect } from 'vitest'
import { SpyFn } from 'tinyspy'
import { Storage } from './storage'
import { MercureStore } from './stores/mercure/mercure-store'
import { ResourcesStore } from './stores/resources/resources-store'
import { FetcherStore } from './stores/fetcher/fetcher-store'
import { ApiDocumentationStore } from './stores/api-documentation/api-documentation-store'

type TestStore = { name: string }
type StoreMock = SpyFn<[], TestStore>

vi.mock('./stores/resources/resources-store', () => {
  return {
    ResourcesStore: vi.fn<[], TestStore>(() => ({ name: 'ResourcesStore' }))
  }
})
vi.mock('./stores/fetcher/fetcher-store', () => {
  return {
    FetcherStore: vi.fn<[], TestStore>(() => ({ name: 'FetcherStore' }))
  }
})
vi.mock('./stores/mercure/mercure-store', () => {
  return {
    MercureStore: vi.fn<[], TestStore>(() => ({ name: 'MercureStore' }))
  }
})
vi.mock('./stores/api-documentation/api-documentation-store', () => {
  return {
    ApiDocumentationStore: vi.fn<[], TestStore>(() => ({ name: 'ApiDocumentationStore' }))
  }
})

describe('Storage is initialised properly', () => {
  const storeName = 'mystore'
  test('Stores are initialised', () => {
    const storage = new Storage(storeName)

    // @ts-ignore
    const resourcesStoreMock:StoreMock = ResourcesStore
    // @ts-ignore
    const fetcherStoreMock:StoreMock = FetcherStore
    // @ts-ignore
    const mercureStoreMock:StoreMock = MercureStore
    // @ts-ignore
    const apiDocumentationStoreMock:StoreMock = ApiDocumentationStore

    expect(resourcesStoreMock).toBeCalledWith(storeName)
    expect(fetcherStoreMock).toBeCalledWith(storeName)
    expect(mercureStoreMock).toBeCalledWith(storeName)
    expect(apiDocumentationStoreMock).toBeCalledWith(storeName)

    expect(storage.stores).toStrictEqual({
      resources: resourcesStoreMock.results[0][1],
      fetcher: fetcherStoreMock.results[0][1],
      mercure: mercureStoreMock.results[0][1],
      apiDocumentation: apiDocumentationStoreMock.results[0][1]
    })
  })
})
