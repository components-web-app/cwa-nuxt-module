// @vitest-environment nuxt
import { describe, test, expect } from 'vitest'
import { buildHarness } from './harness'
import { flush } from './replay-cwa-fetch'
import cassette from '../cassettes/topic-1-nested.json'

// page IRIs from the recorded cassette
const TOPIC1_PAGE = '/_api/_/pages/a80262b4-4f1f-4358-ad64-b282dc1897ad' // depth-0 parent ("Topic 1" data page)
const CHAPTER_ONE_PAGE = '/_api/_/pages/ac96cf91-d4d5-4b27-af39-9e0d073e60f7' // depth-1
const CHAPTER_TWO_PAGE = '/_api/_/pages/27dc9bc0-49a3-4395-a414-4cc9585236cd' // depth-1 sibling
const FORM_PAGE = '/_api/_/pages/88688683-ee11-49df-8d65-da537fd38b2b' // standalone
const HOME_PAGE = '/_api/_/pages/3d594703-c764-4624-8c12-9695d02ef206' // root static

type Harness = ReturnType<typeof buildHarness>

const isRoute = (p: string) => p.includes('/_/routes/')
const isManifest = (p: string) => p.includes('/_/resource_manifest/')

// Start a navigation the way the route middleware does — fire-and-forget (NOT awaited). A superseded
// nav legitimately never resolves, so we must not await it; swallow any rejection.
function startNav(h: Harness, path: string) {
  h.fetcher.fetchRoute(h.route(path)).catch(() => {})
}

// Drive pending requests to completion in a REALISTIC order: routes resolve first (so a redirect can
// abort / a page can early-switch before its batch), then manifests (which enqueue the resource
// batch), then the resources. Immediate mode would resolve in request order (manifest-first), which
// does not match how the real API/network behaves.
async function settle(h: Harness) {
  for (let i = 0; i < 60 && h.replay.pending().length; i++) {
    const pending = h.replay.pending()
    if (pending.some(isRoute)) {
      h.replay.release(isRoute)
    }
    else if (pending.some(isManifest)) {
      h.replay.release(isManifest)
    }
    else {
      h.replay.releaseAll()
    }
    // drain thoroughly so a resolved route's continuation (redirect-abort / early-switch) fully
    // propagates before the next phase is released — in reality the manifest is a separate, slower
    // request, so the route always settles first
    await flush(20)
  }
  await flush(20)
}

// Fetch a route and follow a redirect the way `handleRouteRedirect` → navigateTo would.
async function fetchWithRedirect(h: Harness, path: string): Promise<string> {
  const nav = h.fetcher.fetchRoute(h.route(path)) as Promise<{ redirectPath?: string } | undefined>
  await settle(h)
  const resource = await nav
  return resource?.redirectPath ?? path
}

describe('#246 interrupted navigation (reverted #256 baseline)', () => {
  test('baseline: sequential sibling switch lands on the second', async () => {
    const h = buildHarness(cassette as never)
    await h.fetcher.fetchRoute(h.route('/topic-1/chapter-one'))
    await flush()
    expect(h.resources.pageIriAtDepth(1).value).toBe(CHAPTER_ONE_PAGE)

    await h.fetcher.fetchRoute(h.route('/topic-1/chapter-two'))
    await flush()
    expect(h.resources.pageIriAtDepth(0).value).toBe(TOPIC1_PAGE)
    expect(h.resources.pageIriAtDepth(1).value).toBe(CHAPTER_TWO_PAGE)
  })

  test('baseline: a redirect route resolves to its target with redirectPath', async () => {
    const h = buildHarness(cassette as never, { manual: true })
    const target = await fetchWithRedirect(h, '/topic-1')
    expect(target).toBe('/topic-1/chapter-one')
  })

  test('interrupted: switch to sibling before the first loads → lands on the second', async () => {
    const h = buildHarness(cassette as never, { manual: true })
    startNav(h, '/topic-1/chapter-one')
    await flush()
    expect(h.replay.pending().length).toBeGreaterThan(0)

    startNav(h, '/topic-1/chapter-two') // interrupt in flight
    await flush()
    await settle(h)

    expect(h.resources.pageIriAtDepth(0).value).toBe(TOPIC1_PAGE)
    expect(h.resources.pageIriAtDepth(1).value).toBe(CHAPTER_TWO_PAGE)
  })

  test('interrupted: nested (data-page parent) → root static page before load → lands on the static page', async () => {
    const h = buildHarness(cassette as never, { manual: true })
    startNav(h, '/topic-1/chapter-one')
    await flush()
    h.replay.release(isRoute) // parent route resolves; child still loading
    await flush()

    startNav(h, '/') // click home before chapter-one finished
    await flush()
    await settle(h)

    expect(h.resources.pageIriAtDepth(0).value).toBe(HOME_PAGE)
    expect(h.resources.depthCount.value).toBe(1)
  })

  test('interrupted redirect: switch to a static page before the redirect target loads → lands on the static page', async () => {
    const h = buildHarness(cassette as never, { manual: true })
    const target = await fetchWithRedirect(h, '/topic-1')
    expect(target).toBe('/topic-1/chapter-one')

    startNav(h, target) // load the nested redirect target...
    await flush()
    h.replay.release(isRoute)
    await flush()

    startNav(h, '/form') // ...but click the static form page before it finished
    await flush()
    await settle(h)

    expect(h.resources.pageIriAtDepth(0).value).toBe(FORM_PAGE)
  })
})
