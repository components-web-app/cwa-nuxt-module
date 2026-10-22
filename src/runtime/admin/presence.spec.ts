// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, nextTick, reactive, ref, shallowRef } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { consola as logger } from 'consola'
import type { Router } from 'vue-router'
import { ResourcesStore } from '../storage/stores/resources/resources-store'
import type { CwaResourcesStoreInterface } from '../storage/stores/resources/resources-store'
import { getResourceTypeFromIri } from '../resources/resource-utils'
import type { CwaResourceTypes } from '../resources/resource-utils'
import CwaFetch from '../api/fetcher/cwa-fetch'
import * as processComposables from '../composables/process'
import { deviceLabel, Presence, presenceColour, SELF_COLOUR, usePresence } from './presence'
import type Cwa from '#cwa/cwa'

const CLIENT_ID = '0b3c8f0e-5a7d-4d1e-9f2a-1c2b3d4e5f60'
const PEER_ID = '7f1e2d3c-4b5a-4c6d-8e7f-9a0b1c2d3e4f'
const HOME = '/_/pages/home'
const ABOUT = '/_/pages/about'
const DRAFT = '/component/titles/draft'
const LIVE = '/component/titles/live'
const POSITION = '/_/component_positions/hero'
const ME = '/users/me'
const CHROME_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'

function setNavigator(values: { userAgent?: string, userAgentData?: unknown }) {
  for (const [key, value] of Object.entries(values)) {
    Object.defineProperty(navigator, key, { configurable: true, get: () => value })
  }
}

function setVisibility(visibility: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
  document.dispatchEvent(new Event('visibilitychange'))
}

let store: CwaResourcesStoreInterface

function build(options: { page?: string, routePath?: string, fetch?: ReturnType<typeof vi.fn> } = {}) {
  const { routePath = '/home', fetch = vi.fn().mockResolvedValue(undefined) } = options
  const displayPageIri = ref<string | undefined>('page' in options ? options.page : HOME)
  const isLoading = ref(false)
  const route = shallowRef<{ path: string, meta: Record<string, any> }>({ path: routePath, meta: {} })
  const stack = shallowRef<{ iri: string }[]>([])
  const pageDataByPosition: Record<string, string> = {}
  const updating = reactive(new Set<string>())
  const $cwa = {
    apiUrlBase: 'https://api.test/_api',
    auth: { user: { '@id': ME } },
    cwaFetch: { fetch },
    resourcesManager: { isUpdating: (iri: string) => updating.has(iri) },
    resources: {
      findAllPublishableIris: (iri: string) => store.findAllPublishableIris(iri),
      displayPageIri: computed(() => displayPageIri.value),
      isLoading: computed(() => isLoading.value),
      pageDataIriOf: (iri: string) => computed(() => pageDataByPosition[iri]),
    },
    admin: {
      resourceStackManager: {
        currentIri: computed(() => stack.value[0]?.iri),
        getClosestStackItemByType: (type: CwaResourceTypes) => stack.value.find(item => getResourceTypeFromIri(item.iri) === type)?.iri,
      },
    },
  }
  const router = { currentRoute: computed(() => route.value) }
  const presence = new Presence($cwa as unknown as Cwa, store, router as unknown as Router, CLIENT_ID)
  const sent = () => fetch.mock.calls.map(([, options]) => options.body.data)
  return { presence, $cwa: $cwa as unknown as Cwa, fetch, sent, displayPageIri, isLoading, route, stack, pageDataByPosition, updating }
}

function peerEvent(data: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  return {
    '@type': 'CwaRealtimeEvent',
    'v': 1,
    'clientId': PEER_ID,
    'user': { id: '/users/sam', name: 'Sam' },
    'event': 'presence',
    'iri': null,
    'data': { v: 1, state: 'viewing', page: HOME, ...data },
    'sentAt': '2026-10-21T10:00:00.000000+00:00',
    'expiresAt': '2026-10-21T10:00:45.000000+00:00',
    ...overrides,
  }
}

function held() {
  let settle: { resolve: (value?: unknown) => void, reject: (error: unknown) => void } = { resolve: () => {}, reject: () => {} }
  const promise = new Promise((resolve, reject) => {
    settle = { resolve, reject }
  })
  return { promise, ...settle }
}

function httpError(status: number, headers: Record<string, string> = {}) {
  return Object.assign(new Error(`HTTP ${status}`), { response: new Response(null, { status, headers }) })
}

async function settle() {
  await nextTick()
  await vi.advanceTimersByTimeAsync(0)
}

const started: Presence[] = []

function start(built: ReturnType<typeof build>, connected = true) {
  built.presence.start(connected)
  started.push(built.presence)
  return built
}

beforeAll(() => {
  logger.wrapAll()
  logger.mockTypes(() => vi.fn())
})

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2030-01-01T00:00:00Z') })
  setActivePinia(createPinia())
  store = new ResourcesStore('test').useStore()
  setNavigator({ userAgent: '', userAgentData: undefined })
})

