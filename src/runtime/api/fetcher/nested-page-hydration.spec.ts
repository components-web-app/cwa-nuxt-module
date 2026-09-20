// @vitest-environment happy-dom

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

const resourceTree: NestedJsonStructure[] = [
  node(parentRouteIri, [node(pageDataIri, [node(parentPageIri, [node(cgIri, [node(posIri, [node(compIri)])])])])]),
  node(childRouteIri, [node(childPageIri)]),
]

const ssrResources: CwaResource[] = [
  res(parentRouteIri, { pageData: pageDataIri, page: parentPageIri }),
  res(pageDataIri, { page: parentPageIri }),
  res(parentPageIri, { componentGroups: [cgIri], isTemplate: true }),
  res(cgIri, { reference: 'cg-parent-ref', componentPositions: [posIri] }),
  res(posIri, { '@type': 'ComponentPosition', 'component': compIri, 'componentGroup': cgIri }),
  res(compIri, { html: '<p>hero</p>' }),
  res(childRouteIri, { page: childPageIri }),
  res(childPageIri, { componentGroups: [], isTemplate: false }),
]

let requestedPositionPaths: (string | undefined)[] = []

function positionResponseFor(pathHeader: string | undefined) {
  const pageDataResolves = pathHeader === PARENT_PATH
  return {
    '@id': posIri,
    '@type': 'ComponentPosition',
    '_metadata': { persisted: true },
    'componentGroup': cgIri,
    'component': pageDataResolves ? compIri : null,
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
    runSsrPrimaryFetch(createManager())
    expect(resourcesStore.current.byId[posIri]?.data?.component).toBe(compIri)

    const clientManager = createManager()
    const clientFetcher = createFetcher(clientManager)

    await clientFetcher.fetchResource({ path: posIri })

    expect(resourcesStore.current.byId[posIri]?.data?.component).toBe(compIri)

    expect(requestedPositionPaths).toEqual([PARENT_PATH])
  })
})

const ROUTELESS_CHILD_PATH = '/programme'

const routelessChildRouteIri = `/_/routes/${ROUTELESS_CHILD_PATH}`
const routelessPageDataIri = '/page_data/conference-2'
const routelessParentPageIri = '/_/pages/conference-template-2'
const routelessChildPageIri = '/_/pages/programme-2'
const routelessCgIri = '/_/component_groups/cg-routeless-parent'
const routelessPosIri = '/_/component_positions/pos-routeless-parent'
const routelessCompIri = '/component/html_contents/hero-2'

const routelessResourceTree: NestedJsonStructure[] = [
  node(routelessPageDataIri, [node(routelessParentPageIri, [node(routelessCgIri, [node(routelessPosIri, [node(routelessCompIri)])])])]),
  node(routelessChildRouteIri, [node(routelessChildPageIri)]),
]

const routelessSsrResources: CwaResource[] = [
  res(routelessPageDataIri, { page: routelessParentPageIri }),
  res(routelessParentPageIri, { componentGroups: [routelessCgIri], isTemplate: true }),
  res(routelessCgIri, { reference: 'cg-routeless-parent-ref', componentPositions: [routelessPosIri] }),
  res(routelessPosIri, { '@type': 'ComponentPosition', 'component': routelessCompIri, 'componentGroup': routelessCgIri }),
  res(routelessCompIri, { html: '<p>hero</p>' }),
  res(routelessChildRouteIri, { page: routelessChildPageIri }),
  res(routelessChildPageIri, { componentGroups: [], isTemplate: false }),
]

let routelessRequestedPositionPaths: (string | undefined)[] = []

function routelessPositionResponseFor(pathHeader: string | undefined) {
  const pageDataResolves = pathHeader === routelessPageDataIri
  return {
    '@id': routelessPosIri,
    '@type': 'ComponentPosition',
    '_metadata': { persisted: true },
    'componentGroup': routelessCgIri,
    'component': pageDataResolves ? routelessCompIri : null,
  }
}

function createRoutelessStubbedCwaFetch() {
  return {
    fetch: {
      raw: vi.fn((url: string, opts: { headers: Record<string, string> }) => {
        const pathHeader = opts?.headers?.path
        if (url === routelessPosIri) {
          routelessRequestedPositionPaths.push(pathHeader)
          return Promise.resolve({
            _data: routelessPositionResponseFor(pathHeader),
            headers: { get: () => null },
          })
        }
        const known = routelessSsrResources.find(r => r['@id'] === url)
        return Promise.resolve({
          _data: known,
          headers: { get: () => null },
        })
      }),
    },
  }
}

function createRoutelessFetcher(manager: FetchStatusManager) {
  const vueRouter = { currentRoute: { value: { path: ROUTELESS_CHILD_PATH, query: {} } } }
  return new Fetcher(createRoutelessStubbedCwaFetch() as never, manager, vueRouter as never, resourcesStoreDef)
}

function runRoutelessSsrPrimaryFetch(manager: FetchStatusManager) {
  const { token } = manager.startFetch({
    path: routelessChildRouteIri,
    manifestPath: `/_/resource_manifest/${ROUTELESS_CHILD_PATH}`,
    isPrimary: true,
  })
  manager.setManifestIrisByDepth({ token, resourceIris: routelessResourceTree })
  manager.finishManifestFetch({ token, type: FinishFetchManifestType.SUCCESS })
  for (const resource of routelessSsrResources) {
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

describe('nested page SSR hydration with a routeless data page parent', () => {
  beforeEach(() => {
    routelessRequestedPositionPaths = []
  })

  test('the parent depth is addressed by its page data IRI when it has no route', () => {
    const serverManager = createManager()
    runRoutelessSsrPrimaryFetch(serverManager)

    expect(serverManager.getDepthForIri(routelessPosIri)).toBe(0)
    expect(serverManager.getPathForDepth(0)).toBe(routelessPageDataIri)
    expect(serverManager.getPathForDepth(1)).toBe(ROUTELESS_CHILD_PATH)
  })

  test('a client-side re-fetch after hydration keeps the routeless parent\'s dynamic component loaded', async () => {
    runRoutelessSsrPrimaryFetch(createManager())
    expect(resourcesStore.current.byId[routelessPosIri]?.data?.component).toBe(routelessCompIri)

    const clientManager = createManager()
    const clientFetcher = createRoutelessFetcher(clientManager)

    await clientFetcher.fetchResource({ path: routelessPosIri })

    expect(resourcesStore.current.byId[routelessPosIri]?.data?.component).toBe(routelessCompIri)
    expect(routelessRequestedPositionPaths).toEqual([routelessPageDataIri])
  })
})
