// @vitest-environment happy-dom

/**
 * Reproduction harness for #256 — "cached content blanks/reloads on navigation".
 *
 * These tests drive the REAL fetcher + resources Pinia stores through the exact store-action
 * sequence a primary navigation produces (mirroring `FetchStatusManager`), then assert — at every
 * micro-step of the nav — the invariants that guarantee already-loaded content is never blanked:
 *
 *   1. `displayFetchStatus` is always defined (else `cwa-page.vue` renders nothing).
 *   2. `pageIriAtDepth(0)` is always defined (else `KeepAlive :key="pageIri"` remounts → blank).
 *   3. Any resource that HAD data before the nav still has data (the "IN_PROGRESS is fine, keep the
 *      data if it exists" invariant — data must survive the re-fetch that re-marks it IN_PROGRESS).
 *
 * If these pass, the store/gate layer is sound and the visible flash is a Vue reactivity / KeepAlive
 * timing effect (→ live instrumentation). If any fail, we have reproduced the regression headlessly.
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { Resources } from './resources'
import { ResourcesStore } from '#cwa/storage/stores/resources/resources-store'
import { FetcherStore } from '#cwa/storage/stores/fetcher/fetcher-store'
import { FinishFetchManifestType } from '#cwa/storage/stores/fetcher/actions'
import FetchStatusManager from '#cwa/api/fetcher/fetch-status-manager'
import type { NestedJsonStructure } from '#cwa/storage/stores/fetcher/state'
import type { CwaResource } from '#cwa/resources/resource-utils'

let resourcesStoreDef: ResourcesStore
let fetcherStoreDef: FetcherStore
let resourcesStore: ReturnType<ResourcesStore['useStore']>
let fetcherStore: ReturnType<FetcherStore['useStore']>
let manager: FetchStatusManager
let resources: Resources

beforeEach(() => {
  setActivePinia(createPinia())
  resourcesStoreDef = new ResourcesStore('cwa')
  fetcherStoreDef = new FetcherStore('cwa')
  resourcesStore = resourcesStoreDef.useStore()
  fetcherStore = fetcherStoreDef.useStore()
  // mercure + apiDocumentation are unused on the startFetch path under test
  manager = new FetchStatusManager(fetcherStoreDef, {} as never, {} as never, resourcesStoreDef)
  resources = new Resources(resourcesStoreDef, fetcherStoreDef)
})

// ---- resource fixtures -----------------------------------------------------

function res(iri: string, extra: Record<string, any> = {}): CwaResource {
  return { '@id': iri, '@type': 'Test', '_metadata': {}, ...extra } as unknown as CwaResource
}

function node(iri: string, children: NestedJsonStructure[] = []): NestedJsonStructure {
  return { iri, children } as NestedJsonStructure
}

// A self-contained page: route → pageData → page → componentGroup → position → component
function buildPage(id: string) {
  const routeIri = `/_/routes//${id}`
  const pageDataIri = `/page_data/pd-${id}`
  const pageIri = `/_/pages/pg-${id}`
  const cgIri = `/_/component_groups/cg-${id}`
  const posIri = `/_/component_positions/pos-${id}`
  const compIri = `/component/html_contents/comp-${id}`

  const resourcesList: CwaResource[] = [
    res(routeIri, { pageData: pageDataIri, page: pageIri }),
    res(pageDataIri, { page: pageIri, title: `Title ${id}` }),
    res(pageIri, { componentGroups: [cgIri], isTemplate: false }),
    res(cgIri, { reference: `cg-${id}-ref`, componentPositions: [posIri] }),
    res(posIri, { component: compIri, componentGroup: cgIri }),
    res(compIri, { html: `<p>${id} content</p>` }),
  ]

  const tree: NestedJsonStructure[] = [
    node(routeIri, [node(pageDataIri, [node(pageIri, [node(cgIri, [node(posIri, [node(compIri)])])])])]),
  ]

  return { id, routeIri, pageDataIri, pageIri, cgIri, posIri, compIri, resourcesList, tree, iris: resourcesList.map(r => r['@id']) }
}

// ---- nav step primitives (mirror FetchStatusManager) -----------------------

function startPrimary(path: string, manifestPath: string): string {
  // drive the real manager so its supersession → displayedToken promotion is exercised
  return manager.startFetch({ path, manifestPath, isPrimary: true }).token
}

function deliverManifest(token: string, tree: NestedJsonStructure[]) {
  fetcherStore.setManifestIrisByDepth({ token, resourceIris: tree })
  fetcherStore.finishManifestFetch({ token, type: FinishFetchManifestType.SUCCESS })
}

// mark a resource IN_PROGRESS as the batch begins fetching it (retains any existing data)
function beginResource(token: string, iri: string) {
  if (fetcherStore.addFetchResource({ token, resource: iri, path: iri })) {
    resourcesStore.setResourceFetchStatus({ iri, isComplete: false, path: iri, headers: {} })
  }
}

// resolve a resource: save its data and mark SUCCESS
function resolveResource(resource: CwaResource) {
  const iri = resource['@id']
  resourcesStore.saveResource({ resource })
  resourcesStore.setResourceFetchStatus({ iri, isComplete: true, path: iri, headers: {}, responseIri: iri })
}

function fullyLoad(page: ReturnType<typeof buildPage>): string {
  const token = startPrimary(page.routeIri, `${page.routeIri}/manifest`)
  deliverManifest(token, page.tree)
  for (const resource of page.resourcesList) {
    beginResource(token, resource['@id'])
    resolveResource(resource)
  }
  fetcherStore.finishFetch({ token })
  return token
}

// Fully load an arbitrary (possibly multi-depth) view from an explicit tree + resource list.
function fullyLoadView(routeIri: string, tree: NestedJsonStructure[], resourceList: CwaResource[]): string {
  const token = startPrimary(routeIri, `${routeIri}/manifest`)
  deliverManifest(token, tree)
  for (const resource of resourceList) {
    beginResource(token, resource['@id'])
    resolveResource(resource)
  }
  fetcherStore.finishFetch({ token })
  return token
}

// ---- the invariant assertion ----------------------------------------------

function displayFetchStatus() {
  return (resources as unknown as { displayFetchStatus: unknown }).displayFetchStatus
}

function assertNeverBlank(label: string, mustRetainIris: string[], expectedDepth0PageIri?: string) {
  // 1. page-level render surface never collapses
  expect(displayFetchStatus(), `${label}: displayFetchStatus is undefined → whole page blanks`).toBeDefined()
  const depth0 = resources.pageIriAtDepth(0).value
  expect(depth0, `${label}: pageIriAtDepth(0) is undefined → KeepAlive remount blanks the page`).toBeDefined()
  if (expectedDepth0PageIri) {
    expect(depth0, `${label}: depth-0 page IRI unexpectedly changed`).toBe(expectedDepth0PageIri)
  }
  // 2. cached content data is retained even while IN_PROGRESS
  for (const iri of mustRetainIris) {
    expect(resources.getResource(iri).value?.data, `${label}: cached resource ${iri} lost its data`).toBeTruthy()
  }
}

// ---------------------------------------------------------------------------

describe('#256 navigation retention', () => {
  test('returning to a previously-loaded page never blanks its cached content', () => {
    const a = buildPage('a')
    const b = buildPage('b')

    fullyLoad(a)
    fullyLoad(b)

    // We are now displaying page B. Page A's resources remain cached in byId (retained on nav).
    expect(resources.pageIriAtDepth(0).value).toBe(b.pageIri)
    for (const iri of a.iris) {
      expect(resources.getResource(iri).value?.data, `precondition: ${iri} cached`).toBeTruthy()
    }

    // Navigate BACK to page A — every step must keep A's cached content visible (or B's until switch).
    const token = startPrimary(a.routeIri, `${a.routeIri}/manifest`)
    assertNeverBlank('after startFetch(A) — still showing B', a.iris, b.pageIri)

    deliverManifest(token, a.tree)
    assertNeverBlank('after A manifest arrives', a.iris)

    // batch re-fetches A's (cached) resources — each flips to IN_PROGRESS; data must survive
    for (const resource of a.resourcesList) {
      beginResource(token, resource['@id'])
      assertNeverBlank(`after ${resource['@id']} → IN_PROGRESS`, a.iris)
    }

    // resources resolve back to SUCCESS
    for (const resource of a.resourcesList) {
      resolveResource(resource)
      assertNeverBlank(`after ${resource['@id']} resolves`, a.iris)
    }

    fetcherStore.finishFetch({ token })
    assertNeverBlank('after finishFetch(A)', a.iris, a.pageIri)
    expect(resources.getComponentGroupByReference('cg-a-ref')?.data).toBeTruthy()
  })

  test('rapid navigation holds the last DISPLAYED page, never reverting to an older one', () => {
    const a = buildPage('a')
    const b = buildPage('b')
    const c = buildPage('c')

    // Page A fully loads and is displayed.
    fullyLoad(a)
    expect(resources.pageIriAtDepth(0).value).toBe(a.pageIri)

    // Navigate to B and let it early-switch INTO VIEW — but do NOT finish it (user clicks away).
    const tokenB = startPrimary(b.routeIri, `${b.routeIri}/manifest`)
    deliverManifest(tokenB, b.tree)
    for (const resource of b.resourcesList) {
      beginResource(tokenB, resource['@id'])
      resolveResource(resource)
    }
    // B's page has data and is current → it is now the page on screen (early-switched), though it was
    // never promoted to success (no finishFetch — the user navigates again first).
    expect(resources.pageIriAtDepth(0).value).toBe(b.pageIri)

    // Navigate to C before B finished — this supersedes the in-flight B.
    const tokenC = startPrimary(c.routeIri, `${c.routeIri}/manifest`)

    // THE BUG (#256): while C loads, the hold must show B — the page the user was actually looking at —
    // NOT page A (the last fully-resolved success from a click ago).
    assertNeverBlank('rapid: holding B while C loads', b.iris, b.pageIri)
    expect(resources.pageIriAtDepth(0).value).not.toBe(a.pageIri)

    // C completes and takes over cleanly.
    deliverManifest(tokenC, c.tree)
    for (const resource of c.resourcesList) {
      beginResource(tokenC, resource['@id'])
      resolveResource(resource)
    }
    fetcherStore.finishFetch({ token: tokenC })
    assertNeverBlank('rapid: after finishFetch(C)', c.iris, c.pageIri)

    // the superseded, held B fetch is cleaned up once C is displayed (no leak)
    expect(fetcherStore.primaryFetch.displayedToken).toBe(fetcherStore.primaryFetch.successToken)
  })

  test('clicking away (to home) while a nested child is still loading does NOT get stuck holding the half-loaded nested page', () => {
    const parent = buildPage('parent')
    const overview = buildPage('overview')
    const child2 = buildPage('child2')
    const home = buildPage('home')

    const overviewNested: NestedJsonStructure[] = [parent.tree[0], overview.tree[0]]
    const child2Nested: NestedJsonStructure[] = [parent.tree[0], child2.tree[0]]

    // 1. On the nested overview page, fully loaded (depth-0 parent + depth-1 overview).
    fullyLoadView(overview.routeIri, overviewNested, [...parent.resourcesList, ...overview.resourcesList])
    expect(resources.pageIriAtDepth(0).value).toBe(parent.pageIri)
    expect(resources.pageIriAtDepth(1).value).toBe(overview.pageIri)

    // 2. Navigate to sibling nested page child2 — parent early-switches back in, but child2's depth-1
    //    page NEVER loads and the fetch is NOT finished (the user clicks away first).
    const tokenChild2 = startPrimary(child2.routeIri, `${child2.routeIri}/manifest`)
    deliverManifest(tokenChild2, child2Nested)
    for (const resource of parent.resourcesList) {
      beginResource(tokenChild2, resource['@id'])
      resolveResource(resource)
    }
    // child2's own depth-1 resources are deliberately NOT loaded

    // 3. Navigate to home before child2 finished.
    const tokenHome = startPrimary(home.routeIri, `${home.routeIri}/manifest`)

    // The held view must not be a half-loaded nested page whose depth-1 child has no data —
    // that renders parent + a stuck child spinner. It should hold a fully-loaded page instead.
    const heldDepth1 = resources.pageIriAtDepth(1).value
    if (heldDepth1) {
      expect(
        resources.getResource(heldDepth1).value?.data,
        'held view depth-1 must have data (not a half-loaded nested page)',
      ).toBeTruthy()
    }

    // 4. Home finishes and must take over the display.
    deliverManifest(tokenHome, home.tree)
    for (const resource of home.resourcesList) {
      beginResource(tokenHome, resource['@id'])
      resolveResource(resource)
    }
    fetcherStore.finishFetch({ token: tokenHome })
    expect(resources.pageIriAtDepth(0).value).toBe(home.pageIri)
  })

  test('navigating to a nested child never blanks the shared parent (depth 0)', () => {
    // Parent page P, displayed at depth 0.
    const p = buildPage('parent')
    fullyLoad(p)
    expect(resources.pageIriAtDepth(0).value).toBe(p.pageIri)

    // Navigate to /parent/child: depth 0 = parent (shared, cached), depth 1 = child.
    const child = buildPage('child')
    const childRouteIri = '/_/routes//parent/child'
    // manifest carries BOTH depths — depth 0 re-lists the (cached) parent tree, depth 1 the child
    const nestedTree: NestedJsonStructure[] = [p.tree[0], child.tree[0]]

    const token = startPrimary(childRouteIri, `${childRouteIri}/manifest`)
    assertNeverBlank('nested: after startFetch(child) — still showing parent', p.iris, p.pageIri)

    deliverManifest(token, nestedTree)
    assertNeverBlank('nested: after manifest', p.iris)
    // depth-0 must resolve to the shared parent throughout — never undefined, never the child.
    // depth-1 (child) is intentionally NOT rendered yet: we hold the old parent-only view until the
    // early-switch fires (parent re-enters currentIds + SUCCESS), so no old content flashes away.
    expect(resources.pageIriAtDepth(0).value).toBe(p.pageIri)

    // batch re-fetches the shared parent's resources (now in the flattened manifest) + child's
    for (const resource of [...p.resourcesList, ...child.resourcesList]) {
      beginResource(token, resource['@id'])
      assertNeverBlank(`nested: after ${resource['@id']} → IN_PROGRESS`, p.iris, p.pageIri)
    }
    for (const resource of [...p.resourcesList, ...child.resourcesList]) {
      resolveResource(resource)
      assertNeverBlank(`nested: after ${resource['@id']} resolves`, p.iris, p.pageIri)
    }

    fetcherStore.finishFetch({ token })
    assertNeverBlank('nested: after finishFetch', p.iris, p.pageIri)
    expect(resources.pageIriAtDepth(1).value).toBe(child.pageIri)
  })
})
