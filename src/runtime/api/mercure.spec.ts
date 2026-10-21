import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { consola as logger } from 'consola'
import { computed } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { MercureStore } from '../storage/stores/mercure/mercure-store'
import { ResourcesStore } from '../storage/stores/resources/resources-store'
import { FetcherStore } from '../storage/stores/fetcher/fetcher-store'
import * as processComposables from '../composables/process'
import Mercure from './mercure'
import MercureClient from './mercure-client'

vi.mock('./mercure-client', () => ({
  default: vi.fn(function () {
    return {
      init: vi.fn(),
      setFetcher: vi.fn(),
      setRequestCount: vi.fn(),
    }
  }),
}))

const validLinkHeader = '<https://some-domain/docs.jsonld>; rel="http://www.w3.org/ns/hydra/core#apiDocumentation",<https://localhost:8443/.well-known/mercure>; rel="mercure"'
const invalidLinkHeader = '<https://some-domain/docs.jsonld>; rel="http://INVALID", (INVALID); rel="mercure"'

let mercureStoreDef: MercureStore
let resourcesStoreDef: ResourcesStore
let fetcherStoreDef: FetcherStore

function createNuxtApp(isHydrating = false) {
  const hooks: Record<string, () => void> = {}
  return {
    isHydrating,
    hooks: {
      hookOnce: vi.fn((name: string, fn: () => void) => {
        hooks[name] = fn
      }),
    },
    callHook: (name: string) => hooks[name]?.(),
  }
}

function createMercure(nuxtApp = createNuxtApp()) {
  mercureStoreDef = new MercureStore('storeName')
  resourcesStoreDef = new ResourcesStore('storeName')
  fetcherStoreDef = new FetcherStore('storeName')
  return new Mercure(mercureStoreDef, resourcesStoreDef, fetcherStoreDef, nuxtApp as never)
}

function client(index = 0) {
  return vi.mocked(MercureClient).mock.results[index]!.value
}

beforeAll(() => {
  logger.wrapAll()
})

beforeEach(() => {
  setActivePinia(createTestingPinia({ createSpy: vi.fn }))
  logger.mockTypes(() => vi.fn())
  vi.spyOn(processComposables, 'useProcess').mockImplementation(() => ({ isClient: true, isServer: false }))
})

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe('Mercure -> setMercureHubFromLinkHeader', () => {
  test('the link header is parsed and set, without loading the Mercure client', () => {
    const mercure = createMercure()
    mercure.setMercureHubFromLinkHeader(validLinkHeader)
    expect(mercureStoreDef.useStore().hub).toBe('https://localhost:8443/.well-known/mercure')
    expect(MercureClient).not.toHaveBeenCalled()
  })

  test.each([
    ['an invalid link header', invalidLinkHeader],
    ['a resource manifest\'s link header, which never carries a Mercure rel', '<https://some-domain/docs.jsonld>; rel="http://www.w3.org/ns/hydra/core#apiDocumentation"'],
  ])('%s sets no hub and logs no error, as the hub comes from another response', (_label, linkHeader) => {
    const mercure = createMercure()
    mercure.setMercureHubFromLinkHeader(linkHeader)
    expect(logger.error).not.toHaveBeenCalled()
    expect(logger.debug).toHaveBeenCalledWith('No Mercure rel in link header.')
    expect(mercureStoreDef.useStore().hub).toBeNull()
  })

  test('the hub is not replaced once set', () => {
    setActivePinia(createTestingPinia({
      createSpy: vi.fn,
      initialState: { 'storeName.mercure': { hub: 'https://someurl' } },
    }))
    const mercure = createMercure()
    mercure.setMercureHubFromLinkHeader(validLinkHeader)
    expect(mercureStoreDef.useStore().hub).toBe('https://someurl')
  })
})

describe('Mercure -> init loads the client lazily (#382)', () => {
  test('nothing is loaded until init is called', async () => {
    createMercure()
    await flushPromises()
    expect(MercureClient).not.toHaveBeenCalled()
  })

  test('on the server the client is never loaded', async () => {
    vi.spyOn(processComposables, 'useProcess').mockImplementation(() => ({ isClient: false, isServer: true }))
    const mercure = createMercure()
    mercure.init()
    await flushPromises()
    expect(MercureClient).not.toHaveBeenCalled()
  })

  test('after hydration the client is loaded, given the stores and the app, and initialised', async () => {
    const nuxtApp = createNuxtApp()
    const mercure = createMercure(nuxtApp)
    mercure.init(true)
    await flushPromises()
    expect(MercureClient).toHaveBeenCalledOnce()
    expect(MercureClient).toHaveBeenCalledWith(mercureStoreDef, resourcesStoreDef, fetcherStoreDef, nuxtApp)
    expect(client().init).toHaveBeenCalledWith(true)
  })

  test('while hydrating, the client is not loaded until the app has resolved', async () => {
    const nuxtApp = createNuxtApp(true)
    const mercure = createMercure(nuxtApp)
    mercure.init()
    await flushPromises()
    expect(nuxtApp.hooks.hookOnce).toHaveBeenCalledWith('app:suspense:resolve', expect.any(Function))
    expect(MercureClient).not.toHaveBeenCalled()

    nuxtApp.callHook('app:suspense:resolve')
    await flushPromises()
    expect(MercureClient).toHaveBeenCalledOnce()
    expect(client().init).toHaveBeenCalledOnce()
  })

  test('repeated inits load one client and initialise it in the order they were asked', async () => {
    const mercure = createMercure()
    mercure.init()
    mercure.init(true)
    await flushPromises()
    mercure.init(false)
    await flushPromises()
    expect(MercureClient).toHaveBeenCalledOnce()
    expect(client().init.mock.calls).toEqual([[undefined], [true], [false]])
  })

  test('the client gets the fetcher and request count whether they are set before or after it loads', async () => {
    const mercure = createMercure()
    const fetcher = { fetcher: true }
    const requestCount = computed(() => 0)
    mercure.setFetcher(fetcher as never)
    mercure.init()
    await flushPromises()
    expect(client().setFetcher).toHaveBeenCalledWith(fetcher)

    mercure.setRequestCount(requestCount)
    expect(client().setRequestCount).toHaveBeenCalledWith(requestCount)
  })

  test('a client that fails to load is logged', async () => {
    vi.mocked(MercureClient).mockImplementationOnce(function () {
      throw new Error('chunk failed')
    })
    const mercure = createMercure()
    mercure.init()
    await flushPromises()
    expect(logger.error).toHaveBeenCalledWith('Could not load the Mercure client', expect.any(Error))
  })
})
