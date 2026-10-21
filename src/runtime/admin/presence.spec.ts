// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, nextTick, ref, shallowRef } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { consola as logger } from 'consola'
import type { Router } from 'vue-router'
import { ResourcesStore } from '../storage/stores/resources/resources-store'
import type { CwaResourcesStoreInterface } from '../storage/stores/resources/resources-store'
import { getResourceTypeFromIri } from '../resources/resource-utils'
import type { CwaResourceTypes } from '../resources/resource-utils'
import CwaFetch from '../api/fetcher/cwa-fetch'
import * as processComposables from '../composables/process'
import { Presence, presenceColour, usePresence } from './presence'
import type Cwa from '#cwa/cwa'

const CLIENT_ID = '0b3c8f0e-5a7d-4d1e-9f2a-1c2b3d4e5f60'
const PEER_ID = '7f1e2d3c-4b5a-4c6d-8e7f-9a0b1c2d3e4f'
const HOME = '/_/pages/home'
const ABOUT = '/_/pages/about'
const DRAFT = '/component/titles/draft'
const LIVE = '/component/titles/live'
const POSITION = '/_/component_positions/hero'

let store: CwaResourcesStoreInterface

function build(options: { page?: string, routePath?: string, fetch?: ReturnType<typeof vi.fn> } = {}) {
  const { routePath = '/home', fetch = vi.fn().mockResolvedValue(undefined) } = options
  const displayPageIri = ref<string | undefined>('page' in options ? options.page : HOME)
  const isLoading = ref(false)
  const route = shallowRef<{ path: string, meta: Record<string, any> }>({ path: routePath, meta: {} })
  const stack = shallowRef<{ iri: string }[]>([])
  const pageDataByPosition: Record<string, string> = {}
  const $cwa = {
    apiUrlBase: 'https://api.test/_api',
    cwaFetch: { fetch },
    resources: {
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
  return { presence, $cwa: $cwa as unknown as Cwa, fetch, sent, displayPageIri, isLoading, route, stack, pageDataByPosition }
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
})

afterEach(() => {
  started.splice(0).forEach(presence => presence.stop())
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
    await vi.advanceTimersByTimeAsync(1)
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
    await vi.advanceTimersByTimeAsync(1)
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
})
