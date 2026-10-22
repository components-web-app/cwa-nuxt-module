// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, createApp, defineComponent, ref, shallowRef } from 'vue'
import type { App, Ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { consola as logger } from 'consola'
import type { NuxtApp } from 'nuxt/app'
import { ResourcesManager } from './resources-manager'
import { ResourcesStore } from '#cwa/storage/stores/resources/resources-store'
import { ErrorStore } from '#cwa/storage/stores/error/error-store'
import { MercureStore } from '#cwa/storage/stores/mercure/mercure-store'
import { FetcherStore } from '#cwa/storage/stores/fetcher/fetcher-store'
import { AdminStore } from '#cwa/storage/stores/admin/admin-store'
import ResourceStackManager from '#cwa/admin/resource-stack-manager'
import type Resources from '#cwa/resources/resources'
import MercureClient from '#cwa/api/mercure-client'
import * as processComposables from '#cwa/composables/process'
import { useCwaResourceModel } from '#cwa/composables/cwa-resource-model'
import type { CwaResource } from '#cwa/resources/resource-utils'
import { installFakeEventSource } from '../../../test/utils/fake-event-source'

const appCwa = vi.hoisted(() => ({ current: undefined as unknown }))
vi.mock('#cwa/composables/cwa', () => ({ useCwa: () => appCwa.current }))
vi.mock('#app/nuxt', () => ({ useNuxtApp: () => ({ vueApp: { _container: null } }) }))
vi.mock('#cwa/templates/components/main/admin/resource-manager/ComponentFocus.vue', () => ({
  default: { name: 'ComponentFocus', render: () => null },
}))

const TITLE = '/component/titles/1'
const LIVE = '/component/titles/live'
const DRAFT = '/component/titles/draft'
const THEIRS = { lastWrite: { at: '2026-10-22T10:00:00.000+00:00', clientId: 'other-tab', userId: '/_/users/2' } }

const mounted: VueWrapper[] = []

function preconditionFailed(body: CwaResource) {
  return Object.assign(new Error('Precondition Failed'), { statusCode: 412, status: 412, data: body })
}

function setup({ realtime = false }: { realtime?: boolean } = {}) {
  setActivePinia(createPinia())
  const resourcesStoreDef = new ResourcesStore('cwa')
  const store = resourcesStoreDef.useStore()
  const api = vi.fn()
  const fetch = vi.fn((path: string, options: unknown) => path === '/_/realtime' ? Promise.resolve(undefined) : api(path, options))
  const adminStoreDef = new AdminStore('cwa')
  adminStoreDef.useStore().state.isEditing = true
  const resourceStackManager = new ResourceStackManager(adminStoreDef, resourcesStoreDef, {} as Resources, {} as App)
  resourceStackManager.showManager.value = true
  const select = (iri: string) => {
    (resourceStackManager as unknown as { currentResourceStack: Ref<unknown[]> }).currentResourceStack.value = [{ iri, domElements: ref([]), childIris: ref([]) }]
  }
  const admin = {
    isEditing: true,
    emptyStack: vi.fn(),
    emitRedraw: vi.fn(),
    eventBus: { emit: vi.fn() },
    resourceStackManager,
  }
  const resources = {
    getResource: (iri: string) => computed(() => store.current.byId[iri]),
    displayPageIri: computed(() => '/_/pages/home'),
    isLoading: computed(() => false),
    pageDataIriOf: () => computed(() => undefined),
    findAllPublishableIris: (iri: string) => store.findAllPublishableIris(iri),
  }
  const cwaFetch = { fetch, writeHeaders: {} as Record<string, string> }
  const isAdmin = ref(true)
  const $cwa: Record<string, unknown> = {
    realtimeConfig: realtime ? undefined : { enabled: false },
    apiUrlBase: 'https://api.test',
    cwaFetch,
    admin,
    resources,
    auth: { user: { '@id': '/_/users/1' }, isAdmin: computed(() => isAdmin.value) },
  }
  const resourcesManager = new ResourcesManager(cwaFetch as never, resourcesStoreDef, { primaryFetchPath: undefined } as never, new ErrorStore('cwa'), { fetchBatch: vi.fn() } as never, admin as never, resources as never, createApp({}))
  $cwa.resourcesManager = resourcesManager
  appCwa.current = $cwa

  const mercureStoreDef = new MercureStore('cwa')
  mercureStoreDef.useStore().hub = 'https://api.test/.well-known/mercure'
  const client = new MercureClient(mercureStoreDef, resourcesStoreDef, new FetcherStore('cwa', resourcesStoreDef), { $cwa, $router: { currentRoute: shallowRef({ path: '/', meta: {} }) } } as unknown as NuxtApp)
  client.setRequestCount(computed(() => 0))
  client.init()

  function seed(resource: CwaResource) {
    store.saveResource({ resource })
    store.resetCurrentResources([...store.current.currentIds, resource['@id']])
  }

  function sent() {
    return api.mock.calls.map(([path, options]) => ({ path, method: options.method, ifMatch: options.headers['If-Match'], body: options.body }))
  }

  return { store, api, resourcesManager, resourceStackManager, select, cwaFetch, seed, sent, isAdmin, client }
}

function editTitle(iri: Ref<string | undefined>) {
  let field!: ReturnType<typeof useCwaResourceModel<string>>
  mounted.push(mount(defineComponent({
    setup() {
      field = useCwaResourceModel<string>(iri, 'title', { debounceTime: 0 })
      return () => null
    },
  })))
  return field
}

beforeAll(() => {
  logger.wrapAll()
  logger.mockTypes(() => vi.fn())
})

beforeEach(() => {
  vi.spyOn(processComposables, 'useProcess').mockReturnValue({ isServer: false, isClient: true })
  installFakeEventSource()
})

afterEach(async () => {
  mounted.splice(0).forEach(wrapper => wrapper.unmount())
  await flushPromises()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('ResourcesManager: optimistic concurrency with If-Match (api-components-bundle#561)', () => {
  test('a save sends If-Match with the stored copy\'s version, and a resource without a numeric version sends none', async () => {
    const { seed, api, sent } = setup()
    seed({ '@id': TITLE, '@type': 'Title', 'title': 'old', '_metadata': { persisted: true, version: 2 } })
    seed({ '@id': '/component/titles/2', '@type': 'Title', 'title': 'old', '_metadata': { persisted: true } })
    seed({ '@id': '/component/titles/3', '@type': 'Title', 'title': 'old', '_metadata': { persisted: true, version: null } })
    api.mockImplementation((path: string, options: { body: object }) => Promise.resolve({ '@id': path, '@type': 'Title', ...options.body, '_metadata': { persisted: true } }))
    const versioned = editTitle(ref(TITLE))
    const unversioned = editTitle(ref('/component/titles/2'))
    const notANumber = editTitle(ref('/component/titles/3'))

    versioned.model.value = 'mine'
    unversioned.model.value = 'mine'
    notANumber.model.value = 'mine'

    await vi.waitFor(() => expect(api).toHaveBeenCalledTimes(3))
    expect(sent()).toStrictEqual([
      { path: TITLE, method: 'PATCH', ifMatch: '"2"', body: { title: 'mine' } },
      { path: '/component/titles/2', method: 'PATCH', ifMatch: undefined, body: { title: 'mine' } },
      { path: '/component/titles/3', method: 'PATCH', ifMatch: undefined, body: { title: 'mine' } },
    ])
  })

  test('a delete sends If-Match with the stored copy\'s version', async () => {
    const { seed, api, sent, resourcesManager } = setup()
    seed({ '@id': TITLE, '@type': 'Title', 'title': 'old', '_metadata': { persisted: true, version: 5 } })
    api.mockResolvedValue(undefined)

    await resourcesManager.deleteResource({ endpoint: TITLE }, true)

    expect(sent()).toStrictEqual([{ path: TITLE, method: 'DELETE', ifMatch: '"5"', body: undefined }])
  })

  test('two saves of one resource from one tab go one after the other, the second carrying the version the first returned', async () => {
    const { seed, api, sent, resourcesManager } = setup()
    seed({ '@id': TITLE, '@type': 'Title', 'title': 'old', 'subtitle': 'old', '_metadata': { persisted: true, version: 2 } })
    let answerFirst!: (resource: CwaResource) => void
    api.mockImplementationOnce(() => new Promise((resolve) => {
      answerFirst = resolve
    }))
    api.mockResolvedValueOnce({ '@id': TITLE, '@type': 'Title', 'title': 'a', 'subtitle': 'b', '_metadata': { persisted: true, version: 4 } })

    const first = resourcesManager.updateResource({ endpoint: TITLE, data: { title: 'a' } })
    const second = resourcesManager.updateResource({ endpoint: TITLE, data: { subtitle: 'b' } })
    await flushPromises()
    expect(api).toHaveBeenCalledOnce()

    answerFirst({ '@id': TITLE, '@type': 'Title', 'title': 'a', 'subtitle': 'old', '_metadata': { persisted: true, version: 3 } })
    await Promise.all([first, second])

    expect(sent().map(({ ifMatch, body }) => ({ ifMatch, body }))).toStrictEqual([
      { ifMatch: '"2"', body: { title: 'a' } },
      { ifMatch: '"3"', body: { subtitle: 'b' } },
    ])
  })

  test('a save queued behind this tab\'s first edit of a live component goes to the draft that edit created, keeping the endpoint\'s query', async () => {
    const { seed, api, sent, resourcesManager } = setup()
    seed({ '@id': LIVE, '@type': 'Title', 'title': 'live', '_metadata': { persisted: true, version: 3, publishable: { published: true } } })
    const draft = { '@id': DRAFT, '@type': 'Title', 'title': 'a', 'publishedResource': LIVE, '_metadata': { persisted: true, version: 1, publishable: { published: false } } }
    api.mockResolvedValueOnce(draft)
    api.mockResolvedValueOnce({ ...draft, subtitle: 'b', _metadata: { ...draft._metadata, version: 2 } })

    await Promise.all([
      resourcesManager.updateResource({ endpoint: LIVE, data: { title: 'a' } }),
      resourcesManager.updateResource({ endpoint: `${LIVE}?published=false`, data: { subtitle: 'b' } }),
    ])

    expect(sent().map(({ path, ifMatch }) => ({ path, ifMatch }))).toStrictEqual([
      { path: LIVE, ifMatch: '"3"' },
      { path: `${DRAFT}?published=false`, ifMatch: '"1"' },
    ])
  })

  test('a save to the draft waits for this tab\'s save to its live component that is still being sent to that draft', async () => {
    const { seed, api, sent, resourcesManager } = setup()
    seed({ '@id': LIVE, '@type': 'Title', 'title': 'live', '_metadata': { persisted: true, version: 3, publishable: { published: true } } })
    const draft = { '@id': DRAFT, '@type': 'Title', 'title': 'a', 'publishedResource': LIVE, '_metadata': { persisted: true, version: 1, publishable: { published: false } } }
    let answerSecond!: (resource: CwaResource) => void
    api.mockResolvedValueOnce(draft)
    api.mockImplementationOnce(() => new Promise((resolve) => {
      answerSecond = resolve
    }))
    api.mockResolvedValueOnce({ ...draft, _metadata: { ...draft._metadata, version: 3 } })

    const first = resourcesManager.updateResource({ endpoint: LIVE, data: { title: 'a' } })
    const second = resourcesManager.updateResource({ endpoint: LIVE, data: { subtitle: 'b' } })
    await first
    await vi.waitFor(() => expect(api).toHaveBeenCalledTimes(2))
    const third = resourcesManager.updateResource({ endpoint: DRAFT, data: { title: 'c' } })
    await flushPromises()
    expect(api).toHaveBeenCalledTimes(2)

    answerSecond({ ...draft, subtitle: 'b', _metadata: { ...draft._metadata, version: 2 } })
    await Promise.all([second, third])

    expect(sent().map(({ path, ifMatch }) => ({ path, ifMatch }))).toStrictEqual([
      { path: LIVE, ifMatch: '"3"' },
      { path: DRAFT, ifMatch: '"1"' },
      { path: DRAFT, ifMatch: '"2"' },
    ])
  })

  test('a save to a live component that waited for nothing is not sent to a draft this tab did not create', async () => {
    const { seed, api, sent, resourcesManager } = setup()
    seed({ '@id': LIVE, '@type': 'Title', 'title': 'live', 'draftResource': DRAFT, '_metadata': { persisted: true, version: 3, publishable: { published: true } } })
    seed({ '@id': DRAFT, '@type': 'Title', 'title': 'theirs', 'publishedResource': LIVE, '_metadata': { persisted: true, version: 4, publishable: { published: false } } })
    api.mockResolvedValue(undefined)

    await resourcesManager.updateResource({ endpoint: LIVE, data: { title: 'a' } })

    expect(sent().map(({ path, ifMatch }) => ({ path, ifMatch }))).toStrictEqual([{ path: LIVE, ifMatch: '"3"' }])
  })

  describe('a 412 for an admin with real-time co-editing', () => {
    async function realtimeSetup() {
      const context = setup({ realtime: true })
      await vi.waitFor(() => expect(context.cwaFetch.writeHeaders['X-CWA-Client-Id']).toBeDefined())
      return context
    }

    test('raises the refused field\'s conflict, keeps this tab\'s text and shows no error', async () => {
      const { seed, api, store, resourcesManager } = await realtimeSetup()
      seed({ '@id': TITLE, '@type': 'Title', 'title': 'old', '_metadata': { persisted: true, version: 2 } })
      api.mockRejectedValueOnce(preconditionFailed({ '@id': TITLE, '@type': 'Title', 'title': 'theirs', '_metadata': { persisted: true, version: 3, ...THEIRS } }))
      const field = editTitle(ref(TITLE))

      field.model.value = 'mine'
      await vi.waitFor(() => expect(field.remoteChange.value).toBeDefined())
      await flushPromises()

      expect(field.remoteChange.value?.value).toBe('theirs')
      expect(field.model.value).toBe('mine')
      expect(resourcesManager.errors).toStrictEqual([])
      expect(store.current.byId[TITLE]?.data).toMatchObject({ title: 'old', _metadata: { version: 3 } })
    })

    test('Keep mine re-sends the text with the version the 412 carried', async () => {
      const { seed, api, sent } = await realtimeSetup()
      seed({ '@id': TITLE, '@type': 'Title', 'title': 'old', '_metadata': { persisted: true, version: 2 } })
      api.mockRejectedValueOnce(preconditionFailed({ '@id': TITLE, '@type': 'Title', 'title': 'theirs', '_metadata': { persisted: true, version: 3, ...THEIRS } }))
      api.mockResolvedValueOnce({ '@id': TITLE, '@type': 'Title', 'title': 'mine', '_metadata': { persisted: true, version: 4 } })
      const field = editTitle(ref(TITLE))
      field.model.value = 'mine'
      await vi.waitFor(() => expect(field.remoteChange.value).toBeDefined())
      await flushPromises()

      await field.remoteChange.value!.keep()

      expect(sent().map(({ ifMatch, body }) => ({ ifMatch, body }))).toStrictEqual([
        { ifMatch: '"2"', body: { title: 'mine' } },
        { ifMatch: '"3"', body: { title: 'mine' } },
      ])
      expect(field.model.value).toBe('mine')
      expect(field.remoteChange.value).toBeUndefined()
    })

    test('Use theirs shows their text and sends nothing', async () => {
      const { seed, api } = await realtimeSetup()
      seed({ '@id': TITLE, '@type': 'Title', 'title': 'old', '_metadata': { persisted: true, version: 2 } })
      api.mockRejectedValueOnce(preconditionFailed({ '@id': TITLE, '@type': 'Title', 'title': 'theirs', '_metadata': { persisted: true, version: 3, ...THEIRS } }))
      const field = editTitle(ref(TITLE))
      field.model.value = 'mine'
      await vi.waitFor(() => expect(field.remoteChange.value).toBeDefined())
      await flushPromises()

      field.remoteChange.value!.accept()
      await flushPromises()

      expect(field.model.value).toBe('theirs')
      expect(api).toHaveBeenCalledOnce()
    })

    test('carrying another admin\'s draft of the live component moves the tab to that draft, keeping its unsaved text, with the conflict there', async () => {
      const { seed, api, sent, select, resourceStackManager, resourcesManager } = await realtimeSetup()
      seed({ '@id': LIVE, '@type': 'Title', 'title': 'live', '_metadata': { persisted: true, version: 3, publishable: { published: true } } })
      select(LIVE)
      api.mockRejectedValueOnce(preconditionFailed({ '@id': DRAFT, '@type': 'Title', 'title': 'theirs', 'publishedResource': LIVE, '_metadata': { persisted: true, version: 2, publishable: { published: false }, ...THEIRS } }))
      api.mockResolvedValueOnce({ '@id': DRAFT, '@type': 'Title', 'title': 'mine', 'publishedResource': LIVE, '_metadata': { persisted: true, version: 3, publishable: { published: false } } })
      const field = editTitle(resourceStackManager.currentIri as Ref<string | undefined>)
      expect(resourceStackManager.currentIri.value).toBe(LIVE)

      field.model.value = 'mine'
      await vi.waitFor(() => expect(field.remoteChange.value).toBeDefined())
      await flushPromises()

      expect(resourceStackManager.currentIri.value).toBe(DRAFT)
      expect(field.model.value).toBe('mine')
      expect(field.remoteChange.value?.value).toBe('theirs')
      expect(resourcesManager.errors).toStrictEqual([])

      await field.remoteChange.value!.keep()
      expect(sent().map(({ path, ifMatch }) => ({ path, ifMatch }))).toStrictEqual([
        { path: LIVE, ifMatch: '"3"' },
        { path: DRAFT, ifMatch: '"2"' },
      ])
    })

    test('after signing out, a 412 is shown as an error again', async () => {
      const { seed, api, resourcesManager, isAdmin, client, cwaFetch } = await realtimeSetup()
      seed({ '@id': TITLE, '@type': 'Title', 'title': 'old', '_metadata': { persisted: true, version: 2 } })
      isAdmin.value = false
      client.init(true)
      await vi.waitFor(() => expect(cwaFetch.writeHeaders).toStrictEqual({}))
      api.mockRejectedValueOnce(preconditionFailed({ '@id': TITLE, '@type': 'Title', 'title': 'theirs', '_metadata': { persisted: true, version: 3, ...THEIRS } }))
      const field = editTitle(ref(TITLE))

      field.model.value = 'mine'
      await vi.waitFor(() => expect(resourcesManager.errors).toMatchObject([{ statusCode: 412 }]))
      expect(field.remoteChange.value).toBeUndefined()
    })

    test('a refused write no field of this tab holds, such as a delete, is still shown as an error', async () => {
      const { seed, api, resourcesManager } = await realtimeSetup()
      seed({ '@id': TITLE, '@type': 'Title', 'title': 'old', '_metadata': { persisted: true, version: 2 } })
      api.mockRejectedValueOnce(preconditionFailed({ '@id': TITLE, '@type': 'Title', 'title': 'theirs', '_metadata': { persisted: true, version: 3, ...THEIRS } }))

      await resourcesManager.deleteResource({ endpoint: TITLE }, true)

      expect(resourcesManager.errors).toMatchObject([{ statusCode: 412 }])
    })
  })

  test('without real-time co-editing, a 412 is shown as an error and nothing is overwritten', async () => {
    const { seed, api, store, resourcesManager } = setup()
    seed({ '@id': TITLE, '@type': 'Title', 'title': 'old', '_metadata': { persisted: true, version: 2 } })
    api.mockRejectedValueOnce(preconditionFailed({ '@id': TITLE, '@type': 'Title', 'title': 'theirs', '_metadata': { persisted: true, version: 3, ...THEIRS } }))
    const field = editTitle(ref(TITLE))

    field.model.value = 'mine'
    await vi.waitFor(() => expect(resourcesManager.errors).toHaveLength(1))
    await flushPromises()

    expect(resourcesManager.errors[0]).toMatchObject({ statusCode: 412, detail: 'Someone else saved this first, so your change was not saved. Reload to see their version.' })
    expect(field.model.value).toBe('mine')
    expect(field.remoteChange.value).toBeUndefined()
    expect(store.current.byId[TITLE]?.data).toMatchObject({ title: 'old', _metadata: { version: 2 } })
    expect(api).toHaveBeenCalledOnce()
  })
})
