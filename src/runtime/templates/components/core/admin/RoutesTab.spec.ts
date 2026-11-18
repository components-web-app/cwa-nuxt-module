// @vitest-environment nuxt
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { enableAutoUnmount, mount, flushPromises } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import RoutesTab from './RoutesTab.vue'
import RoutesTabView from './RoutesTabView.vue'
import RoutesTabManage from './RoutesTabManage.vue'
import RoutesTabForwardTo from './RoutesTabForwardTo.vue'
import RoutesTabRedirects from './RoutesTabRedirects.vue'
import RoutesTabChildRoutes from './RoutesTabChildRoutes.vue'
import CwaUiDialog from '#cwa/templates/components/ui/Dialog.vue'
import * as cwaComposable from '#cwa/composables/cwa'
import { CwaResourceApiStatuses } from '#cwa/storage/stores/resources/state'
import { axe } from '../../../../../../test/utils/axe'
import { fakeDialogForm } from '../../../../../../playground/app/kit/fake-dialog-form'

const { mockUseItemPage, confirmMock, mockNavigateTo } = vi.hoisted(() => ({
  mockUseItemPage: vi.fn(),
  confirmMock: vi.fn(),
  mockNavigateTo: vi.fn(),
}))

mockNuxtImport('navigateTo', () => mockNavigateTo)

vi.mock('#cwa-layer/_composables/useItemPage', () => ({ useItemPage: mockUseItemPage }))
vi.mock('#cwa/composables/cwa-confirm', () => ({ useCwaConfirm: () => confirmMock }))
const realtime = vi.hoisted(() => ({ peers: vi.fn((_iri: string): unknown[] => []) }))
vi.mock('#cwa/resources/realtime-view', () => ({
  realtimeView: () => ({ load: async () => ({ peers: realtime.peers }) }),
}))

enableAutoUnmount(afterEach)

const ROUTE_IRI = '/_/routes//conference/programme'

const children = [
  { route: '/_/routes//conference/programme/day-1', path: '/conference/programme/day-1', children: [
    { route: '/_/routes//conference/programme/day-1/am', path: '/conference/programme/day-1/am', children: [] },
  ] },
  { route: '/_/routes//conference/elsewhere', path: '/conference/elsewhere', children: [] },
]

function mockCwa(overrides: Record<string, any> = {}, store: Record<string, any> = {}) {
  const fetch = vi.fn((options: { path: string }) => ({
    response: Promise.resolve({ _data: options.path.endsWith('/children') ? { children } : { '@id': options.path, 'liveAt': '2020-01-01T00:00:00Z', '_metadata': { effectiveLiveAt: '2020-01-01T00:00:00Z' }, 'page': `/_/pages/${options.path.split('/').pop()}` } }),
  }))
  const cwa = {
    resources: {
      getResource: vi.fn((iri: string) => ref(store[iri] ?? null)),
      isDataPage: ref(false),
      pageDataIri: ref('/_/page_data/data-uuid'),
      pageIri: ref('/_/pages/page-uuid'),
    },
    resourcesManager: { createResource: vi.fn().mockResolvedValue({ '@id': '/_/routes//new' }), deleteResource: vi.fn().mockResolvedValue(undefined), updateResource: vi.fn().mockResolvedValue({ '@id': ROUTE_IRI }) },
    fetchResource: vi.fn(),
    fetch,
    ...overrides,
  }
  // @ts-expect-error
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => cwa)
  return cwa
}

function setupItemPage(options: { path?: string, liveAt?: string | null, effectiveLiveAt?: string | null, redirect?: string | null, redirectedFrom?: any[], adding?: boolean } = {}) {
  const path = options.path ?? '/conference/programme'
  const stored = options.adding
    ? undefined
    : { '@id': ROUTE_IRI, path, 'liveAt': options.liveAt ?? '2020-01-01T00:00:00Z', 'redirect': options.redirect ?? null, 'redirectedFrom': options.redirectedFrom ?? [], '_metadata': { persisted: true, effectiveLiveAt: options.effectiveLiveAt ?? options.liveAt ?? '2020-01-01T00:00:00Z' } }
  const resource = ref<any>(stored)
  const localResourceData = ref<Record<string, any>>(options.adding ? { '@type': 'Route', 'path': '' } : { ...stored })
  const itemPage = {
    isLoading: ref(false),
    isUpdating: ref(false),
    localResourceData,
    resource,
    loadResource: vi.fn(),
    deleteResource: vi.fn().mockResolvedValue(true),
    saveResource: vi.fn().mockResolvedValue({ '@id': ROUTE_IRI, 'path': path }),
    resetResource: vi.fn(() => {
      localResourceData.value = { ...resource.value }
    }),
    apiState: ref({ status: 'SUCCESS', path: `${ROUTE_IRI}/redirects` }),
    form: { fieldErrors: {} as Record<string, string>, formError: undefined as string | undefined },
  }
  mockUseItemPage.mockReturnValue(itemPage)
  return itemPage
}

function mountTab(pageResourceOverrides: Record<string, any> = {}) {
  return mount(RoutesTab, {
    props: {
      pageResource: {
        '@id': '/_/pages/programme-uuid',
        '@type': 'Page',
        'title': 'My Programme',
        'route': ROUTE_IRI,
        'parentPage': null,
        'parentPageData': null,
        ...pageResourceOverrides,
      } as any,
    },
    global: { stubs: { ResourceSearch: true } },
    attachTo: document.body,
  })
}

type Wrapper = ReturnType<typeof mountTab>

async function openSub(wrapper: Wrapper, view: string, recommended?: boolean) {
  await wrapper.findComponent(RoutesTabView).vm.$emit('open', view, recommended)
  await flushPromises()
}

const subTitle = (wrapper: Wrapper) => wrapper.find('[data-testid="sub-view-title"]')
const save = (wrapper: Wrapper) => wrapper.find('[data-testid="dialog-sub-save"]')
const cancel = (wrapper: Wrapper) => wrapper.find('[data-testid="dialog-sub-cancel"]')
const labelOf = (element: Element) => (element.textContent ?? '').replace(element.getAttribute('title') ?? '', '').trim()

