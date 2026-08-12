// @vitest-environment nuxt
import { describe, test, expect } from 'vitest'
import { buildHarness } from './harness'
import { flush } from './replay-cwa-fetch'
import cassette from '../cassettes/topic-1-nested.json'

const PAGE = '/_api/_/pages/88688683-ee11-49df-8d65-da537fd38b2b'
const UUID = '88688683-ee11-49df-8d65-da537fd38b2b'

/**
 * Viewing a resource by IRI (no public route) only works through the `_cwa-resource-page` route,
 * which carries the IRI in `params.cwaPage0` — `getInternalResourceLink()` builds exactly that.
 *
 * `cwaPage0` exists ONLY on that route: the module's own catch-alls are `/`, `/:cwaPage1`,
 * `/:cwaPage1/:cwaPage2`… (`createDefaultCwaPages`, `module.ts`). So navigating to a bare IRI
 * *string* (`navigateTo(pageIri)`) matches a catch-all with no `cwaPage0`, and `fetchRoute` falls
 * back to treating the whole IRI as a route path — a primary fetch that can only 404, taking over
 * the screen with the error page while the URL stays put.
 */
describe('#246 viewing a resource by IRI', () => {
  test('the _cwa-resource-page route (cwaPage0 param) fetches the page and its manifest by uuid', async () => {
    const h = buildHarness(cassette as never, { manual: true })
    const route = { path: `/_cwa/${PAGE}`, params: { cwaPage0: PAGE }, meta: {}, query: {}, fullPath: PAGE } as never
    h.fetcher.fetchRoute(route).catch(() => {})
    await flush(20)

    expect(h.replay.pending()).toEqual(expect.arrayContaining([PAGE, `/_api/_/resource_manifest/${UUID}`]))
  })

  test('a bare IRI used as a path requests a nonsense route, which is why navigations must not do it', async () => {
    const h = buildHarness(cassette as never, { manual: true })
    h.fetcher.fetchRoute(h.route(PAGE)).catch(() => {})
    await flush(20)

    // the whole IRI appended to /_/routes/ — no such resource exists, so this is always a 404
    expect(h.replay.pending()).toContain(`/_api/_/routes/${PAGE}`)
    expect(h.replay.pending()).not.toContain(PAGE)
  })
})
