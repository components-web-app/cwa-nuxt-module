// @vitest-environment nuxt
import { describe, test, expect } from 'vitest'
import { buildHarness } from './harness'
import { flush } from './replay-cwa-fetch'
import {
  CHAPTER_ONE_PAGE, CHAPTER_TWO_PAGE, HOME_PAGE,
  load, settle, startNav,
} from './nav-helpers'
import cassette from '../cassettes/topic-1-nested.json'

describe('#246 revisit navigation (reproduces #257 regression)', () => {
  test('revisit: returning to a fully-loaded page shows it again', async () => {
    const h = buildHarness(cassette as never, { manual: true })
    await load(h, '/topic-1/chapter-one')
    expect(h.resources.pageIriAtDepth(1).value).toBe(CHAPTER_ONE_PAGE)

    await load(h, '/topic-1/chapter-two')
    expect(h.resources.pageIriAtDepth(1).value).toBe(CHAPTER_TWO_PAGE)

    await load(h, '/topic-1/chapter-one')
    expect(h.resources.pageIriAtDepth(1).value).toBe(CHAPTER_ONE_PAGE)
  })

  test('revisit: rapid back-and-forth between two loaded pages tracks the latest', async () => {
    const h = buildHarness(cassette as never, { manual: true })
    await load(h, '/topic-1/chapter-one')
    await load(h, '/topic-1/chapter-two')

    await load(h, '/topic-1/chapter-one')
    expect(h.resources.pageIriAtDepth(1).value).toBe(CHAPTER_ONE_PAGE)
    await load(h, '/topic-1/chapter-two')
    expect(h.resources.pageIriAtDepth(1).value).toBe(CHAPTER_TWO_PAGE)
  })

  test('interrupted revisit: revisit a cached page, interrupt with another cached page → lands on the second', async () => {
    const h = buildHarness(cassette as never, { manual: true })
    await load(h, '/topic-1/chapter-one')
    await load(h, '/topic-1/chapter-two')

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
    await load(h, '/')
    await load(h, '/topic-1/chapter-two')

    startNav(h, '/topic-1/chapter-one')
    await flush(20)
    startNav(h, '/')
    await flush(20)
    await settle(h)
    expect(h.resources.pageIriAtDepth(0).value).toBe(HOME_PAGE)

    await load(h, '/topic-1/chapter-two')
    expect(h.resources.pageIriAtDepth(1).value).toBe(CHAPTER_TWO_PAGE)
  })
})
