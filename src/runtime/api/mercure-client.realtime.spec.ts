// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { consola as logger } from 'consola'
import { computed, ref, shallowRef } from 'vue'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import type { NuxtApp } from 'nuxt/app'
import { MercureStore } from '#cwa/storage/stores/mercure/mercure-store'
import { ResourcesStore } from '#cwa/storage/stores/resources/resources-store'
import { FetcherStore } from '#cwa/storage/stores/fetcher/fetcher-store'
import * as processComposables from '#cwa/composables/process'
import MercureClient from '#cwa/api/mercure-client'
import { usePresence } from '#cwa/admin/presence'
import type Cwa from '#cwa/cwa'
import type Fetcher from '#cwa/api/fetcher/fetcher'
import { installFakeEventSource } from '../../../test/utils/fake-event-source'

const IRI = '/component/titles/draft'
const PAGE = '/_/pages/home'
const OTHER_TAB = { lastWrite: { clientId: 'other-tab', userId: '/_/users/2' } }

let hub: ReturnType<typeof installFakeEventSource>
const admins: Ref<boolean>[] = []

function connect({ isAdmin = true, realtime, hub: hubUrl = 'https://api.test/.well-known/mercure' }: { isAdmin?: boolean, realtime?: { enabled?: boolean }, hub?: string } = {}) {
  setActivePinia(createPinia())
  const mercureStoreDef = new MercureStore('cwa')
  mercureStoreDef.useStore().hub = hubUrl
  const resourcesStoreDef = new ResourcesStore('cwa')
  const resourcesStore = resourcesStoreDef.useStore()
  resourcesStore.saveResource({ resource: { '@id': IRI, '@type': 'Title', 'title': 'old' } })
  resourcesStore.resetCurrentResources([IRI])
  const admin = ref(isAdmin)
  admins.push(admin)
  const writeHeaders: Record<string, string> = {}
  const fetch = vi.fn().mockResolvedValue(undefined)
  const $cwa = {
    realtimeConfig: realtime,
    apiUrlBase: 'https://api.test',
    cwaFetch: { writeHeaders, fetch },
    resources: { displayPageIri: computed(() => PAGE), pageDataIriOf: () => computed(() => undefined) },
    admin: { resourceStackManager: { currentIri: computed(() => undefined), getClosestStackItemByType: () => undefined } },
    auth: { get isAdmin() {
      return computed(() => admin.value)
    } },
  }
  const $router = { currentRoute: shallowRef({ path: '/', meta: {} }) }
  const client = new MercureClient(mercureStoreDef, resourcesStoreDef, new FetcherStore('cwa', resourcesStoreDef), { $cwa, $router } as unknown as NuxtApp)
  client.setRequestCount(computed(() => 0))
  client.init()
  return { client, resourcesStore, writeHeaders, admin, fetch, $cwa: $cwa as unknown as Cwa }
}

