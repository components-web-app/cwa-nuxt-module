// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { consola as logger } from 'consola'
import { computed, ref, shallowRef } from 'vue'
import type { App, Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import type { NuxtApp } from 'nuxt/app'
import { MercureStore } from '#cwa/storage/stores/mercure/mercure-store'
import { ResourcesStore } from '#cwa/storage/stores/resources/resources-store'
import { FetcherStore } from '#cwa/storage/stores/fetcher/fetcher-store'
import { AdminStore } from '#cwa/storage/stores/admin/admin-store'
import * as processComposables from '#cwa/composables/process'
import MercureClient from '#cwa/api/mercure-client'
import ResourceStackManager from '#cwa/admin/resource-stack-manager'
import type Resources from '#cwa/resources/resources'
import { installFakeEventSource } from '../../../test/utils/fake-event-source'

const appCwa = vi.hoisted(() => ({ current: undefined as unknown }))
vi.mock('#cwa/composables/cwa', () => ({ useCwa: () => appCwa.current }))
vi.mock('#app/nuxt', () => ({ useNuxtApp: () => ({ vueApp: { _container: null } }) }))
vi.mock('#cwa/templates/components/main/admin/resource-manager/ComponentFocus.vue', () => ({
  default: { name: 'ComponentFocus', render: () => null },
}))

const LIVE = '/component/html_contents/live'
const DRAFT = '/component/html_contents/draft'
const PAGE = '/_/pages/home'
const OTHER_TAB = { clientId: 'other-tab', userId: '/_/users/2' }

let hub: ReturnType<typeof installFakeEventSource>
const admins: Ref<boolean>[] = []

async function selectedLiveComponentInThisTab() {
  setActivePinia(createPinia())
  const mercureStoreDef = new MercureStore('cwa')
  mercureStoreDef.useStore().hub = 'https://api.test/.well-known/mercure'
  const resourcesStoreDef = new ResourcesStore('cwa')
  const resourcesStore = resourcesStoreDef.useStore()
  resourcesStore.saveResource({ resource: { '@id': LIVE, '@type': 'HtmlContent', 'html': '<p>Hello</p>', '_metadata': { publishable: { published: true, publishedAt: '2026-10-01T00:00:00.000Z' } } } })
  resourcesStore.resetCurrentResources([LIVE])
  const adminStoreDef = new AdminStore('cwa')
  adminStoreDef.useStore().state.isEditing = true
  const stackManager = new ResourceStackManager(adminStoreDef, resourcesStoreDef, {} as Resources, {} as App)
  stackManager.showManager.value = true
  ;(stackManager as unknown as { currentResourceStack: Ref<unknown[]> }).currentResourceStack.value = [{ iri: LIVE, domElements: ref([]), childIris: ref([]) }]
  const admin = ref(true)
  admins.push(admin)
  const writeHeaders: Record<string, string> = {}
  const $cwa = {
    apiUrlBase: 'https://api.test',
    cwaFetch: { writeHeaders, fetch: vi.fn().mockResolvedValue(undefined) },
    resources: { displayPageIri: computed(() => PAGE), pageDataIriOf: () => computed(() => undefined), findAllPublishableIris: (iri: string) => resourcesStore.findAllPublishableIris(iri) },
    admin: { resourceStackManager: stackManager, emptyStack: vi.fn() },
    resourcesManager: { isUpdating: () => false, groupWritesSettled: () => Promise.resolve() },
    auth: { user: { '@id': '/_/users/1' }, get isAdmin() {
      return computed(() => admin.value)
    } },
  }
  appCwa.current = $cwa
  const $router = { currentRoute: shallowRef({ path: '/', meta: {} }) }
  const client = new MercureClient(mercureStoreDef, resourcesStoreDef, new FetcherStore('cwa', resourcesStoreDef), { $cwa, $router } as unknown as NuxtApp)
  client.setRequestCount(computed(() => 0))
  client.init()
  await vi.waitFor(() => expect(writeHeaders['X-CWA-Client-Id']).toBeDefined())
  expect(stackManager.currentIri.value).toBe(LIVE)
  return { resourcesStore, stackManager }
}

async function deliver(data: unknown) {
  hub.deliver(data)
  await flushPromises()
}

const firstSaveInAnotherTab = { '@id': DRAFT, '@type': 'HtmlContent', 'html': '<p>Hello from Sam</p>', 'publishedResource': LIVE, '_metadata': { publishable: { published: false }, lastWrite: OTHER_TAB } }

beforeAll(() => {
  logger.wrapAll()
  logger.mockTypes(() => vi.fn())
})

beforeEach(() => {
  vi.spyOn(processComposables, 'useProcess').mockReturnValue({ isServer: false, isClient: true })
  hub = installFakeEventSource()
})

afterEach(async () => {
  admins.splice(0).forEach((admin) => {
    admin.value = false
  })
  await flushPromises()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('MercureClient: another admin\'s first save to a live component makes a draft (#429)', () => {
  test('a tab with the live component selected moves to that draft, so it edits and shows what was saved there', async () => {
    const { resourcesStore, stackManager } = await selectedLiveComponentInThisTab()

    await deliver(firstSaveInAnotherTab)

    expect(resourcesStore.findDraftComponentIri(LIVE)).toBe(DRAFT)
    expect(stackManager.currentIri.value).toBe(DRAFT)
    expect(resourcesStore.current.byId[stackManager.currentIri.value!]?.data?.html).toBe('<p>Hello from Sam</p>')
  })

  test('a tab that chose to edit the live version stays on it', async () => {
    const { stackManager } = await selectedLiveComponentInThisTab()
    stackManager.forcePublishedVersion.value = true

    await deliver(firstSaveInAnotherTab)

    expect(stackManager.currentIri.value).toBe(LIVE)
  })
})
