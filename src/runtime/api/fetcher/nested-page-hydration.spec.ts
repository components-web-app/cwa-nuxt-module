// @vitest-environment happy-dom

/**
 * Reproduction for #261 — a dynamic component position belonging to a DATA PAGE parent loses its
 * resolved `component` after a SERVER-SIDE load of a NESTED (static) child page.
 *
 * ## The contract being broken
 *
 * The `path` header the module sends is depth-aware (`createRequestHeaders`, `fetcher.ts`). A
 * depth-0 resource must be requested with the DEPTH-0 route path, so the API can resolve the
 * position's `pageDataProperty` against the PARENT's page data
 * (`ComponentPositionNormalizer::normalizeForPageData` → `PageDataProvider::getPageData()`, which
 * reads the `path` header). Sending the CHILD route path instead resolves to a static page with no
 * page data, so the API returns the position with `component: null`.
 *
 * That depth lookup (`iriDepths` / `depthPaths`) is populated ONLY by `setManifestIrisByDepth` — a
 * live manifest fetch, or the #257 route-cache prime. It originally lived as plain in-memory Maps on
 * `FetchStatusManager`, which is what this test was written to catch; it now lives in the fetcher
 * store so it survives the payload.
 *
 * ## Why SSR specifically
 *
 * On a server-side load the SERVER builds those maps and fetches everything with correct headers;
 * the Pinia store is serialised into the payload and hydrates fine. But the CLIENT constructs a
 * FRESH `FetchStatusManager` whose maps are EMPTY, and nothing rebuilds them — no manifest fetch
 * runs client-side. Any client-side re-fetch of a depth-0 position (a Mercure position update,
 * `ResourceLoader`'s SSR re-fetch) therefore falls back to `primaryFetchPath` — the CHILD route —
 * and the component silently vanishes a few moments after the page renders correctly.
 *
 * A client-side NAVIGATION is unaffected: it runs a real manifest fetch, so the maps are populated.
 *
 * ## What this test asserts
 *
 * The OUTCOME — that the position still resolves its component — not the header itself. So it fails
 * whether the fallout is an admin placeholder or nothing rendered at all.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import Mercure from '../mercure'
import ApiDocumentation from '../api-documentation'
import { ResourcesStore } from '../../storage/stores/resources/resources-store'
import { FetcherStore } from '../../storage/stores/fetcher/fetcher-store'
import { FinishFetchManifestType } from '../../storage/stores/fetcher/actions'
import type { NestedJsonStructure } from '../../storage/stores/fetcher/state'
import type { CwaResource } from '../../resources/resource-utils'
import FetchStatusManager from './fetch-status-manager'
import Fetcher from './fetcher'

vi.mock('../mercure')
vi.mock('../api-documentation')

// ---- the page structure ----------------------------------------------------
// Depth 0: /conference        → PageData → Page (isTemplate) → cg → DYNAMIC position → component
// Depth 1: /conference/programme → static Page (no page data)

const PARENT_PATH = '/conference'
const CHILD_PATH = '/conference/programme'

const parentRouteIri = `/_/routes/${PARENT_PATH}`
const childRouteIri = `/_/routes/${CHILD_PATH}`
const pageDataIri = '/page_data/conference-1'
const parentPageIri = '/_/pages/conference-template'
const childPageIri = '/_/pages/programme'
const cgIri = '/_/component_groups/cg-parent'
const posIri = '/_/component_positions/pos-parent'
const compIri = '/component/html_contents/hero-1'

function res(iri: string, extra: Record<string, any> = {}): CwaResource {
  return { '@id': iri, '@type': 'Test', '_metadata': { persisted: true }, ...extra } as unknown as CwaResource
}

function node(iri: string, children: NestedJsonStructure[] = []): NestedJsonStructure {
  return { iri, children } as NestedJsonStructure
}

// The manifest for the nested route: depth 0 = the data-page parent, depth 1 = the static child.
const resourceTree: NestedJsonStructure[] = [
  node(parentRouteIri, [node(pageDataIri, [node(parentPageIri, [node(cgIri, [node(posIri, [node(compIri)])])])])]),
  node(childRouteIri, [node(childPageIri)]),
]

const ssrResources: CwaResource[] = [
  res(parentRouteIri, { pageData: pageDataIri, page: parentPageIri }),
  res(pageDataIri, { page: parentPageIri }),
  res(parentPageIri, { componentGroups: [cgIri], isTemplate: true }),
  res(cgIri, { reference: 'cg-parent-ref', componentPositions: [posIri] }),
  // as the SSR fetch resolved it — correct `path` header, so the component IS resolved
  res(posIri, { '@type': 'ComponentPosition', 'component': compIri, 'componentGroup': cgIri }),
  res(compIri, { html: '<p>hero</p>' }),
  res(childRouteIri, { page: childPageIri }),
  res(childPageIri, { componentGroups: [], isTemplate: false }),
]

// ---- the fake API ----------------------------------------------------------

let requestedPositionPaths: (string | undefined)[] = []

/**
 * Models `ComponentPositionNormalizer::normalizeForPageData`: the position's `pageDataProperty` is
 * resolved against the page data of the route in the `path` header. Only the PARENT route has page
 * data — the nested child is a static page — so any other path yields an unresolved component.
 */
