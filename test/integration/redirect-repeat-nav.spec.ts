// @vitest-environment nuxt

import { computed } from 'vue'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import * as nuxt from 'nuxt/app'
import cassette from '../cassettes/topic-1-nested.json'
import { buildHarness } from './harness'
import { flush } from './replay-cwa-fetch'
import { CHAPTER_ONE_PAGE, settle } from './nav-helpers'
import type { Harness } from './nav-helpers'
import routeMiddleware from '#cwa/route-middleware'
import * as processComposables from '#cwa/composables/process'

const REDIRECT_ROUTE = '/topic-1'
const REDIRECT_TARGET = '/topic-1/chapter-one'

type NuxtAppStub = {
  _processingMiddleware: true | undefined
  payload: { serverRendered?: boolean }
  isHydrating: boolean
  $cwa: Record<string, unknown>
}

function createRouterSim(h: Harness) {
  const navigations: string[] = []
  let currentPath = '/'

  const nuxtApp: NuxtAppStub = {
    _processingMiddleware: undefined,
    payload: {},
    isHydrating: false,
    $cwa: {
      fetchRoute: (to: never) => h.fetcher.fetchRoute(to),
      initClientSide: vi.fn(),
      adminNavigationGuardFn: () => true,
      clearPrimaryFetch: () => h.manager.clearPrimaryFetch(),
      resourcesManager: { confirmDiscardAddingResource: () => true },
      auth: { isAdmin: computed(() => false) },
      admin: { isEditing: false },
      siteConfig: { loadConfig: vi.fn() },
    },
  }
  vi.spyOn(nuxt, 'useNuxtApp').mockImplementation(() => nuxtApp as never)

  const navigate = async (path: string) => {
    navigations.push(path)
    const from = h.route(currentPath)
    currentPath = path
    nuxtApp._processingMiddleware = true
    await routeMiddleware(h.route(path), from)
    nuxtApp._processingMiddleware = undefined
  }

  vi.spyOn(nuxt, 'navigateTo').mockImplementation(((to: string) => navigate(to)) as never)

  return { navigate, navigations, nuxtApp, landedOn: () => currentPath }
}

describe('#245 repeated rapid clicks on a redirect route', () => {
  beforeEach(() => {
    vi.spyOn(processComposables, 'useProcess').mockImplementation(() => ({ isClient: true, isServer: false }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('baseline: a single click redirects and loads the target', async () => {
    const h = buildHarness(cassette as never, { manual: true })
    const sim = createRouterSim(h)

    await sim.navigate(REDIRECT_ROUTE)
    await settle(h)

    expect(nuxt.navigateTo).toHaveBeenCalledWith(REDIRECT_TARGET, { redirectCode: 308 })
    expect(sim.landedOn()).toBe(REDIRECT_TARGET)
    expect(h.resources.pageIriAtDepth(1).value).toBe(CHAPTER_ONE_PAGE)
  })

  test('two clicks in the same tick still redirect and load the target', async () => {
    const h = buildHarness(cassette as never, { manual: true })
    const sim = createRouterSim(h)

    await Promise.all([sim.navigate(REDIRECT_ROUTE), sim.navigate(REDIRECT_ROUTE)])
    await settle(h)

    expect(nuxt.navigateTo).toHaveBeenCalledWith(REDIRECT_TARGET, { redirectCode: 308 })
    expect(sim.landedOn()).toBe(REDIRECT_TARGET)
    expect(h.resources.pageIriAtDepth(1).value).toBe(CHAPTER_ONE_PAGE)
  })

  test('a second click while the first is still in flight still redirects', async () => {
    const h = buildHarness(cassette as never, { manual: true })
    const sim = createRouterSim(h)

    await sim.navigate(REDIRECT_ROUTE)
    await flush()
    expect(h.replay.pending().some(p => p.includes('/_/routes//topic-1'))).toBe(true)

    await sim.navigate(REDIRECT_ROUTE)
    await settle(h)

    expect(nuxt.navigateTo).toHaveBeenCalledWith(REDIRECT_TARGET, { redirectCode: 308 })
    expect(sim.landedOn()).toBe(REDIRECT_TARGET)
    expect(h.resources.pageIriAtDepth(1).value).toBe(CHAPTER_ONE_PAGE)
  })

  test('five rapid clicks redirect exactly once and land on the target', async () => {
    const h = buildHarness(cassette as never, { manual: true })
    const sim = createRouterSim(h)

    for (let i = 0; i < 5; i++) {
      await sim.navigate(REDIRECT_ROUTE)
      await flush(1)
    }
    await settle(h)

    const redirects = vi.mocked(nuxt.navigateTo).mock.calls.filter(([to]) => to === REDIRECT_TARGET)
    expect(redirects).toHaveLength(1)
    expect(sim.landedOn()).toBe(REDIRECT_TARGET)
    expect(h.resources.pageIriAtDepth(1).value).toBe(CHAPTER_ONE_PAGE)
  })

  test('the redirect still fires when a navigation is mid-flight as the route resolves', async () => {
    const h = buildHarness(cassette as never, { manual: true })
    const sim = createRouterSim(h)

    await sim.navigate(REDIRECT_ROUTE)
    sim.nuxtApp._processingMiddleware = true
    await settle(h)

    expect(nuxt.navigateTo).not.toHaveBeenCalledWith(REDIRECT_TARGET, { redirectCode: 308 })

    sim.nuxtApp._processingMiddleware = undefined
    await vi.waitFor(() => expect(nuxt.navigateTo).toHaveBeenCalledWith(REDIRECT_TARGET, { redirectCode: 308 }))
    await settle(h)

    expect(h.resources.pageIriAtDepth(1).value).toBe(CHAPTER_ONE_PAGE)
  })

  test('a superseded click resolving LATE with cached data does not re-fire its redirect', async () => {
    const h = buildHarness(cassette as never, { manual: true })
    const sim = createRouterSim(h)
    const isTopic1Route = (p: string) => p === '/_api/_/routes//topic-1'

    await sim.navigate(REDIRECT_ROUTE)
    await flush()
    await sim.navigate(REDIRECT_ROUTE)
    await flush()
    expect(h.replay.pending().filter(isTopic1Route)).toHaveLength(2)

    h.replay.releaseLatest(isTopic1Route)
    await flush(20)
    expect(h.replay.pending().filter(isTopic1Route)).toHaveLength(1)

    await settle(h)
    await new Promise(resolve => setTimeout(resolve, 60))

    const redirects = vi.mocked(nuxt.navigateTo).mock.calls.filter(([to]) => to === REDIRECT_TARGET)
    expect(redirects).toHaveLength(1)
    expect(sim.landedOn()).toBe(REDIRECT_TARGET)
  })

  test('superseded clicks resolve undefined — their navigation was replaced, the last one redirects', async () => {
    const h = buildHarness(cassette as never, { manual: true })
    type RouteResult = { redirectPath?: string } | undefined
    const click = (path: string) => (h.fetcher.fetchRoute(h.route(path)) as Promise<RouteResult>).catch(() => undefined)

    const clicks: Promise<RouteResult>[] = []
    for (let i = 0; i < 5; i++) {
      clicks.push(click(REDIRECT_ROUTE))
      await flush(1)
    }
    await settle(h)

    const results = await Promise.all(clicks)
    expect(results.at(-1)?.redirectPath).toBe(REDIRECT_TARGET)
    expect(results.slice(0, -1).every(r => r?.redirectPath === undefined)).toBe(true)
  })
})
