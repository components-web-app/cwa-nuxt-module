import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import consola from 'consola'
import { reactive } from 'vue'
import { MercureStore } from '../storage/stores/mercure/mercure-store'
import { ResourcesStore } from '../storage/stores/resources/resources-store'
import { CwaResourceApiStatuses } from '../storage/stores/resources/state'
import * as ResourceUtils from '../resources/resource-utils'
import { CwaResourceTypes } from '../resources/resource-utils'
import Mercure from './mercure'
import Fetcher from './fetcher/fetcher'

vi.mock('consola')
vi.mock('../resources/resource-utils')
vi.mock('./fetcher/fetcher')

const EventSource = vi.fn(() => ({
  readyState: 0,
  url: null,
  onmessage: undefined,
  close: vi.fn()
}))
vi.stubGlobal('EventSource', EventSource)

const MessageEvent = vi.fn((eventId = 'abc') => ({
  data: null,
  lastEventId: eventId
}))
vi.stubGlobal('MessageEvent', MessageEvent)

function delay (time: number, returnValue: any = undefined) {
  return new Promise((resolve) => {
    setTimeout(() => { resolve(returnValue) }, time)
  })
}

let mercureStoreDef: MercureStore
let resourcesStoreDef: ResourcesStore
function createMercure (): Mercure {
  mercureStoreDef = new MercureStore('storeName')
  resourcesStoreDef = new ResourcesStore('storeName')
  return new Mercure(mercureStoreDef, resourcesStoreDef)
}

describe('Mercure -> setFetcher', () => {
  test('Set fetcher will set the fetcher property', () => {
    const mercure = createMercure()
    const fetcher = new Fetcher()
    mercure.setFetcher(fetcher)
    expect(mercure.fetcher).toBe(fetcher)
  })
})

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

describe('Mercure -> handleMercureMessage', () => {
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
    vi.spyOn(mercure, 'isMessageForCurrentResource').mockImplementation(() => {
      return true
    })
    vi.spyOn(mercure, 'addMercureMessageToQueue').mockImplementation(() => {})
    vi.spyOn(mercure, 'processMessageQueue').mockImplementation(() => {})
  })

  test('Do not add to message queue if isMessageForCurrentResource returns false', () => {
    vi.spyOn(mercure, 'isMessageForCurrentResource').mockImplementationOnce(() => {
      return false
    })
    const event = new MessageEvent()
    event.data = JSON.stringify({})
    mercure.handleMercureMessage(event)
    expect(mercure.isMessageForCurrentResource).toHaveBeenCalledWith({
      event,
      data: {}
    })
    expect(mercure.addMercureMessageToQueue).not.toHaveBeenCalled()
  })

  test('We will call to add the message to the queue and process immediately if resources API state is not pending', () => {
    const event = new MessageEvent()
    event.data = JSON.stringify({})
    mercure.handleMercureMessage(event)
    expect(mercure.addMercureMessageToQueue).toHaveBeenCalledWith({
      event,
      data: {}
    })
    expect(mercure.processMessageQueue).toHaveBeenCalledTimes(1)
  })

  test('We only call to process the message queue once no api resources are pending', async () => {
    const current = {
      byId: {
        id: {
          apiState: reactive({
            status: CwaResourceApiStatuses.IN_PROGRESS
          })
        }
      },
      currentIds: ['id']
    }
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      initialState: {
        'storeName.mercure': {
          hub: 'http://hub-url'
        },
        'storeName.resources': {
          current
        }
      }
    })
    setActivePinia(pinia)

    const event = new MessageEvent()
    event.data = JSON.stringify({})
    mercure.handleMercureMessage(event)
    expect(mercure.addMercureMessageToQueue).toHaveBeenCalledWith({
      event,
      data: {}
    })

    expect(mercure.processMessageQueue).not.toHaveBeenCalled()

    // update resource so not pending
    current.byId.id.apiState.status = CwaResourceApiStatuses.SUCCESS
    await delay(1)
    expect(mercure.processMessageQueue).toHaveBeenCalledTimes(1)
  })
})

