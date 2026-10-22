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
import { realtimeView } from '#cwa/resources/realtime-view'
import { useCwaRealtime } from '#cwa/composables/cwa-realtime'
import type Cwa from '#cwa/cwa'
import type Fetcher from '#cwa/api/fetcher/fetcher'
import { installFakeEventSource } from '../../../test/utils/fake-event-source'

const appCwa = vi.hoisted(() => ({ current: undefined as unknown }))
vi.mock('#cwa/composables/cwa', () => ({ useCwa: () => appCwa.current }))

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
    resources: { displayPageIri: computed(() => PAGE), pageDataIriOf: () => computed(() => undefined), findAllPublishableIris: (iri: string) => resourcesStore.findAllPublishableIris(iri) },
    admin: { resourceStackManager: { currentIri: computed(() => undefined), getClosestStackItemByType: () => undefined } },
    auth: { user: { '@id': '/users/me' }, get isAdmin() {
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
  delete (navigator as unknown as Record<string, unknown>).userAgent
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
    Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => '' })
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

  test('another admin with a field focused reaches focusedBy and peers for that resource, through the view an admin loads', async () => {
    const { $cwa } = connect()
    await vi.waitFor(() => expect(usePresence($cwa).active.value).toBe(true))
    const { view } = realtimeView($cwa)
    await vi.waitFor(() => expect(view.value).toBeDefined())

    await deliver({ ...SAM, data: { v: 1, state: 'editing', page: PAGE, component: IRI, field: 'title' } })

    expect(view.value!.focusedBy(IRI, 'title')).toMatchObject([{ user: { id: '/users/sam', name: 'Sam' } }])
    expect(view.value!.peers(IRI)).toMatchObject([{ user: { name: 'Sam' }, state: 'editing', field: 'title' }])
  })

  test('this admin\'s other window over the hub is marked as theirs with its device, and an idle peer as idle', async () => {
    const { $cwa } = connect()
    await vi.waitFor(() => expect(usePresence($cwa).active.value).toBe(true))
    const { view } = realtimeView($cwa)
    await vi.waitFor(() => expect(view.value).toBeDefined())

    await deliver({ ...SAM, clientId: 'b0c1d2e3-f4a5-4b6c-8d7e-8f9a0b1c2d3e', user: { id: '/users/me', name: 'Me' }, data: { v: 1, state: 'editing', page: PAGE, component: IRI, field: 'title', device: 'Safari on iOS' } })
    await deliver({ ...SAM, data: { v: 1, state: 'idle', page: PAGE, component: IRI, device: 'Firefox on Linux' } })

    expect(view.value!.peers(IRI)).toMatchObject([
      { user: { id: '/users/me' }, isSelf: true, idle: false, device: 'Safari on iOS' },
      { user: { id: '/users/sam' }, isSelf: false, idle: true },
    ])
    expect(view.value!.peers(IRI)[1]).not.toHaveProperty('device')
  })

  test('presence names this tab\'s device', async () => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15' })
    const { fetch } = connect()
    await vi.waitFor(() => expect(presenceSent(fetch)).toHaveLength(1))

    expect(presenceSent(fetch)[0]).toMatchObject({ device: 'Safari on macOS' })
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

describe('MercureClient: an app\'s own real-time events (#429)', () => {
  const SAM = { '@type': 'CwaRealtimeEvent', 'v': 1, 'clientId': '7f1e2d3c-4b5a-4c6d-8e7f-9a0b1c2d3e4f', 'user': { id: '/users/sam', name: 'Sam' }, 'event': 'cursor', 'iri': IRI, 'data': { from: 4 }, 'sentAt': '2026-10-21T10:00:01Z', 'expiresAt': '2026-10-21T10:00:46Z' }

  test('a handler registered before the admin code loads receives another admin\'s event over the hub, never this tab\'s own, and nothing reaches the resources', async () => {
    const { $cwa, resourcesStore, writeHeaders } = connect()
    appCwa.current = $cwa
    const handler = vi.fn()
    useCwaRealtime(() => IRI).on('cursor', handler)
    await vi.waitFor(() => expect(writeHeaders['X-CWA-Client-Id']).toBeDefined())
    await vi.waitFor(() => expect(realtimeView($cwa).view.value).toBeDefined())

    await deliver(SAM)
    await deliver({ ...SAM, clientId: writeHeaders['X-CWA-Client-Id'], data: { from: 9 } })

    expect(handler.mock.calls).toStrictEqual([[{ from: 4 }, { user: { id: '/users/sam', name: 'Sam' }, clientId: SAM.clientId, isSelf: false, colour: expect.stringMatching(/^#/), sentAt: SAM.sentAt }]])
    expect(resourcesStore.hasNewResources).toBe(false)
  })

  test('send posts the event from the same client id as this tab\'s writes', async () => {
    const { $cwa, fetch, writeHeaders } = connect()
    appCwa.current = $cwa
    await vi.waitFor(() => expect(usePresence($cwa).active.value).toBe(true))
    await vi.waitFor(() => expect(realtimeView($cwa).view.value).toBeDefined())

    useCwaRealtime(() => IRI).send('cursor', { from: 4 })

    await vi.waitFor(() => expect(fetch.mock.calls.map(([, options]) => options.body).filter(body => body.event === 'cursor')).toStrictEqual([{ clientId: writeHeaders['X-CWA-Client-Id'], event: 'cursor', iri: IRI, data: { from: 4 } }]))
  })

  test('a visitor\'s send posts nothing', async () => {
    const { $cwa, fetch } = connect({ isAdmin: false })
    appCwa.current = $cwa
    await flushPromises()

    useCwaRealtime(() => IRI).send('cursor', { from: 4 })
    await flushPromises()

    expect(fetch).not.toHaveBeenCalled()
  })
})