afterEach(() => {
  started.splice(0).forEach(presence => presence.stop())
  delete (navigator as unknown as Record<string, unknown>).userAgent
  delete (navigator as unknown as Record<string, unknown>).userAgentData
  delete (document as unknown as Record<string, unknown>).visibilityState
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('Presence: what this tab sends (#429)', () => {
  test('starting announces the page on screen with a hello, from this tab\'s client id', async () => {
    const { fetch } = start(build())
    await settle()

    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledWith('/_/realtime', expect.objectContaining({
      method: 'POST',
      body: { clientId: CLIENT_ID, event: 'presence', data: { v: 1, page: HOME, state: 'viewing', hello: true } },
    }))
  })

  test('with no page on screen the route path is the page', async () => {
    const { sent } = start(build({ page: undefined, routePath: '/not-loaded' }))
    await settle()

    expect(sent()[0]).toMatchObject({ page: '/not-loaded', state: 'viewing' })
  })

  test('on an admin page the route path is the page, not the CWA page left behind', async () => {
    const built = build()
    built.route.value = { path: '/_cwa/pages', meta: { cwa: { admin: true } } }
    const { sent } = start(built)
    await settle()

    expect(sent()[0]).toMatchObject({ page: '/_cwa/pages' })
  })

  test('coming back from an admin page keeps reporting the admin page until the new CWA page is on screen, never the page left behind', async () => {
    const built = build()
    built.route.value = { path: '/_cwa/routes', meta: { cwa: { admin: true } } }
    start(built)
    await settle()

    built.isLoading.value = true
    built.route.value = { path: '/about', meta: {} }
    await vi.advanceTimersByTimeAsync(1_000)
    expect(built.sent()).toHaveLength(1)

    built.displayPageIri.value = ABOUT
    built.isLoading.value = false
    await vi.advanceTimersByTimeAsync(250)
    expect(built.sent().map(data => data.page)).toStrictEqual(['/_cwa/routes', ABOUT])
  })

  test('coming back from an admin page to the page left behind reports it once it has loaded', async () => {
    const built = build()
    built.route.value = { path: '/_cwa/routes', meta: { cwa: { admin: true } } }
    start(built)
    await settle()

    built.isLoading.value = true
    built.route.value = { path: '/home', meta: {} }
    await vi.advanceTimersByTimeAsync(1_000)
    built.isLoading.value = false
    await vi.advanceTimersByTimeAsync(250)

    expect(built.sent().map(data => data.page)).toStrictEqual(['/_cwa/routes', HOME])
  })

  test('a cached page shown while it is still revalidating is reported at once', async () => {
    const built = start(build())
    await settle()

    built.isLoading.value = true
    built.displayPageIri.value = ABOUT
    await vi.advanceTimersByTimeAsync(250)

    expect(built.sent()[1]).toMatchObject({ page: ABOUT })
  })

  test('a change of the page on screen sends viewing with the new page', async () => {
    const built = start(build())
    await settle()

    built.displayPageIri.value = ABOUT
    await vi.advanceTimersByTimeAsync(250)

    expect(built.sent()).toHaveLength(2)
    expect(built.sent()[1]).toStrictEqual({ v: 1, page: ABOUT, state: 'viewing' })
  })

  test('selecting a draft sends selected with its published IRI and position; deselecting goes back to viewing', async () => {
    store.saveResource({ resource: { '@id': LIVE, '@type': 'Title', '_metadata': { persisted: true, publishable: { published: true } } } as never })
    store.saveResource({ resource: { '@id': DRAFT, '@type': 'Title', 'publishedResource': LIVE, '_metadata': { persisted: true, publishable: { published: false } } } as never })
    const built = start(build())
    await settle()

    built.stack.value = [{ iri: DRAFT }, { iri: POSITION }]
    await vi.advanceTimersByTimeAsync(250)
    expect(built.sent()[1]).toStrictEqual({ v: 1, page: HOME, state: 'selected', component: LIVE, componentPosition: POSITION })

    built.stack.value = []
    await vi.advanceTimersByTimeAsync(250)
    expect(built.sent()[2]).toStrictEqual({ v: 1, page: HOME, state: 'viewing' })
  })

  test('a component in a dynamic position adds the page data at the position\'s depth', async () => {
    store.saveResource({ resource: { '@id': POSITION, '@type': 'ComponentPosition', '_metadata': { persisted: true, isDynamicPosition: true } } as never })
    const built = start(build())
    built.pageDataByPosition[POSITION] = '/page_data/blog/first'
    await settle()

    built.stack.value = [{ iri: LIVE }, { iri: POSITION }]
    await vi.advanceTimersByTimeAsync(250)

    expect(built.sent()[1]).toMatchObject({ state: 'selected', componentPosition: POSITION, pageData: '/page_data/blog/first' })
  })

  test('changes are sent at most every 250 ms, the last one carrying the newest state', async () => {
    const built = start(build())
    await settle()

    built.displayPageIri.value = ABOUT
    await nextTick()
    built.displayPageIri.value = '/_/pages/contact'
    await nextTick()
    built.displayPageIri.value = '/_/pages/team'
    await vi.advanceTimersByTimeAsync(249)
    expect(built.sent()).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(built.sent()).toHaveLength(2)
    expect(built.sent()[1]).toMatchObject({ page: '/_/pages/team' })
  })

  test('the current state is sent again every 15 seconds', async () => {
    const built = start(build())
    await settle()

    await vi.advanceTimersByTimeAsync(14_999)
    expect(built.sent()).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(2)
    expect(built.sent()).toHaveLength(2)
    expect(built.sent()[1]).toStrictEqual({ v: 1, page: HOME, state: 'viewing' })
  })

  test('a peer\'s hello is answered with the current state after a random jitter of up to 2 seconds', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const built = start(build())
    await settle()

    built.presence.receive(peerEvent({ hello: true }))
    await vi.advanceTimersByTimeAsync(999)
    expect(built.sent()).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(2)
    expect(built.sent()).toHaveLength(2)
    expect(built.sent()[1]).toStrictEqual({ v: 1, page: HOME, state: 'viewing' })
  })

  test('leaving the page sends left as a text/plain beacon', async () => {
    const sendBeacon = vi.fn(() => true)
    vi.stubGlobal('navigator', { ...navigator, sendBeacon })
    start(build())
    await settle()

    window.dispatchEvent(new Event('pagehide'))

    expect(sendBeacon).toHaveBeenCalledOnce()
    const [url, blob] = sendBeacon.mock.calls[0] as unknown as [string, Blob]
    expect(url).toBe('https://api.test/_api/_/realtime')
    expect(blob.type).toBe('text/plain')
    expect(JSON.parse(await blob.text())).toStrictEqual({ clientId: CLIENT_ID, event: 'presence', data: { v: 1, page: HOME, state: 'left' } })
  })

  test('a page restored from the back/forward cache says hello again at once', async () => {
    vi.stubGlobal('navigator', { ...navigator, sendBeacon: vi.fn(() => true) })
    const built = start(build())
    await settle()

    window.dispatchEvent(new Event('pagehide'))
    window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: false }))
    await vi.advanceTimersByTimeAsync(250)
    expect(built.sent()).toHaveLength(1)

    window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }))
    await vi.advanceTimersByTimeAsync(250)
    expect(built.sent()).toHaveLength(2)
    expect(built.sent()[1]).toStrictEqual({ v: 1, page: HOME, state: 'viewing', hello: true })
  })

  test('only one update is in flight at a time, and the newest state follows once it is answered', async () => {
    const first = held()
    const fetch = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined)
    const built = start(build({ fetch }))
    await settle()

    built.displayPageIri.value = ABOUT
    await nextTick()
    built.displayPageIri.value = '/_/pages/team'
    await vi.advanceTimersByTimeAsync(1_000)
    expect(fetch).toHaveBeenCalledOnce()

    first.resolve()
    await settle()
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(built.sent()[1]).toStrictEqual({ v: 1, page: '/_/pages/team', state: 'viewing' })
  })

  test('stop() sends nothing more and removes the timers and the pagehide listener', async () => {
    const sendBeacon = vi.fn(() => true)
    vi.stubGlobal('navigator', { ...navigator, sendBeacon })
    const built = start(build())
    await settle()

    built.presence.stop()
    built.displayPageIri.value = ABOUT
    window.dispatchEvent(new Event('pagehide'))
    await vi.advanceTimersByTimeAsync(60_000)

    expect(built.sent()).toHaveLength(1)
    expect(sendBeacon).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('Presence: editing (#429)', () => {
  const FIELD = Symbol('title field')
  const OTHER_FIELD = Symbol('subtitle field')

  function selectDraft() {
    store.saveResource({ resource: { '@id': LIVE, '@type': 'Title', 'draftResource': DRAFT, '_metadata': { persisted: true, publishable: { published: true } } } as never })
    store.saveResource({ resource: { '@id': DRAFT, '@type': 'Title', 'publishedResource': LIVE, '_metadata': { persisted: true, publishable: { published: false } } } as never })
    store.saveResource({ resource: { '@id': POSITION, '@type': 'ComponentPosition', 'componentGroup': '/_/component_groups/top', '_metadata': { persisted: true } } as never })
    const built = build()
    built.stack.value = [{ iri: DRAFT }, { iri: POSITION }]
    return start(built)
  }

  test('focusing a field of the selected component sends editing with that field; blurring it goes back to selected', async () => {
    const built = selectDraft()
    await settle()
    const { focus, blur } = usePresence(built.$cwa)

    focus(FIELD, DRAFT, 'title')
    await vi.advanceTimersByTimeAsync(250)
    expect(built.sent().at(-1)).toStrictEqual({ v: 1, page: HOME, state: 'editing', component: LIVE, componentPosition: POSITION, field: 'title' })

    blur(FIELD)
    await vi.advanceTimersByTimeAsync(250)
    expect(built.sent().at(-1)).toStrictEqual({ v: 1, page: HOME, state: 'selected', component: LIVE, componentPosition: POSITION })
  })

  test('a field of the published version counts for its selected draft, draft and published being one resource', async () => {
    const built = selectDraft()
    await settle()

    usePresence(built.$cwa).focus(FIELD, LIVE, 'title')
    await vi.advanceTimersByTimeAsync(250)

    expect(built.sent().at(-1)).toMatchObject({ state: 'editing', field: 'title' })
  })

  test('a field focused on a resource that is not selected sends no editing', async () => {
    const built = selectDraft()
    await settle()

    usePresence(built.$cwa).focus(FIELD, '/component/titles/another', 'title')
    await vi.advanceTimersByTimeAsync(1_000)

    expect(built.sent().map(data => data.state)).toStrictEqual(['selected'])
  })

  test('a blur of another field leaves the focused field, and the latest focus wins', async () => {
    const built = selectDraft()
    await settle()
    const { focus, blur } = usePresence(built.$cwa)

    focus(OTHER_FIELD, DRAFT, 'subtitle')
    focus(FIELD, DRAFT, 'title')
    blur(OTHER_FIELD)
    await vi.advanceTimersByTimeAsync(250)

    expect(built.sent().at(-1)).toMatchObject({ state: 'editing', field: 'title' })
  })

  test('a blur after the selection has gone sends viewing', async () => {
    const built = selectDraft()
    await settle()
    const { focus, blur } = usePresence(built.$cwa)
    focus(FIELD, DRAFT, 'title')
    await vi.advanceTimersByTimeAsync(250)

    built.stack.value = []
    blur(FIELD)
    await vi.advanceTimersByTimeAsync(250)

    expect(built.sent().at(-1)).toStrictEqual({ v: 1, page: HOME, state: 'viewing' })
  })

  test.each([
    { name: 'a save waiting or in flight for the draft', iri: DRAFT },
    { name: 'a save for its published version', iri: LIVE },
    { name: 'a save for its position', iri: POSITION },
    { name: 'a write queued to its position\'s group', iri: '/_/component_groups/top' },
  ])('$name sends editing with no field until it is done', async ({ iri }) => {
    const built = selectDraft()
    await settle()

    built.updating.add(iri)
    await vi.advanceTimersByTimeAsync(250)
    expect(built.sent().at(-1)).toStrictEqual({ v: 1, page: HOME, state: 'editing', component: LIVE, componentPosition: POSITION })

    built.updating.delete(iri)
    await vi.advanceTimersByTimeAsync(250)
    expect(built.sent().at(-1)).toMatchObject({ state: 'selected' })
  })

  test('moving focus from one field to another, each in its own microtask, sends the new field and never selected in between', async () => {
    const built = selectDraft()
    await settle()
    const { focus, blur } = usePresence(built.$cwa)
    focus(OTHER_FIELD, DRAFT, 'title')
    await vi.advanceTimersByTimeAsync(1_000)

    const loaded = Promise.resolve()
    void loaded.then(() => blur(OTHER_FIELD))
    void loaded.then(() => focus(FIELD, DRAFT, 'subtitle'))
    await vi.advanceTimersByTimeAsync(1_000)

    expect(built.sent().map(data => `${data.state}:${data.field ?? ''}`)).toStrictEqual(['selected:', 'editing:title', 'editing:subtitle'])
  })

  test('a waiting save handed over to its request a microtask later sends no selected in between', async () => {
    const built = selectDraft()
    await settle()
    built.updating.add(DRAFT)
    await vi.advanceTimersByTimeAsync(1_000)

    built.updating.delete(DRAFT)
    await Promise.resolve()
    built.updating.add(DRAFT)
    await vi.advanceTimersByTimeAsync(1_000)

    expect(built.sent().map(data => data.state)).toStrictEqual(['selected', 'editing'])
  })

  test('a save for another resource sends no editing', async () => {
    const built = selectDraft()
    await settle()

    built.updating.add('/component/titles/another')
    await vi.advanceTimersByTimeAsync(1_000)

    expect(built.sent().map(data => data.state)).toStrictEqual(['selected'])
  })
})

describe('Presence: when the API refuses (#429)', () => {
  test.each([
    { name: 'seconds', headers: { 'Retry-After': '5' } },
    { name: 'an HTTP date measured against the response\'s own Date', headers: { 'Retry-After': 'Wed, 01 Jan 2020 00:00:05 GMT', 'Date': 'Wed, 01 Jan 2020 00:00:00 GMT' } },
  ])('a 429 with Retry-After in $name sends nothing until it has passed', async ({ headers }) => {
    const fetch = vi.fn().mockRejectedValueOnce(httpError(429, headers)).mockResolvedValue(undefined)
    const built = start(build({ fetch }))
    await settle()

    await vi.advanceTimersByTimeAsync(4_999)
    expect(fetch).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(1)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(built.sent()[1]).toMatchObject({ hello: true })
  })

  test('a change while a request is in flight still waits for its Retry-After', async () => {
    const first = held()
    const fetch = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined)
    const built = start(build({ fetch }))
    await settle()

    await vi.advanceTimersByTimeAsync(50)
    built.displayPageIri.value = ABOUT
    first.reject(httpError(429, { 'Retry-After': '5' }))
    await vi.advanceTimersByTimeAsync(4_999)
    expect(fetch).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(1)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(built.sent()[1]).toStrictEqual({ v: 1, page: ABOUT, state: 'viewing', hello: true })
  })

  test('a change while a request is in flight still waits for the backoff after a 5xx', async () => {
    const first = held()
    const fetch = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined)
    const built = start(build({ fetch }))
    await settle()

    await vi.advanceTimersByTimeAsync(50)
    built.displayPageIri.value = ABOUT
    first.reject(httpError(503))
    await vi.advanceTimersByTimeAsync(999)
    expect(fetch).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(1)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  test('a 5xx or a network error backs off exponentially, capped at 60 seconds', async () => {
    const fetch = vi.fn().mockRejectedValue(httpError(503))
    start(build({ fetch }))
    await settle()
    const gaps: number[] = []
    let last = Date.now()
    while (gaps.length < 8) {
      const calls = fetch.mock.calls.length
      await vi.advanceTimersByTimeAsync(1_000)
      if (fetch.mock.calls.length > calls) {
        gaps.push(Date.now() - last)
        last = Date.now()
      }
      if (gaps.length === 3) {
        fetch.mockRejectedValue(new TypeError('Failed to fetch'))
      }
    }

    expect(gaps).toStrictEqual([1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 60_000, 60_000])
  })

  test.each([404, 405])('a %i stops presence for the session and warns once', async (status) => {
    const fetch = vi.fn().mockRejectedValue(httpError(status))
    const built = start(build({ fetch }))
    await settle()

    built.presence.start(true)
    built.displayPageIri.value = ABOUT
    await vi.advanceTimersByTimeAsync(60_000)

    expect(fetch).toHaveBeenCalledOnce()
    expect(logger.warn).toHaveBeenCalledOnce()
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Real-time presence is turned off on the API'))
    expect(usePresence(built.$cwa).active.value).toBe(false)
  })

  test.each([413, 415, 422])('a %i warns once and drops that message, and later sends still go out', async (status) => {
    const fetch = vi.fn().mockRejectedValue(httpError(status))
    const built = start(build({ fetch }))
    await settle()

    built.displayPageIri.value = ABOUT
    await vi.advanceTimersByTimeAsync(250)

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(built.sent()[1]).toStrictEqual({ v: 1, page: ABOUT, state: 'viewing' })
    expect(logger.warn).toHaveBeenCalledOnce()
  })

  test.each([401, 403])('a %i stops presence quietly until it is started again', async (status) => {
    const fetch = vi.fn().mockRejectedValueOnce(httpError(status)).mockResolvedValue(undefined)
    const built = start(build({ fetch }))
    await settle()

    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetch).toHaveBeenCalledOnce()
    expect(logger.warn).not.toHaveBeenCalled()

    built.presence.start(true)
    await settle()
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  test('a 401 never reaches CwaFetch\'s session-end handler', async () => {
    vi.spyOn(processComposables, 'useProcess').mockReturnValue({ isServer: false, isClient: true })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401 })))
    const cwaFetch = new CwaFetch('https://api.test/_api')
    const sessionEnd = vi.fn()
    cwaFetch.onUnauthorised(sessionEnd)
    const built = build({ fetch: cwaFetch.fetch as never })
    ;(built.$cwa as unknown as { cwaFetch: CwaFetch }).cwaFetch = cwaFetch
    start(built)
    await settle()

    expect(globalThis.fetch).toHaveBeenCalledOnce()
    expect(sessionEnd).not.toHaveBeenCalled()

    await cwaFetch.fetch('/me').catch(() => undefined)
    expect(sessionEnd).toHaveBeenCalledOnce()
  })
})

