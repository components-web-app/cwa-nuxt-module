// @vitest-environment nuxt
import { describe, test, expect } from 'vitest'
import { buildHarness } from './harness'
import { flush } from './replay-cwa-fetch'
import {
  CHAPTER_ONE_PAGE, CHAPTER_TWO_PAGE, HOME_PAGE,
  load, settle, startNav,
} from './nav-helpers'
import cassette from '../cassettes/topic-1-nested.json'

// These exercise REVISITS to already-loaded pages — where #257's instant-revisit priming runs.
// On the reverted baseline they pass; with #257 re-applied they are expected to reproduce the
// "page doesn't change / stuck after a failed switch" regression.
describe('#246 revisit navigation (reproduces #257 regression)', () => {
  test('revisit: returning to a fully-loaded page shows it again', async () => {
    const h = buildHarness(cassette as never, { manual: true })
    await load(h, '/topic-1/chapter-one')
    expect(h.resources.pageIriAtDepth(1).value).toBe(CHAPTER_ONE_PAGE)

    await load(h, '/topic-1/chapter-two')
    expect(h.resources.pageIriAtDepth(1).value).toBe(CHAPTER_TWO_PAGE)

    // revisit chapter-one — it is cached, so instant-revisit applies
    await load(h, '/topic-1/chapter-one')
    expect(h.resources.pageIriAtDepth(1).value).toBe(CHAPTER_ONE_PAGE)
  })

  test('revisit: rapid back-and-forth between two loaded pages tracks the latest', async () => {
    const h = buildHarness(cassette as never, { manual: true })
    await load(h, '/topic-1/chapter-one')
    await load(h, '/topic-1/chapter-two')

    // A → B → A → B, each a full settle
    await load(h, '/topic-1/chapter-one')
    expect(h.resources.pageIriAtDepth(1).value).toBe(CHAPTER_ONE_PAGE)
    await load(h, '/topic-1/chapter-two')
    expect(h.resources.pageIriAtDepth(1).value).toBe(CHAPTER_TWO_PAGE)
  })

  test('interrupted revisit: revisit a cached page, interrupt with another cached page → lands on the second', async () => {
    const h = buildHarness(cassette as never, { manual: true })
    await load(h, '/topic-1/chapter-one')
    await load(h, '/topic-1/chapter-two')

    // revisit chapter-one (instant-revisit primes it), then interrupt with chapter-two before settle
    startNav(h, '/topic-1/chapter-one')
    await flush(20)
    startNav(h, '/topic-1/chapter-two')
    await flush(20)
    await settle(h)

    expect(h.resources.pageIriAtDepth(1).value).toBe(CHAPTER_TWO_PAGE)
  })

  test('stuck check: a failed/interrupted switch must not wedge later navigations', async () => {
    const h = buildHarness(cassette as never, { manual: true })
    await load(h, '/topic-1/chapter-one')
    await load(h, '/') // home cached too
    await load(h, '/topic-1/chapter-two')

    // interrupt a revisit, then navigate cleanly afterwards — the clean nav must still switch
    startNav(h, '/topic-1/chapter-one')
    await flush(20)
    startNav(h, '/') // interrupt with home
    await flush(20)
    await settle(h)
    expect(h.resources.pageIriAtDepth(0).value).toBe(HOME_PAGE)

    // now a normal subsequent navigation must work (not stuck)
    await load(h, '/topic-1/chapter-two')
    expect(h.resources.pageIriAtDepth(1).value).toBe(CHAPTER_TWO_PAGE)
  })
})
