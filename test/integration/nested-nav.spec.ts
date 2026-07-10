// @vitest-environment nuxt
import { describe, test, expect } from 'vitest'
import { buildHarness } from './harness'
import { flush } from './replay-cwa-fetch'
import cassette from '../cassettes/topic-1-nested.json'

// depth-0 = "Topic 1" parent page; depth-1 = chapter-one page (from the recorded manifest)
const TOPIC1_PAGE = '/_api/_/pages/a80262b4-4f1f-4358-ad64-b282dc1897ad'
const CHAPTER_ONE_PAGE = '/_api/_/pages/ac96cf91-d4d5-4b27-af39-9e0d073e60f7'

describe('#246 integration — nested navigation replay', () => {
  test('navigating to a nested route loads parent + child from recorded responses', async () => {
    const h = buildHarness(cassette as never)

    await h.fetcher.fetchRoute(h.route('/topic-1/chapter-one'))
    await flush()

    // the real request sequence was issued against the replay
    expect(h.replay.requestLog).toContain('/_api/_/routes//topic-1/chapter-one')
    expect(h.replay.requestLog).toContain('/_api/_/resource_manifest//topic-1/chapter-one')

    // the nested view resolved: depth-0 parent (Topic 1) + depth-1 child (chapter-one)
    expect(h.resources.pageIriAtDepth(0).value).toBe(TOPIC1_PAGE)
    expect(h.resources.pageIriAtDepth(1).value).toBe(CHAPTER_ONE_PAGE)

    // and the page resources actually have data in the store
    expect(h.resources.getResource(TOPIC1_PAGE).value?.data).toBeTruthy()
    expect(h.resources.getResource(CHAPTER_ONE_PAGE).value?.data).toBeTruthy()
  })
})
