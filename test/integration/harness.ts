/**
 * #246 — Boot harness: assembles the REAL fetch pipeline (Fetcher + FetchStatusManager + Pinia
 * stores + Resources) wired to a ReplayCwaFetch, so integration tests drive `fetchRoute` against
 * recorded responses and assert the resulting store/render state — deterministically, with no live
 * API. Mercure / ApiDocumentation are no-op stubs (nav doesn't depend on them); `#imports`
 * (`useError`/`clearError`) must be mocked by the importing spec.
 */
import { createPinia, setActivePinia } from 'pinia'
import { ResourcesStore } from '#cwa/storage/stores/resources/resources-store'
import { FetcherStore } from '#cwa/storage/stores/fetcher/fetcher-store'
import { ResourceTypeFromIri } from '#cwa/resources/resource-utils'
import FetchStatusManager from '#cwa/api/fetcher/fetch-status-manager'
import Fetcher from '#cwa/api/fetcher/fetcher'
import { Resources } from '#cwa/resources/resources'
import { ReplayCwaFetch } from './replay-cwa-fetch'
import type { Cassette } from './replay-cwa-fetch'

const API_PREFIX = '/_api'

export function buildHarness(cassette: Cassette, opts: { manual?: boolean } = {}) {
  ResourceTypeFromIri.setPathPrefix(API_PREFIX)
  setActivePinia(createPinia())

  const resourcesStoreDef = new ResourcesStore('cwa')
  const fetcherStoreDef = new FetcherStore('cwa')
  const replay = new ReplayCwaFetch(cassette, { manual: opts.manual })

  const mercure = { setMercureHubFromLinkHeader() {}, setDocsPathFromLinkHeader() {}, init() {} }
  const apiDocumentation = { setDocsPathFromLinkHeader() {} }
  const router = { currentRoute: { value: { query: {} } } }

  const manager = new FetchStatusManager(fetcherStoreDef, mercure as never, apiDocumentation as never, resourcesStoreDef)
  const fetcher = new Fetcher(replay as never, manager, router as never, resourcesStoreDef)
  const resources = new Resources(resourcesStoreDef, fetcherStoreDef)

  // a minimal RouteLocationNormalizedLoaded, as the route middleware would hand to fetchRoute
  const route = (path: string, meta: Record<string, unknown> = {}) => ({ path, params: {}, meta, query: {}, fullPath: path }) as never

  return {
    fetcher,
    manager,
    resources,
    replay,
    resourcesStore: resourcesStoreDef.useStore(),
    fetcherStore: fetcherStoreDef.useStore(),
    route,
  }
}
