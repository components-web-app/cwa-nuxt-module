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
import { buildPageCacheHeaders } from '#cwa/api/http-cache'
import { Resources } from '#cwa/resources/resources'
import { ResourceTypeFromIri } from '#cwa/resources/resource-utils'
import { FetcherStore } from '#cwa/storage/stores/fetcher/fetcher-store'
import { ResourcesStore } from '#cwa/storage/stores/resources/resources-store'

mockNuxtImport('useRequestHeaders', () => () => ({}))

const API_PREFIX = '/_api'
const ROUTE = `${API_PREFIX}/_/routes//`
const PAGE = `${API_PREFIX}/_/pages/page-uuid`
const LAYOUT = `${API_PREFIX}/_/layouts/layout-uuid`
const GROUP = `${API_PREFIX}/_/component_groups/group-uuid`
const POSITION = `${API_PREFIX}/_/component_positions/position-uuid`
const DRAFT_COMPONENT = `${API_PREFIX}/component/html_contents/draft-uuid`

const publicResources: Record<string, unknown> = {
  [ROUTE]: { '@id': ROUTE, '@type': 'Route', 'path': '/', 'page': PAGE, '_metadata': { persisted: true } },
  [PAGE]: { '@id': PAGE, '@type': 'Page', 'layout': LAYOUT, 'componentGroups': [GROUP], '_metadata': { persisted: true } },
  [LAYOUT]: { '@id': LAYOUT, '@type': 'Layout', 'componentGroups': [], '_metadata': { persisted: true } },
  [GROUP]: { '@id': GROUP, '@type': 'ComponentGroup', 'componentPositions': [POSITION], '_metadata': { persisted: true } },
  [POSITION]: { '@id': POSITION, '@type': 'ComponentPosition', 'component': DRAFT_COMPONENT, '_metadata': { persisted: true } },
  [`${API_PREFIX}/_/resource_manifest//`]: {
    resource_iris: [{
      iri: ROUTE,
      children: [{
        iri: PAGE,
        children: [
          { iri: LAYOUT, children: [] },
          { iri: GROUP, children: [{ iri: POSITION, children: [{ iri: DRAFT_COMPONENT, children: [] }] }] },
        ],
      }],
    }],
  },
}

const hiddenComponentResources: Record<string, unknown> = {
  ...publicResources,
  [POSITION]: { '@id': POSITION, '@type': 'ComponentPosition', '_metadata': { persisted: true } },
  [`${API_PREFIX}/_/resource_manifest//`]: {
    resource_iris: [{
      iri: ROUTE,
      children: [{
        iri: PAGE,
        children: [
          { iri: LAYOUT, children: [] },
          { iri: GROUP, children: [{ iri: POSITION, children: [] }] },
        ],
      }],
    }],
  },
}

let server: http.Server
let apiUrl: string

function buildAnonymousRender() {
  vi.spyOn(processComposables, 'useProcess').mockReturnValue({ isClient: false, isServer: true })
  ResourceTypeFromIri.setPathPrefix(API_PREFIX)
  setActivePinia(createPinia())

  const resourcesStore = new ResourcesStore('cwa')
  const fetcherStore = new FetcherStore('cwa')
  const cwaFetch = new CwaFetch(apiUrl)
  const mercure = { setMercureHubFromLinkHeader() {}, setDocsPathFromLinkHeader() {}, init() {} }
  const apiDocumentation = { setDocsPathFromLinkHeader() {} }
  const nuxtApp = { runWithContext: (fn: () => unknown) => fn() }
  const manager = new FetchStatusManager(fetcherStore, mercure as never, apiDocumentation as never, resourcesStore, undefined, nuxtApp as never)
  manager.onIncompleteRender(() => cwaFetch.markUnstorable())
  const fetcher = new Fetcher(cwaFetch, manager, { currentRoute: { value: { query: {} } } } as never, resourcesStore)

  return {
    cwaFetch,
    resources: new Resources(resourcesStore, fetcherStore),
    fetchHomePage: () => fetcher.fetchRoute({ path: '/', params: {}, meta: {}, query: {}, fullPath: '/' } as never),
    fetchPage: (path: string) => fetcher.fetchRoute({ path, params: {}, meta: {}, query: {}, fullPath: path } as never),
  }
}