function positionResponseFor(pathHeader: string | undefined) {
  const pageDataResolves = pathHeader === PARENT_PATH
  return {
    '@id': posIri,
    '@type': 'ComponentPosition',
    '_metadata': { persisted: true },
    'componentGroup': cgIri,
    'component': pageDataResolves ? compIri : null,
    // `pageDataProperty` is serialised for admins only, so it is absent for a logged-out request
  }
}

function createStubbedCwaFetch() {
  return {
    fetch: {
      raw: vi.fn((url: string, opts: { headers: Record<string, string> }) => {
        const pathHeader = opts?.headers?.path
        if (url === posIri) {
          requestedPositionPaths.push(pathHeader)
          return Promise.resolve({
            _data: positionResponseFor(pathHeader),
            headers: { get: () => null },
          })
        }
        const known = ssrResources.find(r => r['@id'] === url)
        return Promise.resolve({
          _data: known,
          headers: { get: () => null },
        })
      }),
    },
  }
}

// ---- harness ---------------------------------------------------------------

let resourcesStoreDef: ResourcesStore
let fetcherStoreDef: FetcherStore
let resourcesStore: ReturnType<ResourcesStore['useStore']>
let fetcherStore: ReturnType<FetcherStore['useStore']>

function createManager() {
  return new FetchStatusManager(fetcherStoreDef, new Mercure(), new ApiDocumentation(), resourcesStoreDef)
}

function createFetcher(manager: FetchStatusManager) {
  const vueRouter = { currentRoute: { value: { path: CHILD_PATH, query: {} } } }
  return new Fetcher(createStubbedCwaFetch() as never, manager, vueRouter as never, resourcesStoreDef)
}

/**
 * Drive the SSR primary fetch of the nested route through the REAL manager, exactly as the server
 * does: manifest → depth maps → resources resolved → fetch finished.
 */
function runSsrPrimaryFetch(manager: FetchStatusManager) {
  const { token } = manager.startFetch({
    path: childRouteIri,
    manifestPath: `/_/resource_manifest/${CHILD_PATH}`,
    isPrimary: true,
  })
  manager.setManifestIrisByDepth({ token, resourceIris: resourceTree })
  manager.finishManifestFetch({ token, type: FinishFetchManifestType.SUCCESS })
  for (const resource of ssrResources) {
    const iri = resource['@id']
    if (fetcherStore.addFetchResource({ token, resource: iri, path: iri })) {
      resourcesStore.setResourceFetchStatus({ iri, isComplete: false, path: iri, headers: {} })
    }
    resourcesStore.saveResource({ resource })
    resourcesStore.setResourceFetchStatus({ iri, isComplete: true, path: iri, headers: {}, responseIri: iri })
  }
  fetcherStore.finishFetch({ token })
  return token
}

beforeEach(() => {
  setActivePinia(createPinia())
  resourcesStoreDef = new ResourcesStore('cwa')
  fetcherStoreDef = new FetcherStore('cwa')
  resourcesStore = resourcesStoreDef.useStore()
  fetcherStore = fetcherStoreDef.useStore()
  requestedPositionPaths = []
  vi.clearAllMocks()
})

describe('nested page SSR hydration', () => {
  test('the SSR fetch itself resolves the component (baseline — the server gets this right)', () => {
    const serverManager = createManager()
    runSsrPrimaryFetch(serverManager)

    expect(serverManager.getDepthForIri(posIri)).toBe(0)
    expect(serverManager.getPathForDepth(0)).toBe(PARENT_PATH)
    expect(resourcesStore.current.byId[posIri]?.data?.component).toBe(compIri)
  })

  test('a client-side re-fetch after hydration keeps the component loaded', async () => {
    // 1. SSR: the server manager fetches the nested route correctly and populates the store.
    runSsrPrimaryFetch(createManager())
    expect(resourcesStore.current.byId[posIri]?.data?.component).toBe(compIri)

    // 2. Hydration: the Pinia store transfers via the payload, but the client builds a BRAND NEW
    //    FetchStatusManager. `setManifestIrisByDepth` is never called client-side — no manifest
    //    fetch runs — so its depth maps start (and stay) empty.
    const clientManager = createManager()
    const clientFetcher = createFetcher(clientManager)

    // 3. The client re-fetches the position on mount (Mercure position update / ResourceLoader's
    //    SSR re-fetch both land here).
    await clientFetcher.fetchResource({ path: posIri })

    // 4. The component must still be there. If the wrong `path` header went out, the API could not
    //    resolve the page data and the component is gone — the user sees the position collapse to a
    //    placeholder (admin) or nothing (logged out), moments after the page rendered correctly.
    //    Asserting the OUTCOME, so this fails either way round.
    expect(resourcesStore.current.byId[posIri]?.data?.component).toBe(compIri)

    // and the reason it survived: the depth-0 position was requested with the depth-0 route path
    expect(requestedPositionPaths).toEqual([PARENT_PATH])
  })
})
