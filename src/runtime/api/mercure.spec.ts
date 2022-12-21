import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import consola from 'consola'
import { MercureStore } from '../storage/stores/mercure/mercure-store'
import { ResourcesStore } from '../storage/stores/resources/resources-store'
import Mercure from './mercure'

vi.mock('consola')
vi.mock('../resources/resource-utils')

const EventSource = vi.fn(() => ({
  readyState: 0,
  url: null,
  onmessage: undefined,
  close: vi.fn()
}))

vi.stubGlobal('EventSource', EventSource)

let mercureStoreDef: MercureStore
let resourcesStoreDef: ResourcesStore
function createMercure (): Mercure {
  mercureStoreDef = new MercureStore('storeName')
  resourcesStoreDef = new ResourcesStore('storeName')
  return new Mercure(mercureStoreDef, resourcesStoreDef)
}

describe('Mercure -> setMercureHubFromLinkHeader', () => {
  const validLinkHeader = '<https://some-domain/docs.jsonld>; rel="http://www.w3.org/ns/hydra/core#apiDocumentation",<https://localhost:8443/.well-known/mercure>; rel="mercure"'
  const invalidLinkHeader = '<https://some-domain/docs.jsonld>; rel="http://INVALID", (INVALID); rel="mercure"'

  beforeEach(() => {
    const pinia = createTestingPinia({
      createSpy: vi.fn
    })
    setActivePinia(pinia)
    vi.clearAllMocks()
  })

  test('The link header is parsed and set correctly', () => {
    const mercure = createMercure()
    const mercureStore = mercureStoreDef.useStore()

    mercure.setMercureHubFromLinkHeader(validLinkHeader)
    expect(mercureStore.hub).toBe('https://localhost:8443/.well-known/mercure')
  })

  test('An invalid link header is handled', () => {
    const mercure = createMercure()
    const mercureStore = mercureStoreDef.useStore()

    mercure.setMercureHubFromLinkHeader(invalidLinkHeader)
    expect(consola.error).toHaveBeenCalledWith('No Mercure rel in link header.')
    expect(mercureStore.hub).toBeNull()
  })

  test('The link header is not set if docsUrl already set', () => {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      initialState: {
        'storeName.mercure': {
          hub: 'https://someurl'
        }
      }
    })
    setActivePinia(pinia)

    const mercure = createMercure()
    const mercureStore = mercureStoreDef.useStore()
    mercure.setMercureHubFromLinkHeader(validLinkHeader)
    expect(mercureStore.hub).toBe('https://someurl')
  })
})

describe('Mercure -> init', () => {
  let mercure: Mercure
  beforeEach(() => {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      initialState: {
        'storeName.mercure': {
          hub: 'http://hub-url'
        }
      }
    })
    setActivePinia(pinia)
    vi.clearAllMocks()

    mercure = createMercure()
    vi.spyOn(mercure, 'hubUrl', 'get').mockImplementation(() => {
      return vi.fn(() => {})
    })
    vi.spyOn(mercure, 'closeMercure').mockImplementation(() => {})
  })

  test('We do not initialise and log to the console if server-side request', () => {
    process.server = true
    mercure.init()
    expect(consola.debug).toHaveBeenCalledWith('Mercure can only initialise on the client side')
    expect(mercure.hubUrl).not.toHaveBeenCalled()
  })

  test('A warning is logged and request aborted if the hub url has not been set', () => {
    process.server = false
    vi.spyOn(mercure, 'hubUrl', 'get').mockImplementationOnce(() => {
      return false
    })
    mercure.init()
    expect(consola.warn).toHaveBeenCalledWith('Cannot initialize Mercure. Hub URL is not set.')
    expect(mercure.closeMercure).toHaveBeenCalledTimes(1)
  })

  test('A debug console statement is logged and we will not re-initialise a ready event source with the same hub url', () => {
    vi.spyOn(mercure, 'hubUrl', 'get').mockReturnValue('http://hub-url')
    const eventSource = new EventSource()
    eventSource.readyState = 2
    eventSource.url = 'http://hub-url'
    mercure.eventSource = eventSource
    mercure.init()
    expect(consola.debug).toHaveBeenCalledWith("Mercure already initialized 'http://hub-url'")
    expect(mercure.closeMercure).not.toHaveBeenCalled()
  })

  test('A new event source is created', () => {
    vi.spyOn(mercure, 'hubUrl', 'get').mockReturnValue('http://hub-url')
    vi.spyOn(mercure, 'handleMercureMessage').mockReturnValue(() => {
      return 'handleMercureMessageMock'
    })
    mercure.init()
    expect(mercure.closeMercure).toHaveBeenCalledTimes(1)
    expect(consola.info).toHaveBeenCalledWith("Initializing Mercure 'http://hub-url'")
    expect(EventSource).toHaveBeenCalledTimes(1)
    expect(EventSource).toHaveBeenCalledWith('http://hub-url', { withCredentials: true })
    expect(EventSource.mock.results[0].value.onmessage).toBe(mercure.handleMercureMessage)
  })
})

describe('Mercure -> closeMercure', () => {
  let mercure: Mercure
  beforeEach(() => {
    vi.clearAllMocks()

    mercure = createMercure()
  })

  test('We do not attempt to close an event source if it does not exist', () => {
    mercure.closeMercure()
    expect(consola.warn).toHaveBeenLastCalledWith('No Mercure Event Source exists to close')
  })

  test('We can close an event source and will output to the log', () => {
    mercure.eventSource = new EventSource()
    mercure.closeMercure()
    expect(consola.info).toHaveBeenLastCalledWith('Mercure Event Source Closed')
    expect(mercure.eventSource.close).toHaveBeenCalledTimes(1)
  })
})

describe('Mercure -> hubUrl', () => {
  let mercure: Mercure
  beforeEach(() => {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      initialState: {
        'storeName.mercure': {
          hub: 'http://hub-url'
        }
      }
    })
    setActivePinia(pinia)

    vi.clearAllMocks()
    mercure = createMercure()
  })

  test('Return undefined if there is no hub set', () => {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      initialState: {
        'storeName.mercure': {
          hub: undefined
        }
      }
    })
    setActivePinia(pinia)
    expect(mercure.hubUrl).toBeUndefined()
  })

  test('A hub url is created with a wildcard topic', () => {
    expect(mercure.hubUrl).toBe('http://hub-url/?topic=*')
  })

  test('lastEventId is appended if it exists', () => {
    mercure.lastEventId = 'abcdefg'
    expect(mercure.hubUrl).toBe('http://hub-url/?topic=*&Last-Event-ID=abcdefg')
  })
})
