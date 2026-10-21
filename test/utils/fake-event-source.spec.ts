// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { consola as logger } from 'consola'
import { computed } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { MercureStore } from '#cwa/storage/stores/mercure/mercure-store'
import { ResourcesStore } from '#cwa/storage/stores/resources/resources-store'
import { FetcherStore } from '#cwa/storage/stores/fetcher/fetcher-store'
import * as processComposables from '#cwa/composables/process'
import MercureClient from '#cwa/api/mercure-client'
import { installFakeEventSource } from './fake-event-source'

let hub: ReturnType<typeof installFakeEventSource>
let mercureStoreDef: MercureStore
let resourcesStoreDef: ResourcesStore

function connect() {
  setActivePinia(createTestingPinia({ createSpy: vi.fn, initialState: { 'cwa.mercure': { hub: 'https://api.test/.well-known/mercure' } } }))
  mercureStoreDef = new MercureStore('cwa')
  resourcesStoreDef = new ResourcesStore('cwa')
  const resourcesStore = resourcesStoreDef.useStore()
  resourcesStore.current.currentIds = ['/component/a']
  const client = new MercureClient(mercureStoreDef, resourcesStoreDef, new FetcherStore('cwa', resourcesStoreDef))
  client.setRequestCount(computed(() => 0))
  client.init()
  return { client, resourcesStore }
}

beforeAll(() => {
  logger.wrapAll()
  logger.mockTypes(() => vi.fn())
})

beforeEach(() => {
  vi.spyOn(processComposables, 'useProcess').mockReturnValue({ isServer: false, isClient: true })
  hub = installFakeEventSource()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('installFakeEventSource', () => {
  test('a message delivered to the hub reaches the client\'s real message handling as a parsed resource', async () => {
    const { resourcesStore } = connect()

    hub.deliver({ '@id': '/component/a', 'html': 'changed' })
    await flushPromises()

    expect(resourcesStore.saveResource).toHaveBeenCalledWith(expect.objectContaining({ resource: { '@id': '/component/a', 'html': 'changed' }, isNew: true }))
  })

  test('the delivered event id is the one the client resumes from when it reconnects', async () => {
    const { client } = connect()

    hub.deliver({ '@id': '/component/a' }, { lastEventId: 'urn:uuid:42' })
    await flushPromises()
    client.init(true)

    expect(hub.instances).toHaveLength(2)
    expect(new URL(hub.latest().url).searchParams.get('last_event_id')).toBe('urn:uuid:42')
    expect(hub.instances[0].readyState).toBe(2)
    expect(hub.latest().withCredentials).toBe(true)
  })

  test('opening and failing the connection drive the client\'s connected state', () => {
    connect()
    const mercureStore = mercureStoreDef.useStore()

    hub.latest().open()
    expect(mercureStore.connected).toBe(true)
    expect(hub.latest().readyState).toBe(1)

    hub.latest().fail()
    expect(mercureStore.connected).toBe(false)
  })

  test('a message delivered with no open connection is refused rather than lost silently', () => {
    expect(() => hub.deliver({ '@id': '/component/a' })).toThrow('No EventSource is open')
  })
})
