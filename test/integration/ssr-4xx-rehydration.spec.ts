// @vitest-environment nuxt

import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { computed, nextTick, reactive } from 'vue'
import * as cwaComposables from '#cwa/composables/cwa'
import * as processComposables from '#cwa/composables/process'
import CwaFetch from '#cwa/api/fetcher/cwa-fetch'
import Fetcher from '#cwa/api/fetcher/fetcher'
import FetchStatusManager from '#cwa/api/fetcher/fetch-status-manager'
import { Resources } from '#cwa/resources/resources'
import { ResourceTypeFromIri } from '#cwa/resources/resource-utils'
import { FetcherStore } from '#cwa/storage/stores/fetcher/fetcher-store'
import { ResourcesStore } from '#cwa/storage/stores/resources/resources-store'
import { CwaResourceApiStatuses } from '#cwa/storage/stores/resources/state'
import ResourceLoader from '#cwa/templates/components/core/ResourceLoader.vue'

mockNuxtImport('useRequestHeaders', () => () => ({}))

const API_PREFIX = '/_api'
const COMPONENT = `${API_PREFIX}/component/html_contents/draft-uuid`

let server: http.Server
let apiUrl: string
let requestedPaths: string[] = []
let mountedLoader: ReturnType<typeof mount> | undefined

function hydrateAnonymousRenderWith404({ user, isStaticRender = false }: { user?: object, isStaticRender?: boolean } = {}) {
  vi.spyOn(processComposables, 'useProcess').mockReturnValue({ isClient: true, isServer: false })
  ResourceTypeFromIri.setPathPrefix(API_PREFIX)
  setActivePinia(createPinia())

  const resourcesStore = new ResourcesStore('cwa')
  const fetcherStore = new FetcherStore('cwa')
  const cwaFetch = new CwaFetch(apiUrl)
  const mercure = { setMercureHubFromLinkHeader() {}, setDocsPathFromLinkHeader() {}, init() {} }
  const apiDocumentation = { setDocsPathFromLinkHeader() {} }
  const nuxtApp = { runWithContext: (fn: () => unknown) => fn() }
  const manager = new FetchStatusManager(fetcherStore, mercure as never, apiDocumentation as never, resourcesStore, undefined, nuxtApp as never)
  const fetcher = new Fetcher(cwaFetch, manager, { currentRoute: { value: { query: {} } } } as never, resourcesStore)
  const resources = new Resources(resourcesStore, fetcherStore)

  const store = resourcesStore.useStore()
  store.current.byId[COMPONENT] = {
    apiState: {
      status: CwaResourceApiStatuses.ERROR,
      error: { statusCode: 404, statusMessage: 'Not Found', primaryMessage: 'Not Found' },
      ssr: true,
      fetchedAt: (new Date()).getTime(),
    },
  } as never
  store.current.allIds.push(COMPONENT)
  store.current.currentIds.push(COMPONENT)

  const authState = reactive<{ user: object | undefined }>({ user })
  const auth = {
    get user() {
      return authState.user
    },
    signedIn: computed(() => !!authState.user),
  }

  vi.spyOn(cwaComposables, 'useCwa').mockImplementation(() => ({
    auth,
    fetchResource: (event: never) => fetcher.fetchResource(event),
    resources,
    isStaticRender,
  } as never))

  return {
    resources,
    signIn: (signedInUser: object) => {
      authState.user = signedInUser
    },
    mountLoader: () => {
      mountedLoader = mount(ResourceLoader, { shallow: true, props: { iri: COMPONENT } })
      return mountedLoader
    },
  }
}

async function settle() {
  await nextTick()
  await new Promise(resolve => setTimeout(resolve, 200))
}

describe('#334 hydrating a render that received a 4xx for a component', () => {
  beforeAll(async () => {
    server = http.createServer((request, response) => {
      requestedPaths.push(new URL(request.url as string, 'http://api').pathname)
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
    requestedPaths = []
    vi.clearAllMocks()
  })

  afterEach(async () => {
    mountedLoader?.unmount()
    mountedLoader = undefined
    await settle()
    ResourceTypeFromIri.setPathPrefix(undefined)
    vi.restoreAllMocks()
  })

  test('an anonymous visitor does not request the component again', async () => {
    const { mountLoader } = hydrateAnonymousRenderWith404()

    mountLoader()
    await settle()

    expect(requestedPaths).toEqual([])
  })

  test('an anonymous visitor is shown no loading spinner', async () => {
    const { resources, mountLoader } = hydrateAnonymousRenderWith404()

    expect(resources.isLoading.value).toBe(false)
    const wrapper = mountLoader()
    await nextTick()

    expect(resources.isLoading.value).toBe(false)
    expect(wrapper.html()).not.toContain('spinner')
  })

  test('a signed in visitor requests the component again, so an admin served a cached anonymous page still resolves a draft', async () => {
    const { mountLoader } = hydrateAnonymousRenderWith404({ user: { roles: [] } })

    mountLoader()
    await settle()

    expect(requestedPaths).toEqual([COMPONENT])
  })

  test('an anonymous visitor on a static render requests the component again', async () => {
    const { mountLoader } = hydrateAnonymousRenderWith404({ isStaticRender: true })

    mountLoader()
    await settle()

    expect(requestedPaths).toEqual([COMPONENT])
  })

  test('a visitor who signs in without reloading requests the component', async () => {
    const { signIn, mountLoader } = hydrateAnonymousRenderWith404()

    mountLoader()
    await settle()
    expect(requestedPaths).toEqual([])

    signIn({ roles: [] })
    await settle()

    expect(requestedPaths).toEqual([COMPONENT])
  })
})