function presenceSent(fetch: ReturnType<typeof vi.fn>) {
  return fetch.mock.calls.filter(([path]) => path === '/_/realtime').map(([, options]) => options.body.data)
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

afterEach(async () => {
  admins.splice(0).forEach((admin) => {
    admin.value = false
  })
  await flushPromises()
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

    await deliver({ '@id': IRI, '@type': 'Title', 'title': 'theirs', '_metadata': OTHER_TAB })

    expect(resourcesStore.current.byId[IRI]?.data?.title).toBe('theirs')
    expect(resourcesStore.hasNewResources).toBe(false)
  })

  test('this tab\'s own save coming back is ignored', async () => {
    const { resourcesStore, writeHeaders } = connect()
    await vi.waitFor(() => expect(writeHeaders['X-CWA-Client-Id']).toBeDefined())

    await deliver({ '@id': IRI, '@type': 'Title', 'title': 'echo', '_metadata': { lastWrite: { clientId: writeHeaders['X-CWA-Client-Id'], userId: '/_/users/1' } } })

    expect(resourcesStore.current.byId[IRI]?.data?.title).toBe('old')
    expect(resourcesStore.hasNewResources).toBe(false)
  })

  test.each([
    { name: 'a visitor', options: { isAdmin: false } },
    { name: 'an admin with real-time turned off', options: { realtime: { enabled: false } } },
  ])('$name still gets the outdated notice and sends no client id', async ({ options }) => {
    const { resourcesStore, writeHeaders } = connect(options)

    await deliver({ '@id': IRI, '@type': 'Title', 'title': 'theirs', '_metadata': OTHER_TAB })

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
    await deliver({ '@id': IRI, '@type': 'Title', 'title': 'theirs' })
    expect(resourcesStore.new.byId[IRI]?.resource.title).toBe('theirs')
  })

  test('an admin who signs in after Mercure started gets co-editing without a reload', async () => {
    const { resourcesStore, writeHeaders, admin } = connect({ isAdmin: false })
    await flushPromises()
    expect(writeHeaders).toStrictEqual({})

    admin.value = true
    await vi.waitFor(() => expect(writeHeaders['X-CWA-Client-Id']).toMatch(/\S{8,}/))

    await deliver({ '@id': IRI, '@type': 'Title', 'title': 'theirs', '_metadata': OTHER_TAB })
    expect(resourcesStore.current.byId[IRI]?.data?.title).toBe('theirs')
    expect(resourcesStore.hasNewResources).toBe(false)
  })

  test('signing out while co-editing is still loading leaves it off', async () => {
    const { writeHeaders, admin } = connect()

    admin.value = false
    await flushPromises()

    expect(writeHeaders).toStrictEqual({})
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
    const fetchResource = vi.fn().mockResolvedValue({ '@id': IRI, '@type': 'Title', 'title': 'revalidated' })
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
  beforeEach(() => {
    const parse = Date.parse
    vi.spyOn(Date, 'parse').mockImplementation(value => /\.\d{4,}/.test(value) ? Number.NaN : parse(value))
  })

  const STORED_AT = '2026-10-21T10:00:00.000+00:00'

  test.each([
    { name: 'older than the stored copy is dropped', storedAt: STORED_AT, at: '2026-10-21T09:59:59.999+00:00', held: false },
    { name: 'newer than the stored copy is kept', storedAt: STORED_AT, at: '2026-10-21T10:00:00.001+00:00', held: true },
    { name: 'with the same lastWrite.at is kept', storedAt: STORED_AT, at: STORED_AT, held: true },
    { name: 'with microseconds older than the stored copy is dropped', storedAt: STORED_AT, at: '2026-10-21T09:59:59.999999+00:00', held: false },
    { name: 'without a lastWrite.at is kept', storedAt: STORED_AT, at: undefined, held: true },
    { name: 'is kept when the stored copy has no lastWrite.at', storedAt: undefined, at: '2026-10-21T09:59:59.999+00:00', held: true },
  ])('an update $name', async ({ storedAt, at, held }) => {
    const { resourcesStore } = connect({ isAdmin: false })
    resourcesStore.saveResource({ resource: { '@id': IRI, '@type': 'Title', 'title': 'old', '_metadata': { persisted: true, lastWrite: storedAt ? { at: storedAt } : undefined } } })

    await deliver({ '@id': IRI, '@type': 'Title', 'title': 'theirs', '_metadata': { persisted: true, lastWrite: at ? { at, clientId: 'other-tab', userId: '/_/users/2' } : undefined } })

    expect(!!resourcesStore.new.byId[IRI]).toBe(held)
  })

  test.each([
    { name: 'an older modifiedAt does not drop a newer write', modifiedAt: '2026-10-21T09:00:00+00:00', at: '2026-10-21T10:00:00.001+00:00', held: true },
    { name: 'a newer modifiedAt does not keep an older write', modifiedAt: '2026-10-21T11:00:00+00:00', at: '2026-10-21T09:59:59.999+00:00', held: false },
  ])('ordering ignores modifiedAt: $name', async ({ modifiedAt, at, held }) => {
    const { resourcesStore } = connect({ isAdmin: false })
    resourcesStore.saveResource({ resource: { '@id': IRI, '@type': 'Title', 'title': 'old', 'modifiedAt': '2026-10-21T10:00:00+00:00', '_metadata': { persisted: true, lastWrite: { at: STORED_AT } } } })

    await deliver({ '@id': IRI, '@type': 'Title', 'title': 'theirs', modifiedAt, '_metadata': { persisted: true, lastWrite: { at, clientId: 'other-tab', userId: '/_/users/2' } } })

    expect(!!resourcesStore.new.byId[IRI]).toBe(held)
  })
})

describe('MercureClient: presence for a signed-in admin (#429)', () => {
  const SAM = { '@type': 'CwaRealtimeEvent', 'v': 1, 'clientId': '7f1e2d3c-4b5a-4c6d-8e7f-9a0b1c2d3e4f', 'user': { id: '/users/sam', name: 'Sam' }, 'event': 'presence', 'iri': null, 'data': { v: 1, state: 'viewing', page: PAGE }, 'sentAt': '2026-10-21T10:00:01Z', 'expiresAt': '2026-10-21T10:00:46Z' }

  test('an admin\'s Mercure start announces the page on screen with a hello, from the same client id as their writes', async () => {
    const { fetch, writeHeaders } = connect()

    await vi.waitFor(() => expect(presenceSent(fetch)).toStrictEqual([{ v: 1, page: PAGE, state: 'viewing', hello: true }]))
    expect(fetch.mock.calls[0]![1].body.clientId).toBe(writeHeaders['X-CWA-Client-Id'])
  })

  test.each([
    { name: 'a visitor', options: { isAdmin: false } },
    { name: 'an admin with real-time turned off', options: { realtime: { enabled: false } } },
    { name: 'an admin when Mercure has no hub', options: { hub: '' } },
  ])('$name sends no presence', async ({ options }) => {
    const { fetch, $cwa } = connect(options)
    await flushPromises()

    expect(presenceSent(fetch)).toStrictEqual([])
    expect(usePresence($cwa).active.value).toBe(false)
  })

  test('signing out stops presence', async () => {
    const { admin, $cwa } = connect()
    await vi.waitFor(() => expect(usePresence($cwa).active.value).toBe(true))

    admin.value = false
    await flushPromises()

    expect(usePresence($cwa).active.value).toBe(false)
  })

  test('another admin\'s presence over the hub reaches the peers, and nothing reaches the resources', async () => {
    const { $cwa, resourcesStore } = connect()
    await vi.waitFor(() => expect(usePresence($cwa).active.value).toBe(true))

    await deliver(SAM)

    expect(usePresence($cwa).onThisPage.value).toMatchObject([{ user: { name: 'Sam' }, page: PAGE }])
    expect(resourcesStore.hasNewResources).toBe(false)
  })

  test('a lost connection pauses presence; reconnecting says hello again', async () => {
    const { $cwa, fetch } = connect()
    await vi.waitFor(() => expect(presenceSent(fetch)).toHaveLength(1))
    hub.latest().open()

    hub.latest().fail()
    expect(usePresence($cwa).paused.value).toBe(true)

    hub.latest().open()
    expect(usePresence($cwa).paused.value).toBe(false)
    await vi.waitFor(() => expect(presenceSent(fetch)).toHaveLength(2))
    expect(presenceSent(fetch)[1]).toMatchObject({ hello: true })
  })
})