describe('Presence: peers (#429)', () => {
  test('this tab\'s own events are ignored', async () => {
    const built = start(build())
    built.presence.receive(peerEvent({}, { clientId: CLIENT_ID }))

    expect(usePresence(built.$cwa).onThisPage.value).toStrictEqual([])
  })

  test('a peer on the page on screen is on this page; one on another page is elsewhere', async () => {
    const built = start(build())
    await settle()
    built.presence.receive(peerEvent({ page: HOME, state: 'selected', component: LIVE, componentPosition: POSITION }))
    built.presence.receive(peerEvent({ page: ABOUT }, { clientId: 'b0c1d2e3-f4a5-4b6c-8d7e-8f9a0b1c2d3e', user: { id: '/users/alex', name: 'Alex' } }))
    const { onThisPage, elsewhere } = usePresence(built.$cwa)

    expect(onThisPage.value).toMatchObject([{ clientId: PEER_ID, user: { id: '/users/sam', name: 'Sam' }, state: 'selected', page: HOME, component: LIVE, componentPosition: POSITION }])
    expect(elsewhere.value).toMatchObject([{ user: { name: 'Alex' }, page: ABOUT }])

    built.displayPageIri.value = ABOUT
    await nextTick()
    expect(onThisPage.value).toMatchObject([{ user: { name: 'Alex' } }])
  })

  test('a peer expires at its local receive time plus the event\'s own lifetime, never by the server\'s clock', async () => {
    const built = start(build())
    built.presence.receive(peerEvent({}, { sentAt: '1999-01-01T00:00:00.123456+00:00', expiresAt: '1999-01-01T00:00:30.123456+00:00' }))
    const { onThisPage } = usePresence(built.$cwa)

    await vi.advanceTimersByTimeAsync(29_000)
    expect(onThisPage.value).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(onThisPage.value).toHaveLength(0)
  })

  test('a newer event from a peer renews its lifetime', async () => {
    const built = start(build())
    built.presence.receive(peerEvent({}))
    await vi.advanceTimersByTimeAsync(40_000)
    built.presence.receive(peerEvent({ state: 'selected' }))
    await vi.advanceTimersByTimeAsync(40_000)

    expect(usePresence(built.$cwa).onThisPage.value).toMatchObject([{ state: 'selected' }])
  })

  test('left removes the peer', () => {
    const built = start(build())
    built.presence.receive(peerEvent({}))
    built.presence.receive(peerEvent({ state: 'left' }))

    expect(usePresence(built.$cwa).onThisPage.value).toStrictEqual([])
  })

  test('an event of another version is ignored', () => {
    const built = start(build())
    built.presence.receive(peerEvent({}, { v: 2 }))

    expect(usePresence(built.$cwa).onThisPage.value).toStrictEqual([])
  })

  test('a lost connection pauses presence and its peers clear after their lifetime; reconnecting says hello', async () => {
    const built = start(build())
    await settle()
    built.presence.receive(peerEvent({}))
    const { paused, onThisPage } = usePresence(built.$cwa)

    built.presence.paused()
    expect(paused.value).toBe(true)
    await vi.advanceTimersByTimeAsync(45_000)
    expect(onThisPage.value).toStrictEqual([])

    built.presence.resumed()
    await vi.advanceTimersByTimeAsync(250)
    expect(paused.value).toBe(false)
    expect(built.sent().at(-1)).toMatchObject({ hello: true })
  })

  test('starting while Mercure is down starts paused', () => {
    const built = start(build(), false)

    expect(usePresence(built.$cwa).paused.value).toBe(true)
  })

  test('nameOf gives a known peer\'s name and nothing for anyone else', () => {
    const built = start(build())
    built.presence.receive(peerEvent({}))
    const { nameOf } = usePresence(built.$cwa)

    expect(nameOf('/users/sam')).toBe('Sam')
    expect(nameOf('/users/unknown')).toBeUndefined()
  })

  test('stop() clears the peers and makes the view inactive', () => {
    const built = start(build())
    built.presence.receive(peerEvent({}))
    const { active, onThisPage } = usePresence(built.$cwa)
    expect(active.value).toBe(true)

    built.presence.stop()

    expect(active.value).toBe(false)
    expect(onThisPage.value).toStrictEqual([])
  })

  test('a stopped presence takes in no peers', () => {
    const built = build()
    built.presence.receive(peerEvent({}))

    expect(usePresence(built.$cwa).onThisPage.value).toStrictEqual([])
  })
})

