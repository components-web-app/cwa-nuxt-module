// @vitest-environment happy-dom

import { describe, test, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { Resources } from './resources'
import { ResourcesStore } from '#cwa/storage/stores/resources/resources-store'
import { FetcherStore } from '#cwa/storage/stores/fetcher/fetcher-store'
import { FinishFetchManifestType } from '#cwa/storage/stores/fetcher/actions'
import FetchStatusManager from '#cwa/api/fetcher/fetch-status-manager'
import { flattenManifestNode } from '#cwa/storage/stores/fetcher/manifest-utils'
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
  manager = new FetchStatusManager(fetcherStoreDef, {} as never, {} as never, resourcesStoreDef)
  resources = new Resources(resourcesStoreDef, fetcherStoreDef)
})

function res(iri: string, extra: Record<string, any> = {}): CwaResource {
  return { '@id': iri, '@type': 'Test', '_metadata': {}, ...extra } as unknown as CwaResource
}

function node(iri: string, children: NestedJsonStructure[] = []): NestedJsonStructure {
  return { iri, children } as NestedJsonStructure
}

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

function startPrimary(path: string, manifestPath: string): string {
  return manager.startFetch({ path, manifestPath, isPrimary: true }).token
}

function deliverManifest(token: string, tree: NestedJsonStructure[]) {
  fetcherStore.setManifestIrisByDepth({ token, resourceIris: tree })
  fetcherStore.finishManifestFetch({ token, type: FinishFetchManifestType.SUCCESS })
}

function beginResource(token: string, iri: string) {
  if (fetcherStore.addFetchResource({ token, resource: iri, path: iri })) {
    resourcesStore.setResourceFetchStatus({ iri, isComplete: false, path: iri, headers: {} })
  }
}

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

function displayFetchStatus() {
  return (resources as unknown as { displayFetchStatus: unknown }).displayFetchStatus
}

function assertNeverBlank(label: string, mustRetainIris: string[], expectedDepth0PageIri?: string) {
  expect(displayFetchStatus(), `${label}: displayFetchStatus is undefined → whole page blanks`).toBeDefined()
  const depth0 = resources.pageIriAtDepth(0).value
  expect(depth0, `${label}: pageIriAtDepth(0) is undefined → KeepAlive remount blanks the page`).toBeDefined()
  if (expectedDepth0PageIri) {
    expect(depth0, `${label}: depth-0 page IRI unexpectedly changed`).toBe(expectedDepth0PageIri)
  }
  for (const iri of mustRetainIris) {
    expect(resources.getResource(iri).value?.data, `${label}: cached resource ${iri} lost its data`).toBeTruthy()
  }
}

