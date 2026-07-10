import type { buildHarness } from './harness'
import { flush } from './replay-cwa-fetch'

export type Harness = ReturnType<typeof buildHarness>

// page IRIs from the topic-1-nested cassette
export const TOPIC1_PAGE = '/_api/_/pages/a80262b4-4f1f-4358-ad64-b282dc1897ad' // depth-0 parent ("Topic 1" data page)
export const CHAPTER_ONE_PAGE = '/_api/_/pages/ac96cf91-d4d5-4b27-af39-9e0d073e60f7' // depth-1
export const CHAPTER_TWO_PAGE = '/_api/_/pages/27dc9bc0-49a3-4395-a414-4cc9585236cd' // depth-1 sibling
export const FORM_PAGE = '/_api/_/pages/88688683-ee11-49df-8d65-da537fd38b2b' // standalone
export const HOME_PAGE = '/_api/_/pages/3d594703-c764-4624-8c12-9695d02ef206' // root static

export const isRoute = (p: string) => p.includes('/_/routes/')
export const isManifest = (p: string) => p.includes('/_/resource_manifest/')

// Start a navigation the way the route middleware does — fire-and-forget (NOT awaited). A superseded
// nav legitimately never resolves, so we must not await it; swallow any rejection.
export function startNav(h: Harness, path: string) {
  h.fetcher.fetchRoute(h.route(path)).catch(() => {})
}

// Drive pending requests to completion in a REALISTIC order: routes first (so a redirect can abort /
// a page can early-switch before its batch), then manifests (which enqueue the resource batch), then
// the resources. Drains thoroughly between phases so continuations propagate.
export async function settle(h: Harness) {
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
    await flush(20)
  }
  await flush(20)
}

// Fully load a route to completion (fire-and-forget + settle).
export async function load(h: Harness, path: string) {
  startNav(h, path)
  await settle(h)
}
