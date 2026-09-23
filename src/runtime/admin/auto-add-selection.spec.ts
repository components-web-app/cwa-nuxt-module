// @vitest-environment nuxt
import { afterEach, describe, expect, test, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { computed, defineComponent, h, nextTick, ref, toRef } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { VueWrapper } from '@vue/test-utils'
import { ResourcesStore } from '#cwa/storage/stores/resources/resources-store'
import { FetcherStore } from '#cwa/storage/stores/fetcher/fetcher-store'
import { AdminStore } from '#cwa/storage/stores/admin/admin-store'
import { ErrorStore } from '#cwa/storage/stores/error/error-store'
import { ResourceTypeFromIri } from '#cwa/resources/resource-utils'
import FetchStatusManager from '#cwa/api/fetcher/fetch-status-manager'
import Fetcher from '#cwa/api/fetcher/fetcher'
import { Resources } from '#cwa/resources/resources'
import { ResourcesManager } from '#cwa/resources/resources-manager'
import Admin from '#cwa/admin/admin'
import { useCwaResource } from '#cwa/composables/cwa-resource'
import ComponentGroup from '#cwa/templates/components/main/ComponentGroup.vue'
import ResourceManager from '#cwa/templates/components/main/admin/resource-manager/ResourceManager.vue'

const holder = vi.hoisted(() => ({ cwa: undefined as any }))
mockNuxtImport('useCwa', () => () => holder.cwa)

const PAGE = '/_api/_/pages/page1'
const GROUP = '/_api/_/component_groups/group'
const POSITION_A = '/_api/_/component_positions/position-a'
const POSITION_B = '/_api/_/component_positions/position-b'
const POSITION_NEW = '/_api/_/component_positions/position-new'
const COMPONENT_A = '/_api/component/titles/a'
const COMPONENT_B = '/_api/component/titles/b'
const COMPONENT_NEW = '/_api/component/titles/new'

const ELEMENT_RECT = { top: 100, left: 10, right: 210, bottom: 150, width: 200, height: 50, x: 10, y: 100 }

type RootBehaviour = 'settled' | 'replaced' | 'late'

const rootBehaviour = ref<RootBehaviour>('settled')

const CwaComponentTitle = defineComponent({
  props: { iri: { type: String, required: true } },
  setup(props) {
    const { getResource } = useCwaResource(toRef(props, 'iri'))
    const resource = getResource()
    const behaviour = rootBehaviour.value
    const rendered = ref(behaviour !== 'late')
    const replaced = ref(false)
    if (behaviour === 'late') {
      setTimeout(() => {
        rendered.value = true
      }, 50)
    }
    if (behaviour === 'replaced') {
      setTimeout(() => {
        replaced.value = true
      }, 50)
    }
    return () => {
      if (!rendered.value) {
        return null
      }
      const attrs = { 'class': 'cwa-test-component', 'data-iri': props.iri }
      const content = resource.value?.data?.title || 'no title'
      return replaced.value ? h('article', attrs, content) : h('div', attrs, content)
    }
  },
})

function buildApi(publishable: boolean) {
  const publishableMeta = (published: boolean) => publishable
    ? { publishable: { published, publishedAt: published ? '2020-01-01T00:00:00+00:00' : null } }
    : {}
  const api: Record<string, any> = {
    [GROUP]: { '@id': GROUP, '@type': 'ComponentGroup', 'reference': `top_${PAGE}`, 'componentPositions': [POSITION_A, POSITION_B], '_metadata': { persisted: true } },
    [POSITION_A]: { '@id': POSITION_A, '@type': 'ComponentPosition', 'component': COMPONENT_A, 'componentGroup': GROUP, 'sortValue': 0, '_metadata': { persisted: true } },
    [POSITION_B]: { '@id': POSITION_B, '@type': 'ComponentPosition', 'component': COMPONENT_B, 'componentGroup': GROUP, 'sortValue': 1, '_metadata': { persisted: true } },
    [COMPONENT_A]: { '@id': COMPONENT_A, '@type': 'Title', 'title': 'A', 'componentPositions': [POSITION_A], '_metadata': { persisted: true, ...publishableMeta(true) } },
    [COMPONENT_B]: { '@id': COMPONENT_B, '@type': 'Title', 'title': 'B', 'componentPositions': [POSITION_B], '_metadata': { persisted: true, ...publishableMeta(true) } },
  }
  const handle = (url: string, ops: any = {}) => {
    const method = ops.method || 'GET'
    const path = url.split('?')[0] as string
    if (method === 'POST') {
      api[POSITION_NEW] = { '@id': POSITION_NEW, '@type': 'ComponentPosition', 'component': COMPONENT_NEW, 'componentGroup': GROUP, 'sortValue': 1, '_metadata': { persisted: true } }
      api[COMPONENT_NEW] = { '@id': COMPONENT_NEW, '@type': 'Title', 'title': null, 'componentPositions': [POSITION_NEW], '_metadata': { persisted: true, ...publishableMeta(false) } }
      api[POSITION_B] = { ...api[POSITION_B], sortValue: 2 }
      api[GROUP] = { ...api[GROUP], componentPositions: [POSITION_A, POSITION_NEW, POSITION_B] }
      return structuredClone(api[COMPONENT_NEW])
    }
    if (method === 'PATCH') {
      api[path] = { ...api[path], ...ops.body }
      return structuredClone(api[path])
    }
    if (!api[path]) {
      const error: any = new Error('Not Found')
      error.statusCode = 404
      throw error
    }
    return structuredClone(api[path])
  }
  return { api, handle }
}

function build(opts: { publishable?: boolean } = {}) {
  ResourceTypeFromIri.setPathPrefix('/_api')
  setActivePinia(createPinia())
  const resourcesStoreDef = new ResourcesStore('cwa')
  const fetcherStoreDef = new FetcherStore('cwa')
  const adminStoreDef = new AdminStore('cwa')
  const errorStoreDef = new ErrorStore('cwa')

  const { api, handle } = buildApi(!!opts.publishable)
  const wait = () => new Promise(resolve => setTimeout(resolve, 10))
  const cwaFetch: any = {
    fetch: async (url: string, ops: any) => {
      await wait()
      return handle(url, ops)
    },
  }
  cwaFetch.fetch.raw = async (url: string, ops: any) => {
    await wait()
    return { _data: handle(url, ops), headers: { get: () => null, getSetCookie: () => [] }, status: 200 }
  }

  const mercure = { setMercureHubFromLinkHeader() {}, setDocsPathFromLinkHeader() {}, init() {} }
  const apiDocumentation = { setDocsPathFromLinkHeader() {} }
  const router = { currentRoute: { value: { query: {} } } }
  const nuxtApp = { runWithContext: (fn: () => unknown) => fn() }
  const fetchStatusManager = new FetchStatusManager(fetcherStoreDef, mercure as never, apiDocumentation as never, resourcesStoreDef, undefined, nuxtApp as never)
  const fetcher = new Fetcher(cwaFetch as never, fetchStatusManager, router as never, resourcesStoreDef)
  const resources = new Resources(resourcesStoreDef, fetcherStoreDef)
  const admin = new Admin(adminStoreDef, resourcesStoreDef, resources)
  const resourcesManager = new ResourcesManager(cwaFetch as never, resourcesStoreDef, fetchStatusManager, errorStoreDef, fetcher, admin, resources)

  const resourcesStore = resourcesStoreDef.useStore()
  const save = (resource: any) => {
    resourcesStore.setResourceFetchStatus({ iri: resource['@id'], isComplete: true } as never)
    resourcesStore.saveResource({ resource: structuredClone(resource) })
  }
  save({ '@id': PAGE, '@type': 'Page', 'componentGroups': [GROUP], '_metadata': { persisted: true } })
  for (const iri of [GROUP, POSITION_A, POSITION_B, COMPONENT_A, COMPONENT_B]) {
    save(api[iri])
  }

  holder.cwa = {
    resources,
    resourcesManager,
    admin,
    auth: { isAdmin: computed(() => true), signedIn: computed(() => true), user: { '@id': '/_api/users/admin' }, hasRole: () => true },
    resourcesConfig: { Title: { name: 'Title', instantAdd: true } },
    isStaticRender: false,
    addUniquePromise: async (_group: string, _key: string, fn: () => Promise<void>) => fn(),
    fetchResource: (event: any) => fetcher.fetchResource(event),
    getApiDocumentation: async () => ({}),
    getComponentMetadata: async () => ({ Title: { resourceName: 'Title', endpoint: '/_api/component/titles', isPublishable: !!opts.publishable } }),
  }
  admin.toggleEdit(true)
  return { admin, resourcesManager }
}

async function settle() {
  for (let index = 0; index < 10; index++) {
    await flushPromises()
    await nextTick()
  }
  await new Promise(resolve => setTimeout(resolve, 250))
  for (let index = 0; index < 5; index++) {
    await flushPromises()
    await nextTick()
  }
}

describe('#321 selection outline follows a component root element that changes without a remount', { timeout: 30000 }, () => {
  const mountedWrappers: VueWrapper<any>[] = []
  let rectSpy: any

  function mountPage(admin: Admin) {
    const stackManager = admin.resourceStackManager
    const resourceManagerRef = ref<any>(null)
    const Root = defineComponent({
      setup() {
        const onClick = (event: MouseEvent) => resourceManagerRef.value?.clickHandler(event, 'page')
        return () => h('div', { id: 'cwa-root-layout', onClick }, [
          h('div', { id: 'page' }, [h(ComponentGroup, { reference: 'top', location: PAGE })]),
          h(ResourceManager, { ref: resourceManagerRef }),
        ])
      },
    })
    const wrapper = mount(Root, { attachTo: document.body, global: { components: { CwaComponentTitle } } })
    mountedWrappers.push(wrapper)
    return { root: wrapper.element as HTMLElement, stackManager }
  }

  function clickElement(element: HTMLElement) {
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  }

  function selectionState(stackManager: any) {
    const stackItem = stackManager.currentStackItem.value
    const elements: HTMLElement[] = stackItem?.domElements.value || []
    const outline = (stackManager as any).focusWrapper?.querySelector('div') as HTMLElement | undefined
    return {
      iri: stackItem?.iri,
      showManager: stackManager.showManager.value,
      elementsConnected: elements.length > 0 && elements.every(element => element.isConnected),
      outlineStyle: outline?.getAttribute('style'),
    }
  }

  async function autoAddComponent(admin: Admin, resourcesManager: ResourcesManager) {
    await resourcesManager.initAddResource(COMPONENT_A, true, admin.resourceStackManager.resourceStack.value)
    await settle()
    await resourcesManager.setAddResourceEventResource('Title', '/_api/component/titles', false, true)
    await settle()
  }

  afterEach(() => {
    for (const wrapper of mountedWrappers.splice(0)) {
      wrapper.unmount()
    }
    document.body.innerHTML = ''
    rectSpy?.mockRestore()
    rootBehaviour.value = 'settled'
    ResourceTypeFromIri.setPathPrefix(undefined as never)
  })

  function stubElementRects() {
    const original = HTMLElement.prototype.getBoundingClientRect
    rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (!this.isConnected) {
        return original.call(this)
      }
      return { ...ELEMENT_RECT, toJSON: () => ELEMENT_RECT } as DOMRect
    })
  }

  test('clicking a component already on the page outlines it', async () => {
    stubElementRects()
    const { admin } = build()
    const { root, stackManager } = mountPage(admin)
    await settle()

    clickElement(root.querySelector(`[data-iri="${COMPONENT_A}"]`) as HTMLElement)
    await settle()

    expect(selectionState(stackManager)).toEqual({
      iri: COMPONENT_A,
      showManager: true,
      elementsConnected: true,
      outlineStyle: 'top: 100px; left: 10px; width: 200px; height: 50px;',
    })
  })

  test('a component added by auto-add is selected and outlined when its root element is replaced after mounting', async () => {
    stubElementRects()
    const { admin, resourcesManager } = build()
    const { root, stackManager } = mountPage(admin)
    await settle()

    clickElement(root.querySelector(`[data-iri="${COMPONENT_A}"]`) as HTMLElement)
    await settle()

    rootBehaviour.value = 'replaced'
    await autoAddComponent(admin, resourcesManager)

    expect(root.querySelector(`[data-iri="${COMPONENT_NEW}"]`)?.tagName).toBe('ARTICLE')
    expect(selectionState(stackManager)).toEqual({
      iri: COMPONENT_NEW,
      showManager: true,
      elementsConnected: true,
      outlineStyle: 'top: 100px; left: 10px; width: 200px; height: 50px;',
    })
  })

  test('a component added by auto-add is selected and outlined when its root element only renders after mounting', async () => {
    stubElementRects()
    const { admin, resourcesManager } = build()
    const { root, stackManager } = mountPage(admin)
    await settle()

    clickElement(root.querySelector(`[data-iri="${COMPONENT_A}"]`) as HTMLElement)
    await settle()

    rootBehaviour.value = 'late'
    await autoAddComponent(admin, resourcesManager)

    expect(selectionState(stackManager)).toEqual({
      iri: COMPONENT_NEW,
      showManager: true,
      elementsConnected: true,
      outlineStyle: 'top: 100px; left: 10px; width: 200px; height: 50px;',
    })
  })

  test('clicking an auto-added component whose root element was replaced selects it again', async () => {
    stubElementRects()
    const { admin, resourcesManager } = build()
    const { root, stackManager } = mountPage(admin)
    await settle()

    clickElement(root.querySelector(`[data-iri="${COMPONENT_A}"]`) as HTMLElement)
    await settle()

    rootBehaviour.value = 'replaced'
    await autoAddComponent(admin, resourcesManager)

    admin.emptyStack()
    await settle()

    clickElement(root.querySelector(`[data-iri="${COMPONENT_NEW}"]`) as HTMLElement)
    await settle()

    expect(selectionState(stackManager)).toEqual({
      iri: COMPONENT_NEW,
      showManager: true,
      elementsConnected: true,
      outlineStyle: 'top: 100px; left: 10px; width: 200px; height: 50px;',
    })
  })
})