describe('#256 navigation retention', () => {
  test('returning to a previously-loaded page never blanks its cached content', () => {
    const a = buildPage('a')
    const b = buildPage('b')

    fullyLoad(a)
    fullyLoad(b)

    expect(resources.pageIriAtDepth(0).value).toBe(b.pageIri)
    for (const iri of a.iris) {
      expect(resources.getResource(iri).value?.data, `precondition: ${iri} cached`).toBeTruthy()
    }

    const token = startPrimary(a.routeIri, `${a.routeIri}/manifest`)
    assertNeverBlank('after startFetch(A) — A shown instantly from cache', a.iris, a.pageIri)

    deliverManifest(token, a.tree)
    assertNeverBlank('after A manifest arrives', a.iris, a.pageIri)

    for (const resource of a.resourcesList) {
      beginResource(token, resource['@id'])
      assertNeverBlank(`after ${resource['@id']} → IN_PROGRESS`, a.iris, a.pageIri)
    }

    for (const resource of a.resourcesList) {
      resolveResource(resource)
      assertNeverBlank(`after ${resource['@id']} resolves`, a.iris, a.pageIri)
    }

    fetcherStore.finishFetch({ token })
    assertNeverBlank('after finishFetch(A)', a.iris, a.pageIri)
    expect(resources.getComponentGroupByReference('cg-a-ref')?.data).toBeTruthy()
  })

  test('rapid navigation holds the last DISPLAYED page, never reverting to an older one', () => {
    const a = buildPage('a')
    const b = buildPage('b')
    const c = buildPage('c')

    fullyLoad(a)
    expect(resources.pageIriAtDepth(0).value).toBe(a.pageIri)

    const tokenB = startPrimary(b.routeIri, `${b.routeIri}/manifest`)
    deliverManifest(tokenB, b.tree)
    for (const resource of b.resourcesList) {
      beginResource(tokenB, resource['@id'])
      resolveResource(resource)
    }
    expect(resources.pageIriAtDepth(0).value).toBe(b.pageIri)

    const tokenC = startPrimary(c.routeIri, `${c.routeIri}/manifest`)

    assertNeverBlank('rapid: holding B while C loads', b.iris, b.pageIri)
    expect(resources.pageIriAtDepth(0).value).not.toBe(a.pageIri)

    deliverManifest(tokenC, c.tree)
    for (const resource of c.resourcesList) {
      beginResource(tokenC, resource['@id'])
      resolveResource(resource)
    }
    fetcherStore.finishFetch({ token: tokenC })
    assertNeverBlank('rapid: after finishFetch(C)', c.iris, c.pageIri)

    expect(fetcherStore.primaryFetch.displayedToken).toBe(fetcherStore.primaryFetch.successToken)
  })

  test('clicking away (to home) while a nested child is still loading does NOT get stuck holding the half-loaded nested page', () => {
    const parent = buildPage('parent')
    const overview = buildPage('overview')
    const child2 = buildPage('child2')
    const home = buildPage('home')

    const overviewNested: NestedJsonStructure[] = [parent.tree[0], overview.tree[0]]
    const child2Nested: NestedJsonStructure[] = [parent.tree[0], child2.tree[0]]

    fullyLoadView(overview.routeIri, overviewNested, [...parent.resourcesList, ...overview.resourcesList])
    expect(resources.pageIriAtDepth(0).value).toBe(parent.pageIri)
    expect(resources.pageIriAtDepth(1).value).toBe(overview.pageIri)

    const tokenChild2 = startPrimary(child2.routeIri, `${child2.routeIri}/manifest`)
    deliverManifest(tokenChild2, child2Nested)
    for (const resource of parent.resourcesList) {
      beginResource(tokenChild2, resource['@id'])
      resolveResource(resource)
    }

    const tokenHome = startPrimary(home.routeIri, `${home.routeIri}/manifest`)

    const heldDepth1 = resources.pageIriAtDepth(1).value
    if (heldDepth1) {
      expect(
        resources.getResource(heldDepth1).value?.data,
        'held view depth-1 must have data (not a half-loaded nested page)',
      ).toBeTruthy()
    }

    deliverManifest(tokenHome, home.tree)
    for (const resource of home.resourcesList) {
      beginResource(tokenHome, resource['@id'])
      resolveResource(resource)
    }
    fetcherStore.finishFetch({ token: tokenHome })
    expect(resources.pageIriAtDepth(0).value).toBe(home.pageIri)
  })

  test('navigating to a nested child never blanks the shared parent (depth 0)', () => {
    const p = buildPage('parent')
    fullyLoad(p)
    expect(resources.pageIriAtDepth(0).value).toBe(p.pageIri)

    const child = buildPage('child')
    const childRouteIri = '/_/routes//parent/child'
    const nestedTree: NestedJsonStructure[] = [p.tree[0], child.tree[0]]

    const token = startPrimary(childRouteIri, `${childRouteIri}/manifest`)
    assertNeverBlank('nested: after startFetch(child) — still showing parent', p.iris, p.pageIri)

    deliverManifest(token, nestedTree)
    assertNeverBlank('nested: after manifest', p.iris)
    expect(resources.pageIriAtDepth(0).value).toBe(p.pageIri)

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

  test('#257: a fully-loaded route caches its manifest structure, surviving navigation away', () => {
    const a = buildPage('a')
    const b = buildPage('b')

    fullyLoad(a)
    fullyLoad(b)

    const cached = fetcherStore.routeCache.get(a.routeIri)
    expect(cached).toBeDefined()
    expect(cached!.irisByDepth).toEqual(a.tree.map(flattenManifestNode))
    expect(cached!.resourceIris).toEqual(expect.arrayContaining(a.iris))
    expect(resources.getResource(a.pageIri).value?.data).toBeTruthy()
  })

  test('#257: the route cache is bounded by routeCacheLimit — LRU evicts oldest routes + their owned resources', async () => {
    manager = new FetchStatusManager(fetcherStoreDef, {} as never, {} as never, resourcesStoreDef, 2)
    const pages = [buildPage('p0'), buildPage('p1'), buildPage('p2')]

    for (const p of pages) {
      const token = startPrimary(p.routeIri, `${p.routeIri}/manifest`)
      deliverManifest(token, p.tree)
      for (const r of p.resourcesList) {
        beginResource(token, r['@id'])
        resolveResource(r)
      }
      await manager.finishFetch({ token })
    }

    expect(fetcherStore.routeCache.has(pages[0].routeIri)).toBe(false)
    expect(fetcherStore.routeCache.has(pages[1].routeIri)).toBe(true)
    expect(fetcherStore.routeCache.has(pages[2].routeIri)).toBe(true)
    expect(resources.getResource(pages[0].pageIri).value?.data).toBeFalsy()
    expect(resources.getResource(pages[2].pageIri).value?.data).toBeTruthy()
  })

  test('#257: LRU eviction is reference-counted — a shared resource survives while another route needs it', async () => {
    const parent = buildPage('shared-parent')
    const child1 = buildPage('child1')
    const child2 = buildPage('child2')
    const c1Route = '/_/routes//s/child1'
    const c2Route = '/_/routes//s/child2'
    const nested1: NestedJsonStructure[] = [parent.tree[0], child1.tree[0]]
    const nested2: NestedJsonStructure[] = [parent.tree[0], child2.tree[0]]

    manager = new FetchStatusManager(fetcherStoreDef, {} as never, {} as never, resourcesStoreDef, 1)

    let token = startPrimary(c1Route, `${c1Route}/manifest`)
    deliverManifest(token, nested1)
    for (const r of [...parent.resourcesList, ...child1.resourcesList]) {
      beginResource(token, r['@id'])
      resolveResource(r)
    }
    await manager.finishFetch({ token })

    token = startPrimary(c2Route, `${c2Route}/manifest`)
    deliverManifest(token, nested2)
    for (const r of [...parent.resourcesList, ...child2.resourcesList]) {
      beginResource(token, r['@id'])
      resolveResource(r)
    }
    await manager.finishFetch({ token })

    expect(fetcherStore.routeCache.has(c1Route)).toBe(false)
    expect(fetcherStore.routeCache.has(c2Route)).toBe(true)
    expect(resources.getResource(child1.pageIri).value?.data).toBeFalsy()
    expect(resources.getResource(parent.pageIri).value?.data).toBeTruthy()
  })

  test('#257: revisiting a fully-cached route renders instantly with NO manifest round-trip, then revalidates', () => {
    const a = buildPage('a')
    const b = buildPage('b')

    fullyLoad(a)
    fullyLoad(b)
    expect(resources.pageIriAtDepth(0).value).toBe(b.pageIri)

    const token = startPrimary(a.routeIri, `${a.routeIri}/manifest`)
    expect(resources.pageIriAtDepth(0).value).toBe(a.pageIri)
    expect(resources.getResource(a.pageIri).value?.data).toBeTruthy()

    deliverManifest(token, a.tree)
    for (const resource of a.resourcesList) {
      beginResource(token, resource['@id'])
      expect(resources.pageIriAtDepth(0).value).toBe(a.pageIri)
    }
    for (const resource of a.resourcesList) {
      resolveResource(resource)
    }
    fetcherStore.finishFetch({ token })
    expect(resources.pageIriAtDepth(0).value).toBe(a.pageIri)
  })

  test('#257: a route that is NOT fully cached (a resource evicted) falls back to a normal fetch', () => {
    const a = buildPage('a')
    const b = buildPage('b')

    fullyLoad(a)
    fullyLoad(b)

    delete (resourcesStore.current.byId as Record<string, unknown>)[a.compIri]

    const token = startPrimary(a.routeIri, `${a.routeIri}/manifest`)
    expect(resources.pageIriAtDepth(0).value).toBe(b.pageIri)

    deliverManifest(token, a.tree)
    for (const resource of a.resourcesList) {
      beginResource(token, resource['@id'])
      resolveResource(resource)
    }
    fetcherStore.finishFetch({ token })
    expect(resources.pageIriAtDepth(0).value).toBe(a.pageIri)
  })
})