describe('RoutesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    confirmMock.mockResolvedValue(true)
  })

  afterEach(() => {
    confirmMock.mockReset()
  })

  describe('the main view', () => {
    test('a route added here keeps the dialog on its page or page data, never opening the route in its place (#461)', async () => {
      setupItemPage()
      mockCwa()
      mountTab()
      await flushPromises()
      expect(mockUseItemPage).toHaveBeenCalledWith(expect.objectContaining({ createEndpoint: '/_/routes', openCreated: false }))
    })

    test('summarises redirects and child routes from the route and its children', async () => {
      setupItemPage({ redirectedFrom: [{ '@id': '/_/routes//old', 'path': '/old', 'redirectedFrom': [{ '@id': '/_/routes//older', 'path': '/older' }] }] })
      const cwa = mockCwa()
      const wrapper = mountTab()
      await flushPromises()

      expect(cwa.fetch).toHaveBeenCalledWith({ path: `${ROUTE_IRI}/children` })
      const view = wrapper.findComponent(RoutesTabView)
      expect(view.props('redirectCount')).toBe(2)
      expect(view.props('childCount')).toBe(3)
      expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()
    })

    test('a page with no route shows no route and no Redirect to', async () => {
      setupItemPage({ adding: true })
      mockCwa()
      const wrapper = mountTab({ route: null })
      await flushPromises()

      expect(wrapper.findComponent(RoutesTabView).props('resource')).toBeUndefined()
      expect(wrapper.find('[data-nav="to"]').exists()).toBe(false)
    })

    test('a child route whose children fail to load summarises none', async () => {
      setupItemPage()
      mockCwa({ fetch: vi.fn(() => ({ response: Promise.reject(new Error('boom')) })) })
      const wrapper = mountTab()
      await flushPromises()
      expect(wrapper.findComponent(RoutesTabView).props('childCount')).toBe(0)
    })

    test('loads no child routes when the page has no route', async () => {
      setupItemPage({ adding: true })
      const cwa = mockCwa()
      mountTab({ route: null })
      await flushPromises()
      expect(cwa.fetch).not.toHaveBeenCalled()
    })
  })

  describe('the parent route', () => {
    test('passes the parent route path as the prefix and names the parent', async () => {
      setupItemPage()
      mockCwa({}, { '/_/pages/conference-uuid': { data: { route: '/_/routes//conference', reference: 'Conference' } } })
      const wrapper = mountTab({ parentPage: '/_/pages/conference-uuid' })
      await openSub(wrapper, 'route')

      expect(wrapper.findComponent(RoutesTabManage).props('parentRoutePrefix')).toBe('/conference')
      expect(wrapper.findComponent(RoutesTabView).props('parentHasNoRoute')).toBe(false)
    })

    test('an unrouted page under a parent with no route says so, and opening the parent opens its settings', async () => {
      setupItemPage({ adding: true })
      mockCwa({}, { '/_/pages/conference-uuid': { data: { reference: 'Conference' } } })
      const wrapper = mountTab({ route: null, parentPage: '/_/pages/conference-uuid' })
      await flushPromises()

      const view = wrapper.findComponent(RoutesTabView)
      expect(view.props('parentHasNoRoute')).toBe(true)
      expect(view.props('parentName')).toBe('Conference')
      await view.vm.$emit('openParent')
      expect(wrapper.emitted('openPage')).toEqual([['/_/pages/conference-uuid']])
    })

    test('a routed page under a parent with no route keeps its route', async () => {
      setupItemPage()
      mockCwa({}, { '/_/pages/conference-uuid': { data: { reference: 'Conference' } } })
      const wrapper = mountTab({ parentPage: '/_/pages/conference-uuid' })
      await flushPromises()
      expect(wrapper.findComponent(RoutesTabView).props('parentHasNoRoute')).toBe(false)
    })

    test('fetches the parent shallowly when it is not loaded yet', async () => {
      setupItemPage()
      const cwa = mockCwa()
      mountTab({ parentPage: '/_/pages/conference-uuid' })
      await flushPromises()
      expect(cwa.fetchResource).toHaveBeenCalledWith({ path: '/_/pages/conference-uuid', shallowFetch: true })
    })
  })

  describe('the recommended path', () => {
    test.each([
      ['My Great Programme', '/conference', '/conference/my-great-programme'],
      ['My Great Programme', undefined, '/my-great-programme'],
      ['Version 2.0 Release', undefined, '/version-20-release'],
      ['Q&A: Session (Live!)', undefined, '/qanda-session-live'],
    ])('“%s” under %s recommends %s', async (title, parentRoute, expected) => {
      setupItemPage()
      mockCwa({}, parentRoute ? { '/_/pages/conference-uuid': { data: { route: `/_/routes/${parentRoute}` } } } : {})
      const wrapper = mountTab({ title, parentPage: parentRoute ? '/_/pages/conference-uuid' : null })
      await flushPromises()
      expect(wrapper.findComponent(RoutesTabView).props('recommendedPath')).toBe(expected)
    })

    test('tells both route views which title the recommendation is based on', async () => {
      setupItemPage()
      mockCwa()
      const wrapper = mountTab({ title: 'My Great Programme', parentPage: null })
      await flushPromises()
      expect(wrapper.findComponent(RoutesTabView).props('recommendedFrom')).toBe('My Great Programme')
    })

    test('Use this opens the route form with the recommended path filled in, and saves nothing', async () => {
      const itemPage = setupItemPage()
      mockCwa()
      const wrapper = mountTab()
      await openSub(wrapper, 'route', true)

      expect(itemPage.localResourceData.value.path).toBe('/my-programme')
      expect(wrapper.findComponent(RoutesTabManage).props('modelValue')).toBe('/my-programme')
      expect(itemPage.saveResource).not.toHaveBeenCalled()
    })
  })

  describe('the route sub-view', () => {
    test('opens as Edit route under Routes, with its own Cancel and Save route', async () => {
      setupItemPage()
      mockCwa()
      const wrapper = mountTab()
      await openSub(wrapper, 'route')

      expect(subTitle(wrapper).text()).toBe('Edit route')
      expect(wrapper.find('[data-testid="sub-view-back"]').attributes('aria-label')).toBe('Back to Routes')
      expect(document.activeElement).toBe(subTitle(wrapper).element)
      expect(labelOf(save(wrapper).element)).toBe('Save route')
      expect(save(wrapper).attributes('title')).toBe('Nothing has changed.')
      expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()
    })

    test('for a page with no route it is Add a route with Add route', async () => {
      setupItemPage({ adding: true })
      mockCwa()
      const wrapper = mountTab({ route: null })
      await openSub(wrapper, 'route')

      expect(subTitle(wrapper).text()).toBe('Add a route')
      expect(labelOf(save(wrapper).element)).toBe('Add route')
      expect(save(wrapper).attributes('title')).toBe('Type a path first.')
    })

    test('saving an unchanged path sends no cascade', async () => {
      const itemPage = setupItemPage({ liveAt: '2020-01-01T00:00:00Z' })
      mockCwa()
      const wrapper = mountTab()
      await flushPromises()
      await openSub(wrapper, 'route')
      itemPage.localResourceData.value.liveAt = null
      await flushPromises()

      await save(wrapper).trigger('click')
      await flushPromises()

      expect(itemPage.saveResource).toHaveBeenCalledWith(false, undefined)
      expect(confirmMock).not.toHaveBeenCalled()
    })

    test.each(['/spring?sale', '/spring#sale'])('a path “%s” cannot be saved, and says why', async (path) => {
      const itemPage = setupItemPage()
      mockCwa()
      const wrapper = mountTab()
      await flushPromises()
      await openSub(wrapper, 'route')
      itemPage.localResourceData.value.path = path
      await flushPromises()

      expect(save(wrapper).attributes('title')).toBe('A path can\'t contain ? or #. They start a query or a page anchor.')
      await save(wrapper).trigger('click')
      await flushPromises()
      expect(itemPage.saveResource).not.toHaveBeenCalled()
    })

    test('scheduled with no date yet cannot be saved, and says why', async () => {
      const itemPage = setupItemPage()
      mockCwa()
      const wrapper = mountTab()
      await flushPromises()
      await openSub(wrapper, 'route')
      itemPage.localResourceData.value.liveAt = null
      await wrapper.findComponent(RoutesTabManage).vm.$emit('update:awaitingDate', true)
      await flushPromises()

      expect(save(wrapper).attributes('title')).toBe('Choose when the route goes live.')
      await save(wrapper).trigger('click')
      await flushPromises()
      expect(itemPage.saveResource).not.toHaveBeenCalled()
    })

    test('a new path with child routes under the old one also changes them, as the form offers, and says what happened', async () => {
      const itemPage = setupItemPage()
      itemPage.saveResource.mockResolvedValue({ '@id': '/_/routes//conference/schedule', 'path': '/conference/schedule' })
      mockCwa()
      const wrapper = mountTab()
      await flushPromises()
      await openSub(wrapper, 'route')
      itemPage.localResourceData.value.path = '/conference/schedule'
      await flushPromises()

      await save(wrapper).trigger('click')
      await flushPromises()

      expect(itemPage.saveResource).toHaveBeenCalledWith(false, { cascadeChildPaths: true })
      expect(wrapper.emitted('reload')).toHaveLength(1)
      expect(wrapper.find('[data-testid="sub-view"]').exists()).toBe(false)
      const status = wrapper.find('[data-testid="routes-status"]')
      expect(status.text()).toBe('Route changed to /conference/schedule. /conference/programme now redirects here.')
      expect(document.activeElement).toBe(status.element)
    })

    test('unticking the child routes leaves them as they are', async () => {
      const itemPage = setupItemPage()
      mockCwa()
      const wrapper = mountTab()
      await flushPromises()
      await openSub(wrapper, 'route')
      itemPage.localResourceData.value.path = '/conference/schedule'
      await flushPromises()
      await wrapper.find('[data-testid="route-cascade"]').setValue(false)

      await save(wrapper).trigger('click')
      await flushPromises()

      expect(itemPage.saveResource).toHaveBeenCalledWith(false, undefined)
    })

    test('a route whose path only starts with the same letters is not a child route', async () => {
      const itemPage = setupItemPage({ path: '/conference/programme/day' })
      mockCwa()
      const wrapper = mountTab()
      await flushPromises()
      await openSub(wrapper, 'route')
      itemPage.localResourceData.value.path = '/conference/renamed'
      await flushPromises()

      await save(wrapper).trigger('click')
      await flushPromises()

      expect(itemPage.saveResource).toHaveBeenCalledWith(false, undefined)
    })

    test('a new path cannot be saved while the child routes under it are still being checked, and says why', async () => {
      const itemPage = setupItemPage()
      let answer!: (value: unknown) => void
      mockCwa({ fetch: vi.fn(() => ({ response: new Promise((resolve) => {
        answer = resolve
      }) })) })
      const wrapper = mountTab()
      await flushPromises()
      await openSub(wrapper, 'route')
      itemPage.localResourceData.value.path = '/conference/renamed'
      await flushPromises()

      expect(save(wrapper).attributes('aria-disabled')).toBe('true')
      expect(save(wrapper).attributes('title')).toBe('Checking the child routes under this path…')
      await save(wrapper).trigger('click')
      await flushPromises()
      expect(itemPage.saveResource).not.toHaveBeenCalled()

      answer({ _data: { children } })
      await flushPromises()
      expect(save(wrapper).attributes('aria-disabled')).toBeUndefined()
      expect(wrapper.find('[data-testid="route-cascade"]').exists()).toBe(true)
    })

    test('when the child routes could not be checked, a new path says so with Retry and is not saved until they are', async () => {
      const itemPage = setupItemPage()
      const fetch = vi.fn(() => ({ response: Promise.reject(new Error('boom')) }))
      mockCwa({ fetch })
      const wrapper = mountTab()
      await flushPromises()
      await openSub(wrapper, 'route')
      expect(wrapper.find('[data-testid="routes-children-failed"]').exists()).toBe(false)
      itemPage.localResourceData.value.path = '/conference/renamed'
      await flushPromises()

      const alert = wrapper.find('[data-testid="routes-children-failed"]')
      expect(alert.text()).toContain('Couldn\'t check child routes')
      expect(save(wrapper).attributes('title')).toBe('Couldn\'t check the child routes under this path.')
      await save(wrapper).trigger('click')
      await flushPromises()
      expect(itemPage.saveResource).not.toHaveBeenCalled()
      expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()

      fetch.mockImplementation(() => ({ response: Promise.resolve({ _data: { children } }) }) as any)
      await alert.find('button').trigger('click')
      await flushPromises()
      expect(wrapper.find('[data-testid="routes-children-failed"]').exists()).toBe(false)
      await save(wrapper).trigger('click')
      await flushPromises()
      expect(itemPage.saveResource).toHaveBeenCalledWith(false, { cascadeChildPaths: true })
    })

    test('a go-live change saves even when the child routes could not be checked, since it changes no path', async () => {
      const itemPage = setupItemPage()
      mockCwa({ fetch: vi.fn(() => ({ response: Promise.reject(new Error('boom')) })) })
      const wrapper = mountTab()
      await flushPromises()
      await openSub(wrapper, 'route')
      itemPage.localResourceData.value.liveAt = null
      await flushPromises()

      expect(wrapper.find('[data-testid="routes-children-failed"]').exists()).toBe(false)
      await save(wrapper).trigger('click')
      await flushPromises()
      expect(itemPage.saveResource).toHaveBeenCalledWith(false, undefined)
    })

    test('a new path with no child routes under the old one sends no cascade', async () => {
      const itemPage = setupItemPage({ path: '/conference/other' })
      mockCwa()
      const wrapper = mountTab()
      await flushPromises()
      await openSub(wrapper, 'route')
      itemPage.localResourceData.value.path = '/conference/renamed'
      await flushPromises()

      await save(wrapper).trigger('click')
      await flushPromises()

      expect(itemPage.saveResource).toHaveBeenCalledWith(false, undefined)
    })

    test('a failed save keeps the form open with what was typed, under an alert with Retry', async () => {
      const itemPage = setupItemPage()
      itemPage.saveResource.mockResolvedValueOnce(undefined)
      mockCwa()
      const wrapper = mountTab()
      await flushPromises()
      await openSub(wrapper, 'route')
      itemPage.localResourceData.value.path = '/conference/renamed'
      await flushPromises()

      await save(wrapper).trigger('click')
      await flushPromises()

      const alert = wrapper.find('[data-testid="routes-failure"]')
      expect(alert.text()).toContain('The route wasn\'t saved.')
      expect(alert.text()).toContain('what you typed is still here')
      expect(document.activeElement).toBe(alert.element)
      expect(itemPage.localResourceData.value.path).toBe('/conference/renamed')
      expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()

      await wrapper.find('[data-testid="routes-retry"]').trigger('click')
      await flushPromises()
      expect(itemPage.saveResource).toHaveBeenCalledTimes(2)
      expect(wrapper.find('[data-testid="routes-failure"]').exists()).toBe(false)
    })

    test('a save the server refuses lists every reason it gave, not only the path\'s', async () => {
      const itemPage = setupItemPage()
      itemPage.saveResource.mockImplementationOnce(async () => {
        itemPage.form.fieldErrors = { path: 'This path is already used.', liveAt: 'Choose a later date.' }
        itemPage.form.formError = 'The route name is too long.'
        return undefined
      })
      mockCwa()
      const wrapper = mountTab()
      await flushPromises()
      await openSub(wrapper, 'route')
      itemPage.localResourceData.value.path = '/conference/renamed'
      await flushPromises()

      await save(wrapper).trigger('click')
      await flushPromises()

      const reasons = wrapper.findAll('[data-testid="routes-failure-reason"]').map(reason => reason.text())
      expect(reasons).toEqual(['The route name is too long.', 'Route path: This path is already used.', 'Go live: Choose a later date.'])
      expect(wrapper.find('[data-testid="routes-failure"]').text()).toContain('What you typed is still here.')
      expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()
    })

    test('adding a route says where the page is now', async () => {
      const itemPage = setupItemPage({ adding: true })
      mockCwa()
      const wrapper = mountTab({ route: null })
      await openSub(wrapper, 'route', true)

      await save(wrapper).trigger('click')
      await flushPromises()

      expect(itemPage.saveResource).toHaveBeenCalledWith(false, undefined)
      expect(wrapper.find('[data-testid="routes-status"]').text()).toBe('Route added: /my-programme.')
    })

    test('Back with nothing typed goes straight back', async () => {
      setupItemPage()
      mockCwa()
      const wrapper = mountTab()
      await openSub(wrapper, 'route')

      await wrapper.find('[data-testid="sub-view-back"]').trigger('click')
      await flushPromises()

      expect(confirmMock).not.toHaveBeenCalled()
      expect(wrapper.find('[data-testid="sub-view"]').exists()).toBe(false)
    })

    test.each([
      ['Back', (wrapper: Wrapper) => wrapper.find('[data-testid="sub-view-back"]').trigger('click')],
      ['Cancel', (wrapper: Wrapper) => cancel(wrapper).trigger('click')],
      ['Escape', (wrapper: Wrapper) => wrapper.find('[data-testid="route-form"]').trigger('keydown', { key: 'Escape' })],
    ])('%s with something typed asks first, and Keep editing keeps it', async (_how, leave) => {
      const itemPage = setupItemPage()
      mockCwa()
      const wrapper = mountTab()
      await flushPromises()
      await openSub(wrapper, 'route')
      itemPage.localResourceData.value.path = '/conference/renamed'
      await flushPromises()
      confirmMock.mockResolvedValueOnce(false)

      await leave(wrapper)
      await flushPromises()

      expect(confirmMock).toHaveBeenCalledWith({
        title: 'Discard your route changes?',
        description: 'What you changed here will be lost. Changes on the other tabs are kept.',
        keep: 'Keep editing',
        go: 'Discard',
      })
      expect(wrapper.find('[data-testid="sub-view"]').exists()).toBe(true)
      expect(itemPage.localResourceData.value.path).toBe('/conference/renamed')
    })

    test('Discard throws the typed path away', async () => {
      const itemPage = setupItemPage()
      mockCwa()
      const wrapper = mountTab()
      await flushPromises()
      await openSub(wrapper, 'route')
      itemPage.localResourceData.value.path = '/conference/renamed'
      await flushPromises()

      await cancel(wrapper).trigger('click')
      await flushPromises()

      expect(wrapper.find('[data-testid="sub-view"]').exists()).toBe(false)
      expect(itemPage.localResourceData.value.path).toBe('/conference/programme')
    })
  })

  describe('deleting the route', () => {
    test('when who is editing cannot be read, the route delete still asks, without naming anyone', async () => {
      setupItemPage()
      mockCwa({ fetch: vi.fn(() => ({ response: Promise.resolve({ _data: { children: [] } }) })) })
      confirmMock.mockResolvedValueOnce(false)
      realtime.peers.mockImplementationOnce(() => {
        throw new Error('chunk failed')
      })
      const wrapper = mountTab()
      await flushPromises()
      await openSub(wrapper, 'route')

      await wrapper.findComponent(RoutesTabManage).vm.$emit('delete')
      await vi.dynamicImportSettled()
      await flushPromises()

      expect(confirmMock.mock.calls[0]![0].lines).toEqual([{ text: 'Visitors to /conference/programme get “Page not found”.' }])
    })

    test('names the other admins editing the route first', async () => {
      setupItemPage()
      mockCwa({ fetch: vi.fn(() => ({ response: Promise.resolve({ _data: { children: [] } }) })) })
      confirmMock.mockResolvedValueOnce(false)
      realtime.peers.mockReturnValueOnce([{ user: { id: '/users/sam' }, name: 'Sam', idle: false }, { user: { id: '/users/kim' }, name: 'Kim', idle: false }])
      const wrapper = mountTab()
      await flushPromises()
      await openSub(wrapper, 'route')

      await wrapper.findComponent(RoutesTabManage).vm.$emit('delete')
      await vi.dynamicImportSettled()
      await flushPromises()

      expect(realtime.peers).toHaveBeenCalledWith(ROUTE_IRI)
      expect(confirmMock.mock.calls[0]![0].lines).toEqual([
        { text: 'Sam and Kim are editing this.' },
        { text: 'Visitors to /conference/programme get “Page not found”.' },
      ])
    })

    test('asks with a simple confirm when nothing depends on it, then deletes and says so', async () => {
      const itemPage = setupItemPage()
      mockCwa({ fetch: vi.fn(() => ({ response: Promise.resolve({ _data: { children: [] } }) })) })
      const wrapper = mountTab()
      await flushPromises()
      await openSub(wrapper, 'route')

      await wrapper.findComponent(RoutesTabManage).vm.$emit('delete')
      await flushPromises()

      expect(confirmMock).toHaveBeenCalledWith({
        title: 'Delete the route /conference/programme?',
        lines: [{ text: 'Visitors to /conference/programme get “Page not found”.' }],
        keep: 'Don\'t delete',
        go: 'Delete route',
        typed: undefined,
      })
      expect(itemPage.deleteResource).toHaveBeenCalledWith(undefined, expect.any(Function), true)
      expect(wrapper.find('[data-testid="sub-view"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="routes-status"]').text()).toBe('Route /conference/programme deleted.')
    })

    test('a delete the server refuses keeps the route form open under an alert with Retry, and never says it was deleted', async () => {
      const itemPage = setupItemPage()
      itemPage.deleteResource.mockResolvedValueOnce(false)
      mockCwa({ fetch: vi.fn(() => ({ response: Promise.resolve({ _data: { children: [] } }) })) })
      const wrapper = mountTab()
      await flushPromises()
      await openSub(wrapper, 'route')

      await wrapper.findComponent(RoutesTabManage).vm.$emit('delete')
      await flushPromises()

      const alert = wrapper.find('[data-testid="routes-failure"]')
      expect(alert.text()).toContain('The route wasn\'t deleted.')
      expect(alert.text()).toContain('The server couldn\'t delete it. Nothing changed.')
      expect(document.activeElement).toBe(alert.element)
      expect(wrapper.find('[data-testid="sub-view"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="routes-status"]').exists()).toBe(false)

      await wrapper.find('[data-testid="routes-retry"]').trigger('click')
      await flushPromises()
      expect(itemPage.deleteResource).toHaveBeenCalledTimes(2)
      expect(wrapper.find('[data-testid="sub-view"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="routes-status"]').text()).toBe('Route /conference/programme deleted.')
    })

    test('asks to type the path when old addresses or child routes depend on it', async () => {
      setupItemPage({ redirectedFrom: [{ '@id': '/_/routes//old', 'path': '/old' }] })
      mockCwa()
      const wrapper = mountTab()
      await flushPromises()
      await openSub(wrapper, 'route')

      await wrapper.findComponent(RoutesTabManage).vm.$emit('delete')
      await flushPromises()

      expect(confirmMock.mock.calls[0]![0].typed).toEqual({ noun: 'path', value: '/conference/programme' })
      expect(confirmMock.mock.calls[0]![0].lines.map((line: { text: string }) => line.text)).toEqual([
        'Visitors to /conference/programme get “Page not found”.',
        'Its 1 old address goes too.',
        'The 3 child routes keep their paths.',
      ])
    })

    test('asks to type the path when only child routes depend on it', async () => {
      setupItemPage()
      mockCwa()
      const wrapper = mountTab()
      await flushPromises()
      await openSub(wrapper, 'route')

      await wrapper.findComponent(RoutesTabManage).vm.$emit('delete')
      await flushPromises()

      expect(confirmMock.mock.calls[0]![0].typed).toEqual({ noun: 'path', value: '/conference/programme' })
    })

    test('Don\'t delete deletes nothing', async () => {
      const itemPage = setupItemPage()
      mockCwa()
      const wrapper = mountTab()
      await openSub(wrapper, 'route')
      confirmMock.mockResolvedValueOnce(false)

      await wrapper.findComponent(RoutesTabManage).vm.$emit('delete')
      await flushPromises()

      expect(itemPage.deleteResource).not.toHaveBeenCalled()
      expect(wrapper.find('[data-testid="sub-view"]').exists()).toBe(true)
    })

    test.each([
      [false, '/_/pages/p'],
      [true, '/_/page_data/d'],
    ])('deleting the route being viewed goes to the page by its IRI (data page: %s)', async (isDataPage, iri) => {
      const itemPage = setupItemPage({ path: '/' })
      mockCwa({ resources: { getResource: vi.fn(() => ref(null)), isDataPage: ref(isDataPage), pageDataIri: ref('/_/page_data/d'), pageIri: ref('/_/pages/p') } })
      const wrapper = mountTab()
      await openSub(wrapper, 'route')

      await wrapper.findComponent(RoutesTabManage).vm.$emit('delete')
      await flushPromises()
      itemPage.deleteResource.mock.calls[0]![1]()

      expect(mockNavigateTo).toHaveBeenCalledWith({ name: '_cwa-resource-page', params: { cwaPage0: iri } })
    })

    test('deleting the route being viewed goes nowhere when there is no page to fall back to', async () => {
      const itemPage = setupItemPage({ path: '/' })
      mockCwa({ resources: { getResource: vi.fn(() => ref(null)), isDataPage: ref(false), pageDataIri: ref(undefined), pageIri: ref(undefined) } })
      const wrapper = mountTab()
      await openSub(wrapper, 'route')

      await wrapper.findComponent(RoutesTabManage).vm.$emit('delete')
      await flushPromises()
      itemPage.deleteResource.mock.calls[0]![1]()

      expect(mockNavigateTo).not.toHaveBeenCalled()
    })
  })

  describe('Redirect to', () => {
    test('shows where the route sends visitors, and the sub-view has no footer while it is a list', async () => {
      setupItemPage({ redirect: '/_/routes//kitchens/range' })
      mockCwa()
      const wrapper = mountTab()
      await openSub(wrapper, 'to')

      expect(subTitle(wrapper).text()).toBe('Redirect to')
      expect(wrapper.findComponent(RoutesTabForwardTo).props('forwardToPath')).toBe('/kitchens/range')
      expect(save(wrapper).exists()).toBe(false)
      expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()
    })

    test('choosing a page and Redirect sends the redirect alone, then says what happened', async () => {
      setupItemPage()
      const cwa = mockCwa()
      const wrapper = mountTab()
      await openSub(wrapper, 'to')
      await wrapper.find('[data-set-forward]').trigger('click')
      await flushPromises()
      expect(labelOf(save(wrapper).element)).toBe('Redirect')
      expect(save(wrapper).attributes('title')).toBe('Choose a page first.')

      await wrapper.findComponent(RoutesTabForwardTo).vm.$emit('update:modelValue', '/_/routes//kitchens/range')
      await flushPromises()
      expect(wrapper.findComponent(RoutesTabForwardTo).props('pickedPath')).toBe('/kitchens/range')
      await save(wrapper).trigger('click')
      await flushPromises()

      expect(cwa.resourcesManager.updateResource).toHaveBeenCalledWith({ endpoint: ROUTE_IRI, data: { redirect: '/_/routes//kitchens/range' } })
      expect(wrapper.find('[data-testid="routes-status"]').text()).toBe('Visitors to /conference/programme are now sent to /kitchens/range.')
      expect(wrapper.findComponent(RoutesTabForwardTo).props('form')).toBe(false)
    })

    test('a route cannot be sent to itself', async () => {
      setupItemPage()
      const cwa = mockCwa()
      const wrapper = mountTab()
      await openSub(wrapper, 'to')
      await wrapper.find('[data-set-forward]').trigger('click')
      await wrapper.findComponent(RoutesTabForwardTo).vm.$emit('update:modelValue', ROUTE_IRI)
      await flushPromises()

      expect(save(wrapper).attributes('title')).toBe('A route cannot redirect to itself.')
      await save(wrapper).trigger('click')
      expect(cwa.resourcesManager.updateResource).not.toHaveBeenCalled()
    })

    test('Remove asks Keep redirecting or Stop redirecting, and only Stop redirecting sends it', async () => {
      setupItemPage({ redirect: '/_/routes//kitchens/range' })
      const cwa = mockCwa()
      const wrapper = mountTab()
      await openSub(wrapper, 'to')
      confirmMock.mockResolvedValueOnce(false)

      await wrapper.find('[data-remove-forward]').trigger('click')
      await flushPromises()
      expect(confirmMock).toHaveBeenCalledWith({
        title: 'Stop redirecting?',
        description: 'Visitors to /conference/programme will see this page again.',
        keep: 'Keep redirecting',
        go: 'Stop redirecting',
      })
      expect(cwa.resourcesManager.updateResource).not.toHaveBeenCalled()

      await wrapper.find('[data-remove-forward]').trigger('click')
      await flushPromises()
      expect(cwa.resourcesManager.updateResource).toHaveBeenCalledWith({ endpoint: ROUTE_IRI, data: { redirect: null } })
    })

    test('a failed redirect keeps the choice under an alert', async () => {
      setupItemPage()
      const cwa = mockCwa()
      cwa.resourcesManager.updateResource.mockResolvedValueOnce(undefined)
      const wrapper = mountTab()
      await openSub(wrapper, 'to')
      await wrapper.find('[data-set-forward]').trigger('click')
      await wrapper.findComponent(RoutesTabForwardTo).vm.$emit('update:modelValue', '/_/routes//kitchens/range')
      await flushPromises()

      await save(wrapper).trigger('click')
      await flushPromises()

      expect(wrapper.find('[data-testid="routes-failure"]').text()).toContain('The redirect wasn\'t saved.')
      expect(wrapper.findComponent(RoutesTabForwardTo).props('modelValue')).toBe('/_/routes//kitchens/range')
    })
  })

  describe('Redirected from', () => {
    test('Add sends the old address pointing at this page\'s route, then says it now redirects here', async () => {
      const itemPage = setupItemPage()
      const cwa = mockCwa()
      const wrapper = mountTab()
      await openSub(wrapper, 'from')
      expect(save(wrapper).exists()).toBe(false)
      await wrapper.find('[data-testid="route-redirect-add"]').trigger('click')
      await flushPromises()
      expect(document.activeElement?.tagName).toBe('INPUT')
      expect(labelOf(save(wrapper).element)).toBe('Add')

      await wrapper.find('input').setValue('/old-shaker')
      await save(wrapper).trigger('click')
      await flushPromises()

      expect(cwa.resourcesManager.createResource).toHaveBeenCalledWith({ endpoint: '/_/routes', data: { name: '/old-shaker', path: '/old-shaker', redirect: ROUTE_IRI } })
      expect(itemPage.loadResource).toHaveBeenCalled()
      expect(wrapper.find('[data-testid="routes-status"]').text()).toBe('/old-shaker now redirects here.')
      expect(wrapper.findComponent(RoutesTabRedirects).props('form')).toBe(false)
    })

    test('a page with no route cannot add an old address, and Add says why', async () => {
      setupItemPage({ adding: true })
      const cwa = mockCwa()
      const wrapper = mountTab({ route: null })
      await openSub(wrapper, 'from')

      const add = wrapper.find('[data-testid="route-redirect-add"]')
      expect(add.attributes('aria-disabled')).toBe('true')
      expect(add.attributes('title')).toBe('Add a route first: old addresses send visitors to it.')
      await wrapper.findComponent(RoutesTabRedirects).vm.$emit('start')
      await flushPromises()
      expect(wrapper.findComponent(RoutesTabRedirects).props('form')).toBe(false)
      expect(cwa.resourcesManager.createResource).not.toHaveBeenCalled()
    })

    test('an old address whose page loses its route before it is sent is not sent', async () => {
      setupItemPage()
      const cwa = mockCwa()
      const wrapper = mountTab()
      await openSub(wrapper, 'from')
      await wrapper.find('[data-testid="route-redirect-add"]').trigger('click')
      await wrapper.find('input').setValue('/old-shaker')

      await wrapper.setProps({ pageResource: { '@id': '/_/pages/programme-uuid', '@type': 'Page', 'title': 'My Programme', 'route': null } as any })
      await flushPromises()
      await save(wrapper).trigger('click')
      await flushPromises()

      expect(cwa.resourcesManager.createResource).not.toHaveBeenCalled()
    })

    test('an old address typed with spaces is sent with a hyphen for each run', async () => {
      setupItemPage()
      const cwa = mockCwa()
      const wrapper = mountTab()
      await openSub(wrapper, 'from')
      await wrapper.find('[data-testid="route-redirect-add"]').trigger('click')
      await wrapper.find('input').setValue(' /old  shaker ')

      await save(wrapper).trigger('click')
      await flushPromises()

      expect(cwa.resourcesManager.createResource).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ path: '/old-shaker', name: '/old-shaker' }) }))
    })

    test.each(['/old?shaker', '/old#shaker'])('an old address “%s” cannot be added, and says why', async (typed) => {
      setupItemPage()
      const cwa = mockCwa()
      const wrapper = mountTab()
      await openSub(wrapper, 'from')
      await wrapper.find('[data-testid="route-redirect-add"]').trigger('click')
      await wrapper.find('input').setValue(typed)
      await flushPromises()

      expect(save(wrapper).attributes('title')).toBe('A path can\'t contain ? or #. They start a query or a page anchor.')
      await save(wrapper).trigger('click')
      await flushPromises()
      expect(cwa.resourcesManager.createResource).not.toHaveBeenCalled()
    })

    test.each(['old-shaker'])('“%s” is checked before sending and the reason shown', async (typed) => {
      setupItemPage()
      const cwa = mockCwa()
      const wrapper = mountTab()
      await openSub(wrapper, 'from')
      await wrapper.find('[data-testid="route-redirect-add"]').trigger('click')
      await wrapper.find('input').setValue(typed)

      await save(wrapper).trigger('click')
      await flushPromises()

      expect(cwa.resourcesManager.createResource).not.toHaveBeenCalled()
      expect(wrapper.find('[data-testid="input-invalid"]').text()).toBe('Start with /, for example /old-kitchens.')
    })

    test('a failed add keeps what was typed under an alert', async () => {
      setupItemPage()
      const cwa = mockCwa()
      cwa.resourcesManager.createResource.mockResolvedValueOnce(undefined)
      const wrapper = mountTab()
      await openSub(wrapper, 'from')
      await wrapper.find('[data-testid="route-redirect-add"]').trigger('click')
      await wrapper.find('input').setValue('/old-shaker')

      await save(wrapper).trigger('click')
      await flushPromises()

      expect(wrapper.find('[data-testid="routes-failure"]').text()).toContain('The old address wasn\'t added.')
      expect((wrapper.find('input').element as HTMLInputElement).value).toBe('/old-shaker')
    })

    test('deleting an old address asks Don\'t delete or Delete, typing it only when others sit under it, and goes without the API\'s own confirm', async () => {
      const nested = { '@id': '/_/routes//shaker', 'path': '/shaker', 'redirectedFrom': [{ '@id': '/_/routes//shaker-style', 'path': '/shaker-style', 'redirectedFrom': [] }] }
      const itemPage = setupItemPage({ redirectedFrom: [nested] })
      const cwa = mockCwa()
      itemPage.loadResource.mockImplementation(() => {
        itemPage.resource.value = { ...itemPage.resource.value, redirectedFrom: [] }
      })
      const wrapper = mountTab()
      await openSub(wrapper, 'from')

      await wrapper.findComponent(RoutesTabRedirects).vm.$emit('delete', nested)
      await flushPromises()

      expect(confirmMock).toHaveBeenCalledWith({
        title: 'Delete the old address /shaker?',
        lines: [{ text: 'Its 1 old address goes too.' }],
        keep: 'Don\'t delete',
        go: 'Delete',
        typed: { noun: 'old address', value: '/shaker' },
      })
      expect(cwa.resourcesManager.deleteResource).toHaveBeenCalledWith({ endpoint: '/_/routes//shaker', requestCompleteFn: expect.any(Function) }, true)
      expect(wrapper.find('[data-testid="routes-status"]').text()).toBe('/shaker no longer redirects here.')
    })

    test('deleting an old address names the other admins editing it first', async () => {
      const single = { '@id': '/_/routes//old', 'path': '/old', 'redirectedFrom': [] }
      setupItemPage({ redirectedFrom: [single] })
      mockCwa()
      confirmMock.mockResolvedValueOnce(false)
      realtime.peers.mockReturnValueOnce([{ user: { id: '/users/sam' }, name: 'Sam', idle: false }])
      const wrapper = mountTab()
      await openSub(wrapper, 'from')

      await wrapper.findComponent(RoutesTabRedirects).vm.$emit('delete', single)
      await vi.dynamicImportSettled()
      await flushPromises()

      expect(realtime.peers).toHaveBeenCalledWith('/_/routes//old')
      expect(confirmMock.mock.calls[0]![0].lines[0]).toEqual({ text: 'Sam is editing this.' })
    })

    test('an old address still there after deleting shows an alert with Retry', async () => {
      const single = { '@id': '/_/routes//old', 'path': '/old', 'redirectedFrom': [] }
      setupItemPage({ redirectedFrom: [single] })
      mockCwa()
      const wrapper = mountTab()
      await openSub(wrapper, 'from')

      await wrapper.findComponent(RoutesTabRedirects).vm.$emit('delete', single)
      await flushPromises()

      expect(confirmMock.mock.calls[0]![0].typed).toBeUndefined()
      expect(wrapper.find('[data-testid="routes-failure"]').text()).toContain('The old address wasn\'t deleted.')
    })

    test('deleting the old address being viewed goes to the page by its IRI', async () => {
      const single = { '@id': '/_/routes//', 'path': '/', 'redirectedFrom': [] }
      setupItemPage({ redirectedFrom: [single] })
      const cwa = mockCwa()
      const wrapper = mountTab()
      await openSub(wrapper, 'from')

      await wrapper.findComponent(RoutesTabRedirects).vm.$emit('delete', single)
      await flushPromises()
      cwa.resourcesManager.deleteResource.mock.calls[0]![0].requestCompleteFn()

      expect(mockNavigateTo).toHaveBeenCalledWith({ name: '_cwa-resource-page', params: { cwaPage0: '/_/pages/page-uuid' } })
    })
  })

  describe('Child routes', () => {
    test('loads each child route for its status and page when opened, and its actions go to the modal', async () => {
      setupItemPage()
      const cwa = mockCwa()
      const wrapper = mountTab()
      await flushPromises()
      expect(cwa.fetch).toHaveBeenCalledTimes(1)

      await openSub(wrapper, 'kids')

      expect(subTitle(wrapper).text()).toBe('Child routes')
      expect(cwa.fetch).toHaveBeenCalledWith({ path: '/_/routes//conference/programme/day-1/am' })
      const details = wrapper.findComponent(RoutesTabChildRoutes).props('details') as Record<string, { page?: string }>
      expect(Object.keys(details)).toHaveLength(3)
      expect(details['/_/routes//conference/elsewhere']!.page).toBe('/_/pages/elsewhere')
      expect(save(wrapper).exists()).toBe(false)

      await wrapper.findComponent(RoutesTabChildRoutes).vm.$emit('edit', '/_/pages/elsewhere')
      await wrapper.findComponent(RoutesTabChildRoutes).vm.$emit('go', '/conference/elsewhere')
      expect(wrapper.emitted('openPage')).toEqual([['/_/pages/elsewhere']])
      expect(wrapper.emitted('goTo')).toEqual([['/conference/elsewhere']])
      expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()
    })

    function manyChildren() {
      const leaf = (name: string) => ({ route: `/_/routes//conference/programme/${name}`, path: `/conference/programme/${name}`, children: [] as any[] })
      const last = { ...leaf('r8'), children: ['k1', 'k2', 'k3', 'k4'].map(name => leaf(`r8/${name}`)) }
      return [...['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7'].map(leaf), last]
    }

    function detailFetch(list: any[]) {
      const pending: Record<string, (value: unknown) => void> = {}
      const fetch = vi.fn((options: { path: string }) => ({
        response: options.path.endsWith('/children')
          ? Promise.resolve({ _data: { children: list } })
          : new Promise((resolve) => {
              pending[options.path] = resolve
            }),
      }))
      const answer = (path: string) => pending[path]!({ _data: { '@id': path, 'liveAt': null, 'page': `/_/pages/${path.split('/').pop()}` } })
      const asked = () => fetch.mock.calls.map(([options]) => options.path).filter(path => !path.endsWith('/children'))
      return { fetch, answer, asked }
    }

    test('loads at most six child routes at a time, and only the rows shown: a collapsed row\'s children wait until it opens', async () => {
      setupItemPage()
      const list = manyChildren()
      const { fetch, answer, asked } = detailFetch(list)
      mockCwa({ fetch })
      const wrapper = mountTab()
      await flushPromises()
      await openSub(wrapper, 'kids')

      expect(asked().map(path => path.split('/programme/')[1])).toEqual(['r1', 'r2', 'r3', 'r4', 'r5', 'r6'])
      const r8 = [...document.querySelectorAll<HTMLElement>('[role="row"]')].find(row => row.textContent?.includes('/conference/programme/r8') && !row.textContent?.includes('/k'))!
      r8.querySelector<HTMLElement>('[data-testid="tree-chevron"]')!.click()
      await flushPromises()

      for (const name of ['r1', 'r2', 'r3', 'r4', 'r5', 'r6']) {
        answer(`/_/routes//conference/programme/${name}`)
        await flushPromises()
      }
      answer('/_/routes//conference/programme/r7')
      answer('/_/routes//conference/programme/r8')
      await flushPromises()
      expect(asked().map(path => path.split('/programme/')[1])).toEqual(['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8'])

      r8.querySelector<HTMLElement>('[data-testid="tree-chevron"]')!.click()
      await flushPromises()
      expect(asked()).toHaveLength(12)
    })

    test('a child route that fails to load says so and offers Retry, never staying on Still loading', async () => {
      setupItemPage()
      const fetch = vi.fn((options: { path: string }) => ({
        response: options.path.endsWith('/children')
          ? Promise.resolve({ _data: { children: [{ route: '/_/routes//conference/elsewhere', path: '/conference/elsewhere', children: [] }] } })
          : Promise.reject(new Error('boom')),
      }))
      mockCwa({ fetch })
      const wrapper = mountTab()
      await flushPromises()
      await openSub(wrapper, 'kids')

      const kids = wrapper.findComponent(RoutesTabChildRoutes)
      expect(kids.props('details')).toEqual({ '/_/routes//conference/elsewhere': { state: 'failed' } })

      fetch.mockImplementation(((options: { path: string }) => ({ response: Promise.resolve({ _data: { '@id': options.path, 'liveAt': null, 'page': '/_/pages/elsewhere' } }) })) as any)
      await kids.vm.$emit('retry', '/_/routes//conference/elsewhere')
      await flushPromises()
      expect((kids.props('details') as any)['/_/routes//conference/elsewhere']).toMatchObject({ state: 'loaded', page: '/_/pages/elsewhere' })
    })
  })

  describe('the route resource', () => {
    test('reloads when the store holds the route without its redirects', async () => {
      const itemPage = setupItemPage()
      mockCwa()
      mountTab()
      await flushPromises()
      itemPage.loadResource.mockClear()

      itemPage.apiState.value = { status: CwaResourceApiStatuses.SUCCESS, path: ROUTE_IRI }
      await flushPromises()

      expect(itemPage.isLoading.value).toBe(true)
      expect(itemPage.loadResource).toHaveBeenCalled()
    })

    test('does not reload when it holds the redirects', async () => {
      const itemPage = setupItemPage()
      mockCwa()
      mountTab()
      await flushPromises()
      itemPage.loadResource.mockClear()

      itemPage.apiState.value = { status: CwaResourceApiStatuses.SUCCESS, path: `${ROUTE_IRI}/redirects` }
      await flushPromises()

      expect(itemPage.loadResource).not.toHaveBeenCalled()
    })

    test('reloads when the page\'s route changes', async () => {
      const itemPage = setupItemPage()
      mockCwa()
      const wrapper = mountTab()
      await flushPromises()
      itemPage.loadResource.mockClear()

      await wrapper.setProps({ pageResource: { '@id': '/_/pages/programme-uuid', '@type': 'Page', 'route': '/_/routes//conference/renamed' } as any })
      await flushPromises()

      expect(itemPage.loadResource).toHaveBeenCalled()
    })

    test('switching page while a sub-view is open returns to the main view', async () => {
      setupItemPage()
      mockCwa()
      const wrapper = mountTab()
      await openSub(wrapper, 'route')

      await wrapper.setProps({ pageResource: { '@id': '/_/pages/overview-uuid', '@type': 'Page', 'route': '/_/routes//2027-overview' } as any })
      await flushPromises()

      expect(wrapper.find('[data-testid="sub-view"]').exists()).toBe(false)
    })

    test('the route form binds to the page or page data it belongs to', () => {
      setupItemPage()
      mockCwa()
      mountTab({ '@type': 'ConferenceData', '@id': '/_/page_data/c', 'route': null })
      const options = mockUseItemPage.mock.calls[0]![0]
      expect(options.defaultResource.value).toEqual({ path: '', pageData: '/_/page_data/c' })
      expect(options.endpoint.value).toBe('add')
      const data = { path: '/x' } as Record<string, string>
      expect(options.validate(data)).toBe(true)
      expect(data.name).toBe('/x')
    })

    test('the route form loads the route with its redirects', () => {
      setupItemPage()
      mockCwa()
      mountTab()
      const options = mockUseItemPage.mock.calls[0]![0]
      expect(options.endpoint.value).toBe(`${ROUTE_IRI}/redirects`)
      expect(options.defaultResource.value).toEqual({ path: '', page: '/_/pages/programme-uuid' })
    })
  })

  describe('inside the page dialog', () => {
    function mountInDialog() {
      const form = fakeDialogForm({ reference: 'Programme' })
      const Host = defineComponent({
        setup() {
          return () => h(CwaUiDialog, { title: 'Programme', tabs: [{ key: 'details', label: 'Details' }, { key: 'routes', label: 'Routes' }], tab: 'routes', form }, {
            details: () => h('p', 'Details'),
            routes: () => h(RoutesTab, { pageResource: { '@id': '/_/pages/programme-uuid', '@type': 'Page', 'title': 'My Programme', 'route': ROUTE_IRI } as any }),
          })
        },
      })
      return mount(Host, { attachTo: document.body, global: { stubs: { ResourceSearch: true } } })
    }

    const dialog = () => document.querySelector<HTMLElement>('[data-testid="dialog"]')!
    const footerButtons = () => [...dialog().querySelectorAll<HTMLElement>('footer button')].map(labelOf)

    test('the route form\'s Cancel and Save route replace the dialog\'s, and a list sub-view hides the footer', async () => {
      setupItemPage()
      mockCwa()
      const wrapper = mountInDialog()
      await flushPromises()
      expect(footerButtons()).toEqual(['Cancel', 'Save'])

      await openSub(wrapper as unknown as Wrapper, 'route')
      expect(footerButtons()).toEqual(['Cancel', 'Save route'])
      expect(dialog().querySelector('[data-testid="sub-view-header"]')!.classList.contains('cwa:-mx-6')).toBe(true)

      dialog().querySelector<HTMLElement>('[data-testid="sub-view-back"]')!.click()
      await flushPromises()
      await openSub(wrapper as unknown as Wrapper, 'kids')
      expect(dialog().querySelector('footer')).toBeNull()
      expect(await axe(document.body)).toHaveNoViolations()
    })

    test('closing the dialog with a typed path asks once, naming the route path among the page\'s changes', async () => {
      const itemPage = setupItemPage()
      mockCwa()
      const wrapper = mountInDialog()
      await flushPromises()
      await openSub(wrapper as unknown as Wrapper, 'route')
      itemPage.localResourceData.value.path = '/conference/renamed'
      itemPage.localResourceData.value.liveAt = null
      await flushPromises()
      confirmMock.mockResolvedValueOnce(false)

      dialog().querySelector<HTMLElement>('[data-testid="dialog-close"]')!.click()
      await flushPromises()

      expect(confirmMock).toHaveBeenCalledTimes(1)
      expect(confirmMock).toHaveBeenCalledWith({
        title: 'Discard 2 unsaved changes?',
        description: 'Your changes to Route path and Go live will be lost.',
        keep: 'Keep editing',
        go: 'Discard',
      })
      expect(itemPage.localResourceData.value.path).toBe('/conference/renamed')
      expect(dialog().querySelector('[data-testid="sub-view"]')).not.toBeNull()
    })

    test('another tab with a typed path asks once, naming it, and Discard leaves the sub-view with the stored path back', async () => {
      const itemPage = setupItemPage()
      mockCwa()
      const wrapper = mountInDialog()
      await flushPromises()
      await openSub(wrapper as unknown as Wrapper, 'route')
      itemPage.localResourceData.value.path = '/conference/renamed'
      await flushPromises()

      dialog().querySelector<HTMLElement>('[role="tab"]')!.click()
      await flushPromises()

      expect(confirmMock).toHaveBeenCalledTimes(1)
      expect(confirmMock.mock.calls[0]![0].description).toBe('Your changes to Route path will be lost. Changes on the other tabs are kept.')
      expect(dialog().querySelector('[data-testid="sub-view"]')).toBeNull()
      expect(itemPage.localResourceData.value.path).toBe('/conference/programme')
    })

    test('Escape in an open Select closes the Select and stays in the sub-view', async () => {
      setupItemPage()
      mockCwa({}, { '/_/pages/conference-uuid': { data: { route: '/_/routes//conference' } } })
      const form = fakeDialogForm({ reference: 'Programme' })
      const Host = defineComponent({
        setup() {
          return () => h(CwaUiDialog, { title: 'Programme', tabs: [{ key: 'routes', label: 'Routes' }], form }, {
            routes: () => h(RoutesTab, { pageResource: { '@id': '/_/pages/programme-uuid', '@type': 'Page', 'title': 'My Programme', 'route': ROUTE_IRI, 'parentPage': '/_/pages/conference-uuid' } as any }),
          })
        },
      })
      const wrapper = mount(Host, { attachTo: document.body, global: { stubs: { ResourceSearch: true } } })
      await flushPromises()
      await openSub(wrapper as unknown as Wrapper, 'route')
      const trigger = dialog().querySelector<HTMLElement>('[data-testid="select-trigger"]')!
      trigger.focus()
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
      await flushPromises()
      expect(trigger.getAttribute('aria-expanded')).toBe('true')

      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
      await flushPromises()

      expect(dialog().querySelector('[data-testid="sub-view"]')).not.toBeNull()
    })
  })
})
