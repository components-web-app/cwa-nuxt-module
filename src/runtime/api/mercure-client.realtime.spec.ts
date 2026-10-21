// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { consola as logger } from 'consola'
import { computed, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import type { NuxtApp } from 'nuxt/app'
import { MercureStore } from '#cwa/storage/stores/mercure/mercure-store'
import { ResourcesStore } from '#cwa/storage/stores/resources/resources-store'
import { FetcherStore } from '#cwa/storage/stores/fetcher/fetcher-store'
import * as processComposables from '#cwa/composables/process'
import MercureClient from '#cwa/api/mercure-client'
import type Fetcher from '#cwa/api/fetcher/fetcher'
import { installFakeEventSource } from '../../../test/utils/fake-event-source'

const IRI = '/component/titles/draft'
const OTHER_TAB = { lastWrite: { clientId: 'other-tab', userId: '/_/users/2' } }

let hub: ReturnType<typeof installFakeEventSource>

function connect({ isAdmin = true, realtime }: { isAdmin?: boolean, realtime?: { enabled?: boolean } } = {}) {
  setActivePinia(createPinia())
  const mercureStoreDef = new MercureStore('cwa')
  mercureStoreDef.useStore().hub = 'https://api.test/.well-known/mercure'
  const resourcesStoreDef = new ResourcesStore('cwa')
  const resourcesStore = resourcesStoreDef.useStore()
  resourcesStore.saveResource({ resource: { '@id': IRI, '@type': 'Title', 'title': 'old', 'modifiedAt': '2026-10-21T10:00:00.000000+00:00' } })
  resourcesStore.resetCurrentResources([IRI])
  const admin = ref(isAdmin)
  const writeHeaders: Record<string, string> = {}
  const $cwa = {
    options: { realtime },
    cwaFetch: { writeHeaders },
    auth: { get isAdmin() {
      return computed(() => admin.value)
    } },
  }
  const client = new MercureClient(mercureStoreDef, resourcesStoreDef, new FetcherStore('cwa', resourcesStoreDef), { $cwa } as unknown as NuxtApp)
  client.setRequestCount(computed(() => 0))
  client.init()
  return { client, resourcesStore, writeHeaders, admin }
}

async function deliver(data: unknown) {
  hub.deliver(data)
  await flushPromises()
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

describe('MercureClient: another admin\'s saved drafts for a signed-in admin (#429)', () => {
  test('an admin\'s writes carry this tab\'s client id once Mercure starts', async () => {
    const { writeHeaders } = connect()

    await vi.waitFor(() => expect(writeHeaders['X-CWA-Client-Id']).toMatch(/\S{8,}/))
  })

  test('a draft saved in another tab is applied in place, with no outdated notice', async () => {
    const { resourcesStore, writeHeaders } = connect()
    await vi.waitFor(() => expect(writeHeaders['X-CWA-Client-Id']).toBeDefined())

    await deliver({ '@id': IRI, '@type': 'Title', 'title': 'theirs', 'modifiedAt': '2026-10-21T10:00:01.000000+00:00', '_metadata': OTHER_TAB })

    expect(resourcesStore.current.byId[IRI]?.data?.title).toBe('theirs')
    expect(resourcesStore.hasNewResources).toBe(false)
  })

  test('this tab\'s own save coming back is ignored', async () => {
    const { resourcesStore, writeHeaders } = connect()
    await vi.waitFor(() => expect(writeHeaders['X-CWA-Client-Id']).toBeDefined())

    await deliver({ '@id': IRI, '@type': 'Title', 'title': 'echo', 'modifiedAt': '2026-10-21T10:00:01.000000+00:00', '_metadata': { lastWrite: { clientId: writeHeaders['X-CWA-Client-Id'], userId: '/_/users/1' } } })

    expect(resourcesStore.current.byId[IRI]?.data?.title).toBe('old')
    expect(resourcesStore.hasNewResources).toBe(false)
  })

  test.each([
    { name: 'a visitor', options: { isAdmin: false } },
    { name: 'an admin with real-time turned off', options: { realtime: { enabled: false } } },
  ])('$name still gets the outdated notice and sends no client id', async ({ options }) => {
    const { resourcesStore, writeHeaders } = connect(options)

    await deliver({ '@id': IRI, '@type': 'Title', 'title': 'theirs', 'modifiedAt': '2026-10-21T10:00:01.000000+00:00', '_metadata': OTHER_TAB })

    expect(resourcesStore.current.byId[IRI]?.data?.title).toBe('old')
    expect(resourcesStore.new.byId[IRI]?.resource.title).toBe('theirs')
    expect(writeHeaders).toStrictEqual({})
  })

  test('signing out stops the client id and brings the outdated notice back', async () => {
    const { client, resourcesStore, writeHeaders, admin } = connect()
    await vi.waitFor(() => expect(writeHeaders['X-CWA-Client-Id']).toBeDefined())

    admin.value = false
    client.init(true)
    await flushPromises()

    expect(writeHeaders).toStrictEqual({})
    await deliver({ '@id': IRI, '@type': 'Title', 'title': 'theirs', 'modifiedAt': '2026-10-21T10:00:01.000000+00:00' })
    expect(resourcesStore.new.byId[IRI]?.resource.title).toBe('theirs')
  })

  test('a real-time event is routed away before the check for a current resource', async () => {
    const { resourcesStore, writeHeaders } = connect()
    await vi.waitFor(() => expect(writeHeaders['X-CWA-Client-Id']).toBeDefined())

    await deliver({ '@type': 'CwaRealtimeEvent', '@id': IRI, 'v': 1, 'clientId': 'other-tab', 'user': { id: '/_/users/2', name: 'Sam' }, 'event': 'presence', 'iri': IRI, 'data': {}, 'sentAt': '2026-10-21T10:00:01Z', 'expiresAt': '2026-10-21T10:00:46Z' })

    expect(resourcesStore.current.byId[IRI]?.data).toEqual(expect.objectContaining({ '@type': 'Title', 'title': 'old' }))
    expect(resourcesStore.hasNewResources).toBe(false)
  })

  test('a reconnect\'s revalidation is applied in place for an admin', async () => {
    const { client, resourcesStore, writeHeaders } = connect()
    await vi.waitFor(() => expect(writeHeaders['X-CWA-Client-Id']).toBeDefined())
    const fetchResource = vi.fn().mockResolvedValue({ '@id': IRI, '@type': 'Title', 'title': 'revalidated', 'modifiedAt': '2026-10-21T10:00:02.000000+00:00' })
    client.setFetcher({ fetchResource } as unknown as Fetcher)

    hub.latest().open()
    hub.latest().fail()
    hub.latest().open()
    await flushPromises()

    expect(fetchResource).toHaveBeenCalledOnce()
    expect(resourcesStore.current.byId[IRI]?.data?.title).toBe('revalidated')
    expect(resourcesStore.hasNewResources).toBe(false)
  })
})

describe('MercureClient: messages older than the stored copy (#429)', () => {
  test.each([
    { name: 'older than the stored copy is dropped', modifiedAt: '2026-10-21T09:59:59.000000+00:00', held: false },
    { name: 'newer than the stored copy is kept', modifiedAt: '2026-10-21T10:00:00.500000+00:00', held: true },
    { name: 'with the same modifiedAt is kept', modifiedAt: '2026-10-21T10:00:00.000000+00:00', held: true },
    { name: 'without a modifiedAt is kept', modifiedAt: undefined, held: true },
  ])('an update $name', async ({ modifiedAt, held }) => {
    const { resourcesStore } = connect({ isAdmin: false })

    await deliver({ '@id': IRI, '@type': 'Title', 'title': 'theirs', modifiedAt })

    expect(!!resourcesStore.new.byId[IRI]).toBe(held)
  })
})
