// @vitest-environment nuxt

import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { createPinia, setActivePinia } from 'pinia'
import * as processComposables from '#cwa/composables/process'
import CwaFetch from '#cwa/api/fetcher/cwa-fetch'
import Fetcher from '#cwa/api/fetcher/fetcher'
import FetchStatusManager from '#cwa/api/fetcher/fetch-status-manager'
import MercureClient from '#cwa/api/mercure-client'
import { Resources } from '#cwa/resources/resources'
import { ResourceTypeFromIri } from '#cwa/resources/resource-utils'
import { FetcherStore } from '#cwa/storage/stores/fetcher/fetcher-store'
import { MercureStore } from '#cwa/storage/stores/mercure/mercure-store'
import { ResourcesStore } from '#cwa/storage/stores/resources/resources-store'

mockNuxtImport('useRequestHeaders', () => () => ({}))

const API_PREFIX = '/_api'
const ROUTE = `${API_PREFIX}/_/routes//`
const PAGE = `${API_PREFIX}/_/pages/page-uuid`
const LAYOUT = `${API_PREFIX}/_/layouts/layout-uuid`
const GROUP = `${API_PREFIX}/_/component_groups/group-uuid`
const POSITION = `${API_PREFIX}/_/component_positions/position-uuid`
const COMPONENT = `${API_PREFIX}/component/html_contents/component-uuid`

type Caller = 'visitor' | 'visitorWithNulls' | 'visitorAfterPublish' | 'admin'

const positionFor: Record<Caller, Record<string, unknown>> = {
  visitor: { '@id': POSITION, '@type': 'ComponentPosition', 'componentGroup': GROUP, '_metadata': { persisted: true } },
  visitorWithNulls: { '@id': POSITION, '@type': 'ComponentPosition', 'componentGroup': GROUP, 'component': null, '_metadata': { persisted: true, staticComponent: null } },
  visitorAfterPublish: { '@id': POSITION, '@type': 'ComponentPosition', 'componentGroup': GROUP, 'component': COMPONENT, '_metadata': { persisted: true, staticComponent: COMPONENT } },
  admin: { '@id': POSITION, '@type': 'ComponentPosition', 'componentGroup': GROUP, 'component': COMPONENT, '_metadata': { persisted: true, staticComponent: COMPONENT } },
}

const componentFor: Record<Caller, Record<string, unknown> | undefined> = {
  visitor: undefined,
  visitorWithNulls: undefined,
  visitorAfterPublish: { '@id': COMPONENT, '@type': 'HtmlContent', 'publishedAt': '2026-10-18T10:00:00.000Z', '_metadata': { persisted: true, publishable: { published: true } } },
  admin: { '@id': COMPONENT, '@type': 'HtmlContent', 'publishedAt': null, '_metadata': { persisted: true, publishable: { published: false } } },
}

function manifestFor(caller: Caller) {
  const positionChildren = caller === 'visitor' || caller === 'visitorWithNulls' ? [] : [{ iri: COMPONENT, children: [] }]
  return {
    resource_iris: [{
      iri: ROUTE,
      children: [{
        iri: PAGE,
        children: [
          { iri: LAYOUT, children: [] },
          { iri: GROUP, children: [{ iri: POSITION, children: positionChildren }] },
        ],
      }],
    }],
  }
}

function bodyFor(caller: Caller, path: string): unknown {
  const fixed: Record<string, unknown> = {
    [ROUTE]: { '@id': ROUTE, '@type': 'Route', 'path': '/', 'page': PAGE, '_metadata': { persisted: true } },
    [PAGE]: { '@id': PAGE, '@type': 'Page', 'layout': LAYOUT, 'componentGroups': [GROUP], '_metadata': { persisted: true } },
    [LAYOUT]: { '@id': LAYOUT, '@type': 'Layout', 'componentGroups': [], '_metadata': { persisted: true } },
    [GROUP]: { '@id': GROUP, '@type': 'ComponentGroup', 'componentPositions': [POSITION], '_metadata': { persisted: true } },
    [POSITION]: positionFor[caller],
    [COMPONENT]: componentFor[caller],
    [`${API_PREFIX}/_/resource_manifest//`]: manifestFor(caller),
  }
  return fixed[path]
}

let server: http.Server
let apiUrl: string
let caller: Caller
let requestedPaths: string[]

function buildClientApp() {
  vi.spyOn(processComposables, 'useProcess').mockReturnValue({ isClient: true, isServer: false })
  ResourceTypeFromIri.setPathPrefix(API_PREFIX)
  setActivePinia(createPinia())

  const resourcesStoreDefinition = new ResourcesStore('cwa')
  const fetcherStoreDefinition = new FetcherStore('cwa')
  const cwaFetch = new CwaFetch(apiUrl)
  const mercure = { setMercureHubFromLinkHeader() {}, setDocsPathFromLinkHeader() {}, init() {} }
  const apiDocumentation = { setDocsPathFromLinkHeader() {} }
  const nuxtApp = { runWithContext: (fn: () => unknown) => fn() }
  const manager = new FetchStatusManager(fetcherStoreDefinition, mercure as never, apiDocumentation as never, resourcesStoreDefinition, undefined, nuxtApp as never)
  const fetcher = new Fetcher(cwaFetch, manager, { currentRoute: { value: { query: {} } } } as never, resourcesStoreDefinition)
  const mercureClient = new MercureClient(new MercureStore('cwa'), resourcesStoreDefinition, fetcherStoreDefinition)
  mercureClient.setFetcher(fetcher)

  const store = resourcesStoreDefinition.useStore()
  const fetcherStore = fetcherStoreDefinition.useStore()
  return {
    store,
    fetcherStore,
    manager,
    resources: new Resources(resourcesStoreDefinition, fetcherStoreDefinition),
    fetchHomePage: () => fetcher.fetchRoute({ path: '/', params: {}, meta: {}, query: {}, fullPath: '/' } as never),
    receiveMercureUpdate: (data: Record<string, unknown>) => (mercureClient as unknown as { handleMercureMessage: (event: { data: string, lastEventId: string }) => void })
      .handleMercureMessage({ data: JSON.stringify(data), lastEventId: 'event-1' }),
  }
}

