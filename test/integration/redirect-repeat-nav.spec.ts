// @vitest-environment nuxt

/**
 * #245 — "redirects do not work if clicking on route that should redirect quickly multiple times"
 * (the long-standing todo at `route-middleware.ts:64`).
 *
 * DIAGNOSTIC, then a regression guard. The question was whether a rapid repeat click on a redirect
 * route can leave the user stranded on the redirect route with no navigation. It cannot — these pin
 * why, so the answer stays true.
 *
 * The middleware, not the fetcher store, is the thing under test: static analysis had already
 * cleared the fetcher, so these drive the REAL `route-middleware.ts` (its `middlewareToken` guard
 * and `handleRouteRedirect`) against the REAL fetch pipeline replaying recorded responses (#246),
 * with `navigateTo` mocked to re-enter the middleware exactly as the router would. Manual replay
 * mode holds every response, so N clicks are genuinely in flight at once.
 *
 * `/topic-1` is a redirect Route resource (`redirectPath: '/topic-1/chapter-one'`).
 *
 * **The contract.** Only the LAST click can redirect, and it must:
 *   - superseded clicks resolve `undefined` (their token is no longer current — `finishFetchResource`
 *     bails) and are *additionally* suppressed by the middleware's `middlewareToken` guard if they
 *     resolve late with data. Both are correct: their navigation was replaced.
 *   - the winning click resolves the route resource and redirects. This is what "the click worked"
 *     means to a user, and it is what would break if the todo described a real bug.
 */

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

// A client-side router standing in for Nuxt's: it runs the real middleware for each navigation with
// `_processingMiddleware` set the way Nuxt sets it, and lets the middleware's own `navigateTo` drive
// the next navigation (that is how a redirect actually happens).
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

  // One navigation = one middleware run. The middleware is fire-and-forget client-side, so this
  // returns long before the route resource arrives — which is exactly what lets clicks stack up.
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
    await flush() // the first route request is genuinely in flight (held by the replay)
    expect(h.replay.pending().some(p => p.includes('/_/routes//topic-1'))).toBe(true)

    await sim.navigate(REDIRECT_ROUTE) // interrupt with the SAME path
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
      await flush(1) // stagger — a real multi-click, not a single tick
    }
    await settle(h)

    // Only the winning click redirects: the four superseded fetches resolve `undefined` (stale
    // token), and the middlewareToken guard suppresses any that resolve late WITH data. A second
    // redirect here would mean a stale click firing a navigation the user had already replaced.
    const redirects = vi.mocked(nuxt.navigateTo).mock.calls.filter(([to]) => to === REDIRECT_TARGET)
    expect(redirects).toHaveLength(1)
    expect(sim.landedOn()).toBe(REDIRECT_TARGET)
    expect(h.resources.pageIriAtDepth(1).value).toBe(CHAPTER_ONE_PAGE)
  })

  test('the redirect still fires when a navigation is mid-flight as the route resolves', async () => {
    // Hypothesis 1 from #245: `waitForMiddleware` polls `_processingMiddleware` — if a navigation is
    // processing when the redirect resolves, the redirect must be deferred, not dropped. (navigateTo
    // would otherwise only RETURN the route rather than perform it — hence the wait.)
    const h = buildHarness(cassette as never, { manual: true })
    const sim = createRouterSim(h)

    await sim.navigate(REDIRECT_ROUTE)
    sim.nuxtApp._processingMiddleware = true // a navigation starts processing before the route lands
    await settle(h)

    expect(nuxt.navigateTo).not.toHaveBeenCalledWith(REDIRECT_TARGET, { redirectCode: 308 })

    sim.nuxtApp._processingMiddleware = undefined // that navigation finishes — the wait must release
    await vi.waitFor(() => expect(nuxt.navigateTo).toHaveBeenCalledWith(REDIRECT_TARGET, { redirectCode: 308 }))
    await settle(h)

    expect(h.resources.pageIriAtDepth(1).value).toBe(CHAPTER_ONE_PAGE)
  })

  test('a superseded click resolving LATE with cached data does not re-fire its redirect', async () => {
    // This is what the `middlewareToken` guard is actually for, and the ONE case where a stale click
    // resolves with real data rather than `undefined`: once the winning click has saved the route
    // resource as SUCCESS, a superseded click's late response short-circuits in
    // `finishFetchResource` (SUCCESS + same path ⇒ return the cached data) — carrying `redirectPath`
    // despite its navigation having been replaced. Unguarded, it would fire a SECOND redirect and
    // yank the user back to the target from wherever they had since gone.
    const h = buildHarness(cassette as never, { manual: true })
    const sim = createRouterSim(h)
    const isTopic1Route = (p: string) => p === '/_api/_/routes//topic-1'

    await sim.navigate(REDIRECT_ROUTE) // click 1 — deliberately left in flight below
    await flush()
    await sim.navigate(REDIRECT_ROUTE) // click 2 supersedes it
    await flush()
    expect(h.replay.pending().filter(isTopic1Route)).toHaveLength(2)

    // let ONLY the winning click through, so it saves the route resource and redirects...
    h.replay.releaseLatest(isTopic1Route)
    await flush(20)
    expect(h.replay.pending().filter(isTopic1Route)).toHaveLength(1) // click 1 is still in flight

    // ...then click 1's long-delayed response finally lands, its navigation long since replaced.
    // It resolves WITH data (`finishFetchResource` returns the now-cached SUCCESS resource), which is
    // precisely why `undefined` alone cannot be relied on to suppress it.
    await settle(h)
    // real time, because a redirect parked in `waitForMiddleware` polls on a 10ms timer that
    // microtask flushing would never advance — without this the guard could not be observed at all.
    await new Promise(resolve => setTimeout(resolve, 60))

    // one click, one redirect
    const redirects = vi.mocked(nuxt.navigateTo).mock.calls.filter(([to]) => to === REDIRECT_TARGET)
    expect(redirects).toHaveLength(1)
    expect(sim.landedOn()).toBe(REDIRECT_TARGET)
  })

  test('superseded clicks resolve undefined — their navigation was replaced, the last one redirects', async () => {
    // The fetcher-level contract underpinning the above, pinned so it is not mistaken for the bug:
    // an `undefined` from a superseded click is CORRECT (`finishFetchResource` bails on a stale
    // token). Only the winning click has to carry `redirectPath`.
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
