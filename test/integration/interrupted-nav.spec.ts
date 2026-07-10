// @vitest-environment nuxt
import { describe, test, expect } from 'vitest'
import { buildHarness } from './harness'
import { flush } from './replay-cwa-fetch'
import {
  CHAPTER_ONE_PAGE, CHAPTER_TWO_PAGE, FORM_PAGE, HOME_PAGE, TOPIC1_PAGE,
  type Harness, isRoute, settle, startNav,
} from './nav-helpers'
import cassette from '../cassettes/topic-1-nested.json'

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