describe('#492 a visitor\'s static position whose component is not live yet', () => {
  beforeAll(async () => {
    server = http.createServer((request, response) => {
      const path = new URL(request.url as string, 'http://api').pathname
      requestedPaths.push(path)
      const body = bodyFor(caller, path)
      if (body) {
        response.writeHead(200, { 'content-type': 'application/ld+json', 'cache-control': 'public, max-age=0, s-maxage=600' })
        response.end(JSON.stringify(body))
        return
      }
      response.writeHead(404, { 'content-type': 'application/ld+json', 'cache-control': 'no-cache, private' })
      response.end(JSON.stringify({ '@type': 'hydra:Error', 'status': 404 }))
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()))
    apiUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}${API_PREFIX}`
  })

  afterAll(() => {
    server.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    requestedPaths = []
    caller = 'visitor'
  })

  afterEach(() => {
    ResourceTypeFromIri.setPathPrefix(undefined)
  })

  test.each<Caller>(['visitor', 'visitorWithNulls'])('is saved without a component, and no component is requested or waited for (%s)', async (shape) => {
    caller = shape
    const { store, fetcherStore, manager, resources, fetchHomePage } = buildClientApp()

    await fetchHomePage()

    const fetchStatus = fetcherStore.fetches[fetcherStore.primaryFetch.successToken as string]
    expect(store.current.byId[POSITION]?.data?.component ?? undefined).toBeUndefined()
    expect(resources.positionComponentIri(POSITION, 0).value ?? undefined).toBeUndefined()
    expect(requestedPaths.filter(path => path.includes('/component/'))).toEqual([])
    expect(fetchStatus?.resources).toContain(POSITION)
    expect(fetchStatus?.resources.filter(iri => iri.includes('/component/'))).toEqual([])
    expect(store.isFetchStatusResourcesResolved(fetchStatus as never)).toBe(true)
    expect(resources.pageLoadProgress.value.percent).toBe(100)
    await expect(manager.getFetchedCurrentResource(POSITION, 50)).resolves.toEqual(positionFor[shape])
  })

  test('re-fetched without a component replaces the stored one, so no earlier component IRI is kept', async () => {
    const { store, manager, resources, fetchHomePage } = buildClientApp()
    caller = 'admin'
    await fetchHomePage()
    expect(resources.positionComponentIri(POSITION, 0).value).toBe(COMPONENT)

    caller = 'visitor'
    manager.clearPrimaryFetch()
    await fetchHomePage()

    expect(store.current.byId[POSITION]?.data).not.toHaveProperty('component')
    expect(resources.positionComponentIri(POSITION, 0).value).toBeUndefined()
  })

  test('is re-fetched after signing in on the login page, which clears the primary fetch, so the admin gets the draft component', async () => {
    const { store, manager, resources, fetchHomePage } = buildClientApp()
    await fetchHomePage()
    expect(resources.positionComponentIri(POSITION, 0).value).toBeUndefined()

    caller = 'admin'
    manager.clearPrimaryFetch()
    await fetchHomePage()

    expect(resources.positionComponentIri(POSITION, 0).value).toBe(COMPONENT)
    expect(store.current.byId[COMPONENT]?.data).toEqual(componentFor.admin)
    expect(resources.findDraftComponentIri(COMPONENT).value).toBe(COMPONENT)
  })

  test('fills in from the position\'s Mercure update once the component goes live', async () => {
    const { store, resources, fetchHomePage, receiveMercureUpdate } = buildClientApp()
    await fetchHomePage()
    requestedPaths = []

    caller = 'visitorAfterPublish'
    receiveMercureUpdate(positionFor.admin)
    await vi.waitFor(() => expect(store.hasNewResources).toBe(true))
    await vi.waitFor(() => expect(requestedPaths).toContain(COMPONENT))
    await vi.waitFor(() => expect(store.new.byId[COMPONENT]).toBeDefined())
    store.mergeNewResources()

    expect(requestedPaths).toEqual([POSITION, COMPONENT])
    expect(resources.positionComponentIri(POSITION, 0).value).toBe(COMPONENT)
    expect(store.current.byId[COMPONENT]?.data).toEqual(componentFor.visitorAfterPublish)
    expect(resources.findPublishedComponentIri(COMPONENT).value).toBe(COMPONENT)
  })

  test('does not re-fetch a component already held when the position\'s Mercure update arrives', async () => {
    const { store, fetchHomePage, receiveMercureUpdate } = buildClientApp()
    caller = 'admin'
    await fetchHomePage()
    requestedPaths = []

    receiveMercureUpdate(positionFor.admin)
    await vi.waitFor(() => expect(requestedPaths).toContain(POSITION))
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(requestedPaths).toEqual([POSITION])
    expect(store.hasNewResources).toBe(false)
  })
})