describe('Mercure -> isMessageForCurrentResource', () => {
  let mercure: Mercure

  beforeEach(() => {
    const current = {
      byId: {
        id: {
          apiState: reactive({
            status: CwaResourceApiStatuses.IN_PROGRESS
          })
        }
      },
      currentIds: ['id']
    }
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      initialState: {
        'storeName.resources': {
          current
        }
      }
    })
    setActivePinia(pinia)

    vi.clearAllMocks()
    mercure = createMercure()
  })

  test('If the resource exists in current IDs return true', () => {
    const result = mercure.isMessageForCurrentResource({
      event: undefined,
      data: {
        '@id': 'id'
      }
    })
    expect(result).toBe(true)
  })

  test.each([
    { publishedResourceIriResult: 'id', result: true },
    { publishedResourceIriResult: undefined, result: false },
    { publishedResourceIriResult: 'does-not-exist', result: false }
  ])('If the resource does not exist in current IDs, but the result of getPublishedResourceIri is $publishedResourceIriResult, then return $result', ({
    publishedResourceIriResult,
    result
  }) => {
    vi.spyOn(ResourceUtils, 'getPublishedResourceIri').mockImplementationOnce(() => {
      return publishedResourceIriResult
    })
    const response = mercure.isMessageForCurrentResource({
      event: undefined,
      data: {
        '@id': 'random'
      }
    })
    expect(response).toBe(result)
  })

  test('If the resource does not exist return false', () => {
    const result = mercure.isMessageForCurrentResource({
      event: undefined,
      data: {
        '@id': 'random'
      }
    })
    expect(result).toBe(false)
  })
})

describe('Mercure -> addMercureMessageToQueue', () => {
  let mercure: Mercure

  beforeEach(() => {
    vi.clearAllMocks()
    mercure = createMercure()
  })

  test('When adding a message to the queue, existing messages with the same ID are replaced', () => {
    mercure.mercureMessageQueue = [
      {
        event: undefined,
        data: {
          '@id': 'id1',
          key: 'value'
        }
      },
      {
        event: undefined,
        data: {
          '@id': 'id2',
          key: 'value'
        }
      }
    ]
    mercure.addMercureMessageToQueue({
      event: undefined,
      data: {
        '@id': 'id1',
        somethingNew: 'my-value'
      }
    })
    expect(mercure.mercureMessageQueue).toStrictEqual([
      {
        event: undefined,
        data: {
          '@id': 'id2',
          key: 'value'
        }
      },
      {
        event: undefined,
        data: {
          '@id': 'id1',
          somethingNew: 'my-value'
        }
      }
    ])
  })
})

describe('Mercure -> processMessageQueue', () => {
  let mercure: Mercure

  beforeEach(() => {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      initialState: {
        'storeName.resources': {
          current: {}
        }
      }
    })
    setActivePinia(pinia)

    vi.clearAllMocks()
    mercure = createMercure()
    vi.spyOn(mercure, 'collectResourceActions').mockImplementation(() => {
      return {
        toSave: [{ '@id': '/save-id' }],
        toFetch: ['/to-fetch-id'],
        toDelete: ['/to-delete-id']
      }
    })
    vi.spyOn(mercure, 'fetch').mockImplementation(() => {
      return [{ '@id': '/to-fetch-id' }]
    })
  })

  test('Process message queue and call storage to delete/save resources', async () => {
    const resourcesStore = resourcesStoreDef.useStore()
    const currentQueue = [
      {
        event: new MessageEvent(),
        data: {
          '@id': 'anything'
        }
      }
    ]
    mercure.mercureMessageQueue = currentQueue
    await mercure.processMessageQueue()
    expect(mercure.collectResourceActions).toHaveBeenCalledWith(currentQueue)
    expect(mercure.mercureMessageQueue).toStrictEqual([])
    expect(mercure.fetch).toHaveBeenCalledWith(['/to-fetch-id'])

    expect(resourcesStore.saveResource).toBeCalledWith({
      resource: {
        '@id': '/save-id'
      },
      isNew: true
    })
    expect(resourcesStore.saveResource).toBeCalledWith({
      resource: {
        '@id': '/to-fetch-id'
      },
      isNew: true
    })
    expect(resourcesStore.saveResource).toBeCalledTimes(2)

    expect(resourcesStore.deleteResource).toBeCalledWith({
      resource: '/to-delete-id'
    })
    expect(resourcesStore.deleteResource).toBeCalledTimes(1)
  })
})