describe('Presence: peers on a resource (#429)', () => {
  const ALEX = { clientId: 'b0c1d2e3-f4a5-4b6c-8d7e-8f9a0b1c2d3e', user: { id: '/users/alex', name: 'Alex' } }

  function withDraft() {
    store.saveResource({ resource: { '@id': LIVE, '@type': 'Title', 'draftResource': DRAFT, '_metadata': { persisted: true, publishable: { published: true } } } as never })
    store.saveResource({ resource: { '@id': DRAFT, '@type': 'Title', 'publishedResource': LIVE, '_metadata': { persisted: true, publishable: { published: false } } } as never })
    return start(build())
  }

  test('peers lists who is on a resource, draft and published as one, with their field, a local-clock expiry and their colour', () => {
    const built = withDraft()
    built.presence.receive(peerEvent({ state: 'editing', component: LIVE, componentPosition: POSITION, field: 'title' }, { sentAt: '1999-01-01T00:00:00Z', expiresAt: '1999-01-01T00:00:30Z' }))
    built.presence.receive(peerEvent({ state: 'selected', component: '/component/titles/another' }, ALEX))
    const { peers } = usePresence(built.$cwa)

    const expected = [{ user: { id: '/users/sam', name: 'Sam' }, state: 'editing', field: 'title', expiresAt: Date.now() + 30_000, colour: presenceColour('/users/sam'), isSelf: false, idle: false }]
    expect(peers(DRAFT)).toStrictEqual(expected)
    expect(peers(LIVE)).toStrictEqual(expected)
    expect(peers(POSITION)).toStrictEqual(expected)
    expect(peers('/component/titles/unknown')).toStrictEqual([])
  })

  test('a peer selecting a resource has no field', () => {
    const built = withDraft()
    built.presence.receive(peerEvent({ state: 'selected', component: LIVE }))

    expect(usePresence(built.$cwa).peers(DRAFT)).toStrictEqual([{ user: { id: '/users/sam', name: 'Sam' }, state: 'selected', expiresAt: Date.now() + 45_000, colour: presenceColour('/users/sam'), isSelf: false, idle: false }])
  })

  test('focusedBy lists each person editing that field of the resource once, in their colour, named, with the windows they have it focused in', () => {
    const built = withDraft()
    built.presence.receive(peerEvent({ state: 'editing', component: LIVE, field: 'title' }))
    built.presence.receive(peerEvent({ state: 'editing', component: LIVE, field: 'title' }, { clientId: 'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f' }))
    built.presence.receive(peerEvent({ state: 'editing', component: LIVE, field: 'subtitle' }, ALEX))
    built.presence.receive(peerEvent({ state: 'selected', component: LIVE }, { clientId: 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f60', user: { id: '/users/kim', name: 'Kim' } }))
    const { focusedBy } = usePresence(built.$cwa)

    expect(focusedBy(DRAFT, 'title')).toStrictEqual([{ user: { id: '/users/sam', name: 'Sam' }, name: 'Sam', colour: presenceColour('/users/sam'), isSelf: false, clientIds: [PEER_ID, 'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f'] }])
    expect(focusedBy(DRAFT, 'subtitle')).toMatchObject([{ user: { name: 'Alex' } }])
    expect(focusedBy('/component/titles/another', 'title')).toStrictEqual([])
  })

  test('peers and focusedBy follow the peers as they change and expire', async () => {
    const built = withDraft()
    const { peers, focusedBy } = usePresence(built.$cwa)
    const focused = computed(() => focusedBy(DRAFT, 'title'))
    const onDraft = computed(() => peers(DRAFT))

    built.presence.receive(peerEvent({ state: 'editing', component: LIVE, field: 'title' }))
    expect(focused.value).toHaveLength(1)
    expect(onDraft.value).toHaveLength(1)

    built.presence.receive(peerEvent({ state: 'selected', component: LIVE }))
    expect(focused.value).toStrictEqual([])

    await vi.advanceTimersByTimeAsync(45_000)
    expect(onDraft.value).toStrictEqual([])
  })

  test('peers and focusedBy are empty once presence stops', () => {
    const built = withDraft()
    built.presence.receive(peerEvent({ state: 'editing', component: LIVE, field: 'title' }))
    built.presence.stop()
    const { peers, focusedBy } = usePresence(built.$cwa)

    expect(peers(DRAFT)).toStrictEqual([])
    expect(focusedBy(DRAFT, 'title')).toStrictEqual([])
  })
})

describe('Presence: idle (#429)', () => {
  function selected() {
    store.saveResource({ resource: { '@id': LIVE, '@type': 'Title', '_metadata': { persisted: true } } as never })
    const built = start(build())
    built.stack.value = [{ iri: LIVE }, { iri: POSITION }]
    return built
  }

  test('hiding the tab sends idle, keeping the selection but not the field; showing it again sends the real state at once', async () => {
    const built = selected()
    usePresence(built.$cwa).focus(Symbol('field'), LIVE, 'title')
    await vi.advanceTimersByTimeAsync(1_000)
    expect(built.sent().at(-1)).toMatchObject({ state: 'editing', field: 'title' })

    setVisibility('hidden')
    await vi.advanceTimersByTimeAsync(250)
    expect(built.sent().at(-1)).toStrictEqual({ v: 1, page: HOME, state: 'idle', component: LIVE, componentPosition: POSITION })

    const before = built.sent().length
    await vi.advanceTimersByTimeAsync(10_000)
    setVisibility('visible')
    await settle()
    expect(built.sent()).toHaveLength(before + 1)
    expect(built.sent().at(-1)).toMatchObject({ state: 'editing', field: 'title' })
  })

  test('a tab started hidden starts idle', async () => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    const { sent } = start(build())
    await settle()

    expect(sent()[0]).toMatchObject({ state: 'idle', hello: true })
  })

  test('five minutes with no pointer, key or focus sends idle; any of them sends the real state within the 250 ms throttle', async () => {
    const built = start(build())
    await settle()

    await vi.advanceTimersByTimeAsync(5 * 60_000 - 1_000)
    expect(built.sent().map(data => data.state)).not.toContain('idle')
    await vi.advanceTimersByTimeAsync(1_250)
    expect(built.sent().at(-1)).toMatchObject({ state: 'idle' })

    for (const [target, type] of [[window, 'pointerdown'], [window, 'keydown'], [document.body, 'focusin']] as const) {
      const before = built.sent().length
      target.dispatchEvent(new Event(type, { bubbles: true }))
      await vi.advanceTimersByTimeAsync(250)
      expect(built.sent()).toHaveLength(before + 1)
      expect(built.sent().at(-1)).toMatchObject({ state: 'viewing' })
      await vi.advanceTimersByTimeAsync(5 * 60_000 + 1_250)
      expect(built.sent().at(-1)).toMatchObject({ state: 'idle' })
    }
  })

  test('moving the pointer keeps the tab from going idle', async () => {
    const built = start(build())
    await settle()

    await vi.advanceTimersByTimeAsync(4 * 60_000)
    window.dispatchEvent(new Event('pointermove'))
    await vi.advanceTimersByTimeAsync(4 * 60_000)

    expect(built.sent().map(data => data.state)).not.toContain('idle')
  })

  test('activity in a hidden tab keeps it idle', async () => {
    const built = start(build())
    await settle()
    setVisibility('hidden')
    await vi.advanceTimersByTimeAsync(250)

    window.dispatchEvent(new Event('pointermove'))
    await vi.advanceTimersByTimeAsync(250)

    expect(built.sent().at(-1)).toMatchObject({ state: 'idle' })
  })

  test('an idle tab sends its heartbeat every 60 seconds instead of every 15, and every 15 again once back', async () => {
    const built = start(build())
    await settle()
    setVisibility('hidden')
    await vi.advanceTimersByTimeAsync(250)
    const idleAt = built.sent().length

    await vi.advanceTimersByTimeAsync(59_000)
    expect(built.sent()).toHaveLength(idleAt)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(built.sent()).toHaveLength(idleAt + 1)
    expect(built.sent().at(-1)).toMatchObject({ state: 'idle' })

    setVisibility('visible')
    await settle()
    const backAt = built.sent().length
    await vi.advanceTimersByTimeAsync(15_000)
    expect(built.sent()).toHaveLength(backAt + 1)
  })

  test('stop() removes the idle listeners and timers', async () => {
    const added = [vi.spyOn(window, 'addEventListener'), vi.spyOn(document, 'addEventListener')]
    const removed = [vi.spyOn(window, 'removeEventListener'), vi.spyOn(document, 'removeEventListener')]
    const built = start(build())
    await settle()
    built.presence.stop()

    const listeners = (spies: typeof added) => spies.flatMap(spy => spy.mock.calls.map(([type, listener]) => [type, listener])).filter(([type]) => ['visibilitychange', 'pointerdown', 'pointermove', 'keydown', 'focusin'].includes(type as string))
    expect(listeners(added)).toHaveLength(5)
    expect(listeners(removed)).toStrictEqual(listeners(added))

    setVisibility('hidden')
    window.dispatchEvent(new Event('pointerdown'))
    await vi.advanceTimersByTimeAsync(10 * 60_000)

    expect(built.sent()).toHaveLength(1)
  })

  test('an idle peer stays for three idle heartbeats on the local clock, longer than the event\'s own 45 second lifetime', async () => {
    const built = start(build())
    built.presence.receive(peerEvent({ state: 'idle' }))
    const { onThisPage } = usePresence(built.$cwa)

    await vi.advanceTimersByTimeAsync(179_000)
    expect(onThisPage.value).toMatchObject([{ state: 'idle' }])
    await vi.advanceTimersByTimeAsync(1_000)
    expect(onThisPage.value).toStrictEqual([])
  })

  test('an idle peer becoming active again expires by the event\'s own lifetime', async () => {
    const built = start(build())
    built.presence.receive(peerEvent({ state: 'idle' }))
    built.presence.receive(peerEvent({ state: 'viewing' }))

    await vi.advanceTimersByTimeAsync(45_000)
    expect(usePresence(built.$cwa).onThisPage.value).toStrictEqual([])
  })
})

describe('Presence: device and your other windows (#429)', () => {
  test('presence carries this tab\'s device label, read once when presence is created', async () => {
    setNavigator({ userAgent: CHROME_MAC })
    const built = build()
    setNavigator({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0' })
    start(built)
    await settle()

    expect(built.sent()[0]).toStrictEqual({ v: 1, page: HOME, state: 'viewing', device: 'Chrome on macOS', hello: true })
  })

  test('a peer signed in as this admin is this admin\'s other window, and carries its device; another person\'s device is never kept', () => {
    const built = start(build())
    built.presence.receive(peerEvent({ device: 'Safari on iOS' }, { user: { id: ME, name: 'Me' } }))
    built.presence.receive(peerEvent({ device: 'Firefox on Linux' }, { clientId: 'b0c1d2e3-f4a5-4b6c-8d7e-8f9a0b1c2d3e', user: { id: '/users/alex', name: 'Alex' } }))
    const { onThisPage } = usePresence(built.$cwa)

    expect(onThisPage.value).toMatchObject([{ user: { id: ME }, isSelf: true, device: 'Safari on iOS' }, { user: { id: '/users/alex' }, isSelf: false }])
    expect(onThisPage.value[1]).not.toHaveProperty('device')
  })

  test('peers and focusedBy mark this admin\'s other window, in the neutral colour, with its device; and mark idle peers', () => {
    store.saveResource({ resource: { '@id': LIVE, '@type': 'Title', '_metadata': { persisted: true } } as never })
    const built = start(build())
    built.presence.receive(peerEvent({ state: 'editing', component: LIVE, field: 'title', device: 'Safari on iOS' }, { user: { id: ME, name: 'Me' } }))
    built.presence.receive(peerEvent({ state: 'idle', component: LIVE, device: 'Firefox on Linux' }, { clientId: 'b0c1d2e3-f4a5-4b6c-8d7e-8f9a0b1c2d3e', user: { id: '/users/alex', name: 'Alex' } }))
    const { peers, focusedBy } = usePresence(built.$cwa)

    expect(peers(LIVE)).toStrictEqual([
      { user: { id: ME, name: 'Me' }, state: 'editing', field: 'title', expiresAt: Date.now() + 45_000, colour: SELF_COLOUR, isSelf: true, idle: false, device: 'Safari on iOS' },
      { user: { id: '/users/alex', name: 'Alex' }, state: 'idle', expiresAt: Date.now() + 180_000, colour: presenceColour('/users/alex'), isSelf: false, idle: true },
    ])
    expect(focusedBy(LIVE, 'title')).toStrictEqual([{ user: { id: ME, name: 'Me' }, name: 'You (other window)', colour: SELF_COLOUR, isSelf: true, clientIds: [PEER_ID] }])
  })

  test('the neutral colour is none of the people\'s colours', () => {
    const colours = Array.from({ length: 50 }, (_, index) => presenceColour(`/users/${index}`))

    expect(colours).not.toContain(SELF_COLOUR)
  })
})

describe('deviceLabel (#429)', () => {
  test.each([
    ['Chrome on macOS', { userAgent: CHROME_MAC }],
    ['Safari on macOS', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15' }],
    ['Safari on iOS', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1' }],
    ['Chrome on iOS', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.0.0 Mobile/15E148 Safari/604.1' }],
    ['Firefox on Windows', { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0' }],
    ['Edge on Windows', { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0' }],
    ['Chrome on Android', { userAgent: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36' }],
    ['Firefox on Linux', { userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0' }],
    ['Edge on Windows', { userAgent: CHROME_MAC, userAgentData: { brands: [{ brand: 'Chromium' }, { brand: 'Microsoft Edge' }, { brand: 'Not_A Brand' }], platform: 'Windows' } }],
    ['Chrome on macOS', { userAgent: '', userAgentData: { brands: [{ brand: 'Not)A;Brand' }, { brand: 'Google Chrome' }, { brand: 'Chromium' }], platform: 'macOS' } }],
    ['Chrome on Linux', { userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36', userAgentData: { brands: [{ brand: 'Chromium' }, { brand: 'Not_A Brand' }], platform: 'Linux' } }],
    ['Linux', { userAgent: 'Mozilla/5.0 (X11; Linux x64) AppleWebKit/537.36 (KHTML, like Gecko) HappyDOM/20.0.0' }],
  ])('%s', (label, nav) => {
    expect(deviceLabel(nav)).toBe(label)
  })

  test('nothing recognisable gives no label', () => {
    expect(deviceLabel({ userAgent: 'curl/8.7.1' })).toBeUndefined()
    expect(deviceLabel({})).toBeUndefined()
  })
})

describe('presenceColour (#429)', () => {
  test('every colour gives the dark initials at least WCAG AA contrast', () => {
    const luminance = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16) / 255).map(value => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
    }
    const dark = luminance('#1c1917')
    const colours = new Set(Array.from({ length: 200 }, (_, index) => presenceColour(`/users/${index}`)))

    expect(colours.size).toBe(6)
    for (const colour of colours) {
      expect((luminance(colour) + 0.05) / (dark + 0.05), colour).toBeGreaterThanOrEqual(4.5)
    }
  })

  test('the same user always gets the same colour, and none is a selection outline, clone or header colour', () => {
    const ids = Array.from({ length: 40 }, (_, index) => `/users/${index}`)
    const colours = ids.map(presenceColour)

    expect(ids.map(presenceColour)).toStrictEqual(colours)
    expect(new Set(colours).size).toBeGreaterThan(3)
    for (const forbidden of ['#2563eb', '#4f46e5', '#fee600', '#ffaa00', '#9cdd05', '#e30a6c', '#fff']) {
      expect(colours).not.toContain(forbidden)
    }
  })

  test('every colour is a hue clearly apart from the selection magenta, draft orange, clone yellow and selection blues', () => {
    const hue = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16) / 255) as [number, number, number]
      const max = Math.max(r, g, b)
      const delta = max - Math.min(r, g, b)
      const sector = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4
      return (sector * 60 + 360) % 360
    }
    const apart = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))
    const colours = new Set(Array.from({ length: 200 }, (_, index) => presenceColour(`/users/${index}`)))

    for (const colour of colours) {
      for (const reserved of ['#e30a6c', '#ffaa00', '#fee600', '#2563eb', '#4f46e5']) {
        expect(apart(hue(colour), hue(reserved)), `${colour} against ${reserved}`).toBeGreaterThanOrEqual(25)
      }
    }
  })
})

describe('Presence: an app\'s own events, send and on (#429)', () => {
  const ALEX = { clientId: 'b0c1d2e3-f4a5-4b6c-8d7e-8f9a0b1c2d3e', user: { id: '/users/alex', name: 'Alex' } }

  function withDraft(fetch?: ReturnType<typeof vi.fn>) {
    store.saveResource({ resource: { '@id': LIVE, '@type': 'Title', 'draftResource': DRAFT, '_metadata': { persisted: true, publishable: { published: true } } } as never })
    store.saveResource({ resource: { '@id': DRAFT, '@type': 'Title', 'publishedResource': LIVE, '_metadata': { persisted: true, publishable: { published: false } } } as never })
    return start(build({ fetch }))
  }

  function events(fetch: ReturnType<typeof vi.fn>) {
    return fetch.mock.calls.map(([, options]) => options.body).filter(body => body.event !== 'presence')
  }

  function appEvent(event: string, iri: string | null, data: unknown, overrides: Record<string, unknown> = {}) {
    return { ...peerEvent({}), event, iri, data, ...overrides }
  }

  test('send posts the event with this tab\'s client id, the IRI and the data, the published IRI for a draft', async () => {
    const built = withDraft()
    await settle()

    usePresence(built.$cwa).send(DRAFT, 'cursor', { from: 3, to: 5 })
    await settle()

    expect(built.fetch).toHaveBeenCalledWith('/_/realtime', expect.objectContaining({ method: 'POST', retry: 0 }))
    expect(events(built.fetch)).toStrictEqual([{ clientId: CLIENT_ID, event: 'cursor', iri: LIVE, data: { from: 3, to: 5 } }])
  })

  test('sends of one event on one IRI go out at most every 100 ms, the newest data winning, and the last one always goes out', async () => {
    const built = withDraft()
    await settle()
    const { send } = usePresence(built.$cwa)

    send(LIVE, 'cursor', 1)
    await settle()
    send(LIVE, 'cursor', 2)
    send(LIVE, 'cursor', 3)
    await vi.advanceTimersByTimeAsync(99)
    expect(events(built.fetch).map(({ data }) => data)).toStrictEqual([1])

    await vi.advanceTimersByTimeAsync(1)
    expect(events(built.fetch).map(({ data }) => data)).toStrictEqual([1, 3])

    await vi.advanceTimersByTimeAsync(1_000)
    expect(events(built.fetch)).toHaveLength(2)
  })

  test('another event, or the same event on another IRI, is not held back by the first', async () => {
    const built = withDraft()
    await settle()
    const { send } = usePresence(built.$cwa)

    send(LIVE, 'cursor', 1)
    send(LIVE, 'selection', 2)
    send(POSITION, 'cursor', 3)
    await settle()

    expect(events(built.fetch).map(({ event, iri, data }) => [event, iri, data])).toStrictEqual([['cursor', LIVE, 1], ['selection', LIVE, 2], ['cursor', POSITION, 3]])
  })

  test('only one send of an event on an IRI is in flight at a time, and the newest data follows once it is answered', async () => {
    const first = held()
    const fetch = vi.fn((_path: string, options: { body: { event: string } }) => options.body.event === 'cursor' && fetch.mock.calls.filter(([, call]) => call.body.event === 'cursor').length === 1 ? first.promise : Promise.resolve())
    const built = withDraft(fetch as never)
    await settle()
    const { send } = usePresence(built.$cwa)

    send(LIVE, 'cursor', 1)
    await settle()
    await vi.advanceTimersByTimeAsync(500)
    send(LIVE, 'cursor', 2)
    await vi.advanceTimersByTimeAsync(500)
    expect(events(fetch as never).map(({ data }) => data)).toStrictEqual([1])

    first.resolve()
    await settle()
    expect(events(fetch as never).map(({ data }) => data)).toStrictEqual([1, 2])
  })

  test('a 429 sends the same data again once its Retry-After has passed', async () => {
    const fetch = vi.fn((_path: string, options: { body: { event: string } }) => options.body.event === 'cursor' && fetch.mock.calls.length === 2 ? Promise.reject(httpError(429, { 'Retry-After': '5' })) : Promise.resolve())
    const built = withDraft(fetch as never)
    await settle()

    usePresence(built.$cwa).send(LIVE, 'cursor', 1)
    await settle()
    await vi.advanceTimersByTimeAsync(4_999)
    expect(events(fetch as never)).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(events(fetch as never).map(({ data }) => data)).toStrictEqual([1, 1])
  })

  test('a 5xx backs off, then sends the newest data', async () => {
    const fetch = vi.fn((_path: string, options: { body: { event: string } }) => options.body.event === 'cursor' && fetch.mock.calls.length === 2 ? Promise.reject(httpError(503)) : Promise.resolve())
    const built = withDraft(fetch as never)
    await settle()
    const { send } = usePresence(built.$cwa)

    send(LIVE, 'cursor', 1)
    await settle()
    send(LIVE, 'cursor', 2)
    await vi.advanceTimersByTimeAsync(999)
    expect(events(fetch as never)).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(events(fetch as never).map(({ data }) => data)).toStrictEqual([1, 2])
  })

  test.each([413, 415, 422])('a %i warns once naming the event and drops that send, and later sends still go out', async (status) => {
    const fetch = vi.fn((_path: string, options: { body: { event: string } }) => options.body.event === 'cursor' ? Promise.reject(httpError(status)) : Promise.resolve())
    const built = withDraft(fetch as never)
    await settle()
    const { send } = usePresence(built.$cwa)

    send(LIVE, 'cursor', 1)
    await settle()
    await vi.advanceTimersByTimeAsync(1_000)
    send(LIVE, 'cursor', 2)
    await vi.advanceTimersByTimeAsync(1_000)

    expect(events(fetch as never).map(({ data }) => data)).toStrictEqual([1, 2])
    expect(logger.warn).toHaveBeenCalledOnce()
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('"cursor"'))
  })

  test.each([401, 403])('a %i stops real-time quietly, sending nothing more', async (status) => {
    const fetch = vi.fn((_path: string, options: { body: { event: string } }) => options.body.event === 'cursor' ? Promise.reject(httpError(status)) : Promise.resolve())
    const built = withDraft(fetch as never)
    await settle()
    const { send, active } = usePresence(built.$cwa)

    send(LIVE, 'cursor', 1)
    await settle()
    send(LIVE, 'cursor', 2)
    await vi.advanceTimersByTimeAsync(60_000)

    expect(events(fetch as never)).toHaveLength(1)
    expect(active.value).toBe(false)
    expect(logger.warn).not.toHaveBeenCalled()
  })

  test.each([404, 405])('a %i turns real-time off for the session and warns once', async (status) => {
    const fetch = vi.fn((_path: string, options: { body: { event: string } }) => options.body.event === 'cursor' ? Promise.reject(httpError(status)) : Promise.resolve())
    const built = withDraft(fetch as never)
    await settle()
    const { send, active } = usePresence(built.$cwa)

    send(LIVE, 'cursor', 1)
    await settle()
    built.presence.start(true)
    send(LIVE, 'cursor', 2)
    await vi.advanceTimersByTimeAsync(60_000)

    expect(events(fetch as never)).toHaveLength(1)
    expect(active.value).toBe(false)
    expect(logger.warn).toHaveBeenCalledOnce()
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Real-time presence is turned off on the API'))
  })

  test('nothing is sent while presence is stopped, and stop() drops a send still waiting', async () => {
    const built = withDraft()
    await settle()
    const { send } = usePresence(built.$cwa)

    send(LIVE, 'cursor', 1)
    await settle()
    send(LIVE, 'cursor', 2)
    built.presence.stop()
    send(LIVE, 'cursor', 3)
    await vi.advanceTimersByTimeAsync(1_000)

    expect(events(built.fetch).map(({ data }) => data)).toStrictEqual([1])
  })

  test('after a stop and a new start, the same event on the same IRI goes out again', async () => {
    const built = withDraft()
    await settle()
    const { send } = usePresence(built.$cwa)

    send(LIVE, 'cursor', 1)
    await settle()
    send(LIVE, 'cursor', 2)
    built.presence.stop()
    built.presence.start(true)
    send(LIVE, 'cursor', 3)
    await vi.advanceTimersByTimeAsync(1_000)

    expect(events(built.fetch).map(({ data }) => data)).toStrictEqual([1, 3])
  })

  test('on calls the handler with the event, its data and who sent it, named, for that event on that resource, draft and published as one', () => {
    const built = withDraft()
    const handler = vi.fn()
    usePresence(built.$cwa).on(() => DRAFT, 'cursor', handler)

    built.presence.receive(appEvent('cursor', LIVE, { from: 1 }, ALEX))
    built.presence.receive(appEvent('cursor', DRAFT, { from: 2 }, ALEX))

    const message = { clientId: ALEX.clientId, user: ALEX.user, name: 'Alex', isSelf: false, colour: presenceColour('/users/alex'), event: 'cursor', sentAt: '2026-10-21T10:00:00.000000+00:00' }
    expect(handler.mock.calls).toStrictEqual([[{ ...message, data: { from: 1 } }], [{ ...message, data: { from: 2 } }]])
  })

  test('on ignores other events, other resources, events with no resource, other versions and this tab\'s own events', () => {
    const built = withDraft()
    const handler = vi.fn()
    usePresence(built.$cwa).on(() => LIVE, 'cursor', handler)

    built.presence.receive(appEvent('selection', LIVE, 1))
    built.presence.receive(appEvent('cursor', POSITION, 1))
    built.presence.receive(appEvent('cursor', null, 1))
    built.presence.receive(appEvent('cursor', LIVE, 1, { v: 2 }))
    built.presence.receive(appEvent('cursor', LIVE, 1, { clientId: CLIENT_ID }))
    built.presence.receive(appEvent('cursor', LIVE, 1, { user: undefined }))

    expect(handler).not.toHaveBeenCalled()
  })

  test('an event from this admin\'s other window is marked as theirs, in the neutral colour', () => {
    const built = withDraft()
    const handler = vi.fn()
    usePresence(built.$cwa).on(() => LIVE, 'cursor', handler)

    built.presence.receive(appEvent('cursor', LIVE, 1, { user: { id: ME, name: 'Me' } }))

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ data: 1, isSelf: true, colour: SELF_COLOUR, name: 'You (other window)' }))
  })

  test('on follows the IRI as it changes, and its unsubscribe stops it', () => {
    const built = withDraft()
    const handler = vi.fn()
    const iri = ref(LIVE)
    const off = usePresence(built.$cwa).on(() => iri.value, 'cursor', handler)

    iri.value = POSITION
    built.presence.receive(appEvent('cursor', LIVE, 1))
    built.presence.receive(appEvent('cursor', POSITION, 2))
    off()
    built.presence.receive(appEvent('cursor', POSITION, 3))

    expect(handler.mock.calls.map(([message]) => message.data)).toStrictEqual([2])
  })

  test('an event is not taken for presence, and a presence event reaches no handler', () => {
    const built = withDraft()
    const handler = vi.fn()
    usePresence(built.$cwa).on(() => LIVE, 'cursor', handler)

    built.presence.receive(appEvent('cursor', LIVE, { v: 1, state: 'viewing', page: HOME }))
    built.presence.receive(peerEvent({ component: LIVE }, { iri: LIVE }))

    expect(usePresence(built.$cwa).onThisPage.value).toHaveLength(1)
    expect(handler).toHaveBeenCalledOnce()
  })

  test('a handler that throws is reported naming the event, and the other handlers still hear it', () => {
    const built = withDraft()
    const failing = vi.fn(() => {
      throw new Error('broken')
    })
    const handler = vi.fn()
    usePresence(built.$cwa).on(() => LIVE, 'cursor', failing)
    usePresence(built.$cwa).on(() => LIVE, 'cursor', handler)

    expect(() => built.presence.receive(appEvent('cursor', LIVE, 1))).not.toThrow()

    expect(failing).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledOnce()
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('"cursor"'), expect.objectContaining({ message: 'broken' }))
  })

  test('send returns true once the event is on its way, and false with nothing sent while stopped or while Mercure is down', async () => {
    const built = withDraft()
    await settle()
    const { send } = usePresence(built.$cwa)

    expect(send(LIVE, 'cursor', 1)).toBe(true)
    await settle()

    built.presence.paused()
    expect(send(LIVE, 'cursor', 2)).toBe(false)
    await vi.advanceTimersByTimeAsync(1_000)
    built.presence.stop()
    expect(send(LIVE, 'cursor', 3)).toBe(false)
    await vi.advanceTimersByTimeAsync(1_000)

    expect(events(built.fetch).map(({ data }) => data)).toStrictEqual([1])
  })

  test('Mercure going down drops a send still waiting, and nothing is sent for it on reconnect', async () => {
    const first = held()
    const fetch = vi.fn((_path: string, options: { body: { event: string } }) => options.body.event === 'cursor' && fetch.mock.calls.filter(([, call]) => call.body.event === 'cursor').length === 1 ? first.promise : Promise.resolve())
    const built = withDraft(fetch as never)
    await settle()
    const { send } = usePresence(built.$cwa)

    send(LIVE, 'cursor', 1)
    send(LIVE, 'selection', 'a')
    await settle()
    send(LIVE, 'cursor', 2)
    send(LIVE, 'selection', 'b')
    built.presence.paused()
    first.resolve()
    await vi.advanceTimersByTimeAsync(1_000)
    built.presence.resumed()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(events(fetch as never).map(({ data }) => data)).toStrictEqual([1, 'a'])

    expect(send(LIVE, 'cursor', 3)).toBe(true)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(events(fetch as never).map(({ data }) => data)).toStrictEqual([1, 'a', 3])
  })

  test('a handler registered before presence starts receives events once it has', () => {
    const built = build()
    const handler = vi.fn()
    usePresence(built.$cwa).on(() => LIVE, 'cursor', handler)

    built.presence.receive(appEvent('cursor', LIVE, 1))
    start(built)
    built.presence.receive(appEvent('cursor', LIVE, 2))

    expect(handler.mock.calls.map(([message]) => message.data)).toStrictEqual([2])
  })
})