describe('#324 #492 an anonymous render of a page placing an unpublished component', () => {
  beforeAll(async () => {
    server = http.createServer((request, response) => {
      const path = new URL(request.url as string, 'http://api').pathname
      const body = hiddenComponentResources[path]
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
  })

  afterEach(() => {
    ResourceTypeFromIri.setPathPrefix(undefined)
  })

  test('is cached and tagged with the position IRI and not the hidden component\'s, which the bundle purges when the component is published', async () => {
    const { cwaFetch, resources, fetchHomePage } = buildAnonymousRender()

    await fetchHomePage()

    const decision = buildPageCacheHeaders({
      ids: resources.allIds,
      api: cwaFetch.httpCacheState,
      options: { enabled: true, sharedMaxAge: 3600, staleWhileRevalidate: 0 },
    })

    expect(decision.cacheControl).toBe('public, max-age=0, s-maxage=600')
    expect(decision.surrogateKey?.split(', ')).toContain(POSITION)
    expect(decision.surrogateKey?.split(', ')).not.toContain(DRAFT_COMPONENT)
  })
})

describe('#325 #492 an anonymous render of a page placing a component scheduled to go live', () => {
  const MANIFEST = `${API_PREFIX}/_/resource_manifest//`
  const SECONDS_TO_GO_LIVE = 120
  let expiringPath: string

  beforeAll(async () => {
    server = http.createServer((request, response) => {
      const path = new URL(request.url as string, 'http://api').pathname
      const body = hiddenComponentResources[path]
      if (body) {
        const date = Math.floor(Date.now() / 1000) * 1000
        response.writeHead(200, {
          'content-type': 'application/ld+json',
          'cache-control': 'public, max-age=0, s-maxage=600',
          'date': new Date(date).toUTCString(),
          ...(path === expiringPath ? { expires: new Date(date + SECONDS_TO_GO_LIVE * 1000).toUTCString() } : {}),
        })
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
  })

  afterEach(() => {
    ResourceTypeFromIri.setPathPrefix(undefined)
  })

  test.each([
    ['the position', POSITION],
    ['the manifest', MANIFEST],
  ])('expires at go-live when %s carries Expires, because nothing purges the page then', async (_name, path) => {
    expiringPath = path
    const { cwaFetch, resources, fetchHomePage } = buildAnonymousRender()

    await fetchHomePage()

    const decision = buildPageCacheHeaders({
      ids: resources.allIds,
      api: cwaFetch.httpCacheState,
      options: { enabled: true, sharedMaxAge: 3600, staleWhileRevalidate: 0 },
    })

    expect(decision.cacheControl).toBe(`public, max-age=0, s-maxage=${SECONDS_TO_GO_LIVE}`)
  })
})

describe('#340 an anonymous render whose route is not live yet', () => {
  beforeAll(async () => {
    server = http.createServer((request, response) => {
      const path = new URL(request.url as string, 'http://api').pathname
      const body = publicResources[path]
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
  })

  afterEach(() => {
    ResourceTypeFromIri.setPathPrefix(undefined)
  })

  test('is not storable, so the 404 cannot outlive the go-live date', async () => {
    const { cwaFetch, resources, fetchPage } = buildAnonymousRender()

    await fetchPage('/scheduled')

    const decision = buildPageCacheHeaders({
      ids: resources.allIds,
      api: cwaFetch.httpCacheState,
      options: { enabled: true, sharedMaxAge: 3600, staleWhileRevalidate: 0 },
    })

    expect(decision).toEqual({ unstorable: true })
  })
})

describe('#401 an anonymous render during a cold cache, when the API sheds load', () => {
  let componentResponses: number[]

  beforeAll(async () => {
    server = http.createServer((request, response) => {
      const path = new URL(request.url as string, 'http://api').pathname
      if (path === DRAFT_COMPONENT) {
        const status = componentResponses.shift() ?? 200
        response.writeHead(status, { 'content-type': 'application/ld+json', 'cache-control': 'public, max-age=0, s-maxage=600' })
        response.end(JSON.stringify(status === 200 ? { '@id': DRAFT_COMPONENT, '@type': 'HtmlContent', '_metadata': { persisted: true } } : { '@type': 'hydra:Error', 'status': status }))
        return
      }
      const body = publicResources[path]
      response.writeHead(body ? 200 : 404, { 'content-type': 'application/ld+json', 'cache-control': 'public, max-age=0, s-maxage=600' })
      response.end(JSON.stringify(body ?? { '@type': 'hydra:Error', 'status': 404 }))
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()))
    apiUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}${API_PREFIX}`
  })

  afterAll(() => {
    server.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    ResourceTypeFromIri.setPathPrefix(undefined)
  })

  test('is not storable when a nested component still answers 503 after the retry, so the page missing it is not cached', async () => {
    componentResponses = [503, 503]
    const { cwaFetch, resources, fetchHomePage } = buildAnonymousRender()

    await fetchHomePage()

    const decision = buildPageCacheHeaders({
      ids: resources.allIds,
      api: cwaFetch.httpCacheState,
      options: { enabled: true, sharedMaxAge: 3600, staleWhileRevalidate: 0 },
    })

    expect(componentResponses).toEqual([])
    expect(decision).toEqual({ unstorable: true })
  })

  test('is cached when the retry of a shed request succeeds, because the page is complete', async () => {
    componentResponses = [503]
    const { cwaFetch, resources, fetchHomePage } = buildAnonymousRender()

    await fetchHomePage()

    const decision = buildPageCacheHeaders({
      ids: resources.allIds,
      api: cwaFetch.httpCacheState,
      options: { enabled: true, sharedMaxAge: 3600, staleWhileRevalidate: 0 },
    })

    expect(componentResponses).toEqual([])
    expect(decision.cacheControl).toBe('public, max-age=0, s-maxage=600')
  })
})
