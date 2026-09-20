// @vitest-environment nuxt
import { describe, test, expect } from 'vitest'
import { buildHarness } from './harness'
import { flush } from './replay-cwa-fetch'
import cassette from '../cassettes/topic-1-nested.json'

const PAGE = '/_api/_/pages/88688683-ee11-49df-8d65-da537fd38b2b'
const UUID = '88688683-ee11-49df-8d65-da537fd38b2b'

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

    expect(h.replay.pending()).toContain(`/_api/_/routes/${PAGE}`)
    expect(h.replay.pending()).not.toContain(PAGE)
  })
})