describe('Mercure -> collectResourceActions', () => {
  let mercure: Mercure

  beforeEach(() => {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      initialState: {
        'storeName.resources': {
          current: {}
        }
      }
    })
    setActivePinia(pinia)

    vi.clearAllMocks()
    mercure = createMercure()
    vi.spyOn(mercure, 'isMessageForCurrentResource').mockImplementation((event) => {
      return event.data['@id'] !== 'id-not-current'
    })
  })

  test('collectResourceActions resolves the correct resources into categories', () => {
    const messages = [
      {
        event: new MessageEvent(),
        data: {
          '@id': 'id-delete'
        }
      },
      {
        event: new MessageEvent(),
        data: {
          '@id': 'id1',
          key: 'value'
        }
      },
      {
        event: new MessageEvent(),
        data: {
          '@id': 'id-not-current',
          key: 'value'
        }
      },
      {
        event: new MessageEvent('final-event-id'),
        data: {
          '@id': 'id-position',
          '@type': CwaResourceTypes.COMPONENT_POSITION,
          key: 'value'
        }
      }
    ]
    const result = mercure.collectResourceActions(messages)
    expect(result).toStrictEqual({
      toSave: [{
        '@id': 'id1',
        key: 'value'
      }],
      toDelete: ['id-delete'],
      toFetch: ['id-position']
    })

    expect(mercure.isMessageForCurrentResource).toHaveBeenCalledTimes(4)
    expect(mercure.lastEventId).toBe('final-event-id')
  })
})

describe('Mercure -> fetch', () => {
  let mercure: Mercure

  beforeEach(() => {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      initialState: {
        'storeName.resources': {
          current: {}
        }
      }
    })
    setActivePinia(pinia)

    vi.clearAllMocks()
    mercure = createMercure()
    const fetcher = new Fetcher()
    mercure.setFetcher(fetcher)
  })

  test('Fetcher fetchResource is called the correct number of times with the correct arguments', async () => {
    await mercure.fetch(['/to-fetch-1', '/to-fetch-2', '/no-resource'])
    const fetcher = Fetcher.mock.instances[0]
    expect(fetcher.fetchResource).toHaveBeenCalledTimes(3)
    expect(fetcher.fetchResource).toHaveBeenCalledWith({
      path: '/to-fetch-1',
      noSave: true,
      shallowFetch: true
    })
    expect(fetcher.fetchResource).toHaveBeenCalledWith({
      path: '/to-fetch-2',
      noSave: true,
      shallowFetch: true
    })
    expect(fetcher.fetchResource).toHaveBeenCalledWith({
      path: '/no-resource',
      noSave: true,
      shallowFetch: true
    })
  })

  test('Fetcher promises are awaited and resources returned', async () => {
    const fetcher = Fetcher.mock.instances[0]
    vi.spyOn(fetcher, 'fetchResource').mockImplementation(({ path }) => {
      return Promise.resolve(path === '/no-resource' ? undefined : { '@id': path })
    })
    const resources = await mercure.fetch(['/to-fetch-1', '/to-fetch-2', '/no-resource'])
    expect(resources).toStrictEqual([
      {
        '@id': '/to-fetch-1'
      },
      {
        '@id': '/to-fetch-2'
      }
    ])
  })

  test('An error is thrown if there is no fetcher set', async () => {
    mercure.setFetcher(undefined)
    await expect(mercure.fetch(['/to-fetch-1', '/to-fetch-2'])).rejects.toThrowError('Mercure cannot fetch resources. Fetcher is not set.')
  })
})
