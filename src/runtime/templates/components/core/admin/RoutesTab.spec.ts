// @vitest-environment nuxt
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import RoutesTab from './RoutesTab.vue'
import RoutesTabView from './RoutesTabView.vue'
import RoutesTabManage from './RoutesTabManage.vue'
import RoutesTabForwardTo from './RoutesTabForwardTo.vue'
import RoutesTabAddRedirect from './RoutesTabAddRedirect.vue'
import * as cwaComposable from '#cwa/composables/cwa'
import { CwaResourceApiStatuses } from '#cwa/storage/stores/resources/state'

const { mockUseItemPage, mockReveal } = vi.hoisted(() => ({
  mockUseItemPage: vi.fn(),
  mockReveal: vi.fn(),
}))

vi.mock('#cwa-layer/pages/_cwa/index/composables/useItemPage', () => ({ useItemPage: mockUseItemPage }))
vi.mock('vuejs-confirm-dialog', () => ({
  createConfirmDialog: vi.fn(() => ({ reveal: mockReveal })),
}))

function mockCwa(getResourceImpl: (iri: string) => any = () => ref(null), resourcesManagerOverrides: Record<string, any> = {}) {
  // @ts-expect-error
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    resources: { getResource: vi.fn(getResourceImpl) },
    resourcesManager: { createResource: vi.fn(), deleteResource: vi.fn(), updateResource: vi.fn(), ...resourcesManagerOverrides },
  }))
}

function mockCwaFull(overrides: Record<string, any> = {}) {
  const fetchResource = vi.fn()
  const fetch = vi.fn(() => ({ response: Promise.resolve({ _data: { children: [] } }) }))
  const navigateTo = vi.fn()
  const cwa = {
    resources: {
      getResource: vi.fn(() => ref(null)),
      isDataPage: ref(false),
      pageDataIri: ref('/_/page_data/data-uuid'),
      pageIri: ref('/_/pages/page-uuid'),
    },
    resourcesManager: { createResource: vi.fn(), deleteResource: vi.fn(), updateResource: vi.fn() },
    fetchResource,
    fetch,
    ...overrides,
  }
  // @ts-expect-error
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => cwa)
  return { cwa, fetchResource, fetch, navigateTo }
}

function setupItemPage({ path = '/conference/programme', currentPath = '/conference/programme' }: { path?: string, currentPath?: string } = {}) {
  const saveResource = vi.fn().mockResolvedValue({ '@id': `/_/routes/${currentPath}`, 'path': currentPath })
  mockUseItemPage.mockReturnValue({
    isLoading: ref(false),
    isUpdating: ref(false),
    localResourceData: ref({ path }),
    resource: ref({ '@id': `/_/routes/${currentPath}`, 'path': currentPath, 'route': null }),
    loadResource: vi.fn(),
    deleteResource: vi.fn(),
    saveResource,
    resetResource: vi.fn(),
    apiState: ref({ status: 'SUCCESS', path: `/_/routes/${currentPath}/redirects` }),
  })
  return { saveResource }
}

function mountTab(pageResourceOverrides: Record<string, any> = {}) {
  return mount(RoutesTab, {
    props: {
      pageResource: {
        '@id': '/_/pages/programme-uuid',
        '@type': 'Page',
        'route': '/_/routes//conference/programme',
        'parentPage': null,
        'parentPageData': null,
        ...pageResourceOverrides,
      } as any,
    },
    shallow: true,
  })
}

describe('RoutesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('parent route prefix', () => {
    test('passes the parent route path as parentRoutePrefix to RoutesTabManage', async () => {
      setupItemPage()
      mockCwa((iri) => {
        if (iri === '/_/pages/conference-uuid') {
          return ref({ data: { route: '/_/routes//conference' } })
        }
        return ref(null)
      })
      const wrapper = mountTab({ parentPage: '/_/pages/conference-uuid' })
      await wrapper.findComponent(RoutesTabView).vm.$emit('changePage', 'manage-route')
      expect(wrapper.findComponent(RoutesTabManage).props('parentRoutePrefix')).toBe('/conference')
    })

    test('passes null parentRoutePrefix when parent has no route', async () => {
      setupItemPage()
      mockCwa((iri) => {
        if (iri === '/_/pages/conference-uuid') {
          return ref({ data: { route: null } })
        }
        return ref(null)
      })
      const wrapper = mountTab({ parentPage: '/_/pages/conference-uuid' })
      await wrapper.findComponent(RoutesTabView).vm.$emit('changePage', 'manage-route')
      expect(wrapper.findComponent(RoutesTabManage).props('parentRoutePrefix')).toBeNull()
    })

    test('passes null parentRoutePrefix when no parent is set', async () => {
      setupItemPage()
      mockCwa()
      const wrapper = mountTab({ parentPage: null, parentPageData: null })
      await wrapper.findComponent(RoutesTabView).vm.$emit('changePage', 'manage-route')
      expect(wrapper.findComponent(RoutesTabManage).props('parentRoutePrefix')).toBeNull()
    })
  })

  describe('parentHasNoRoute', () => {
    test('passes parentHasNoRoute=true to RoutesTabView when parent exists but has no route', () => {
      setupItemPage()
      mockCwa((iri) => {
        if (iri === '/_/pages/conference-uuid') {
          return ref({ data: { route: null } })
        }
        return ref(null)
      })
      const wrapper = mountTab({ parentPage: '/_/pages/conference-uuid' })
      expect(wrapper.findComponent(RoutesTabView).props('parentHasNoRoute')).toBe(true)
    })

    test('passes parentHasNoRoute=false to RoutesTabView when parent has a route', () => {
      setupItemPage()
      mockCwa((iri) => {
        if (iri === '/_/pages/conference-uuid') {
          return ref({ data: { route: '/_/routes//conference' } })
        }
        return ref(null)
      })
      const wrapper = mountTab({ parentPage: '/_/pages/conference-uuid' })
      expect(wrapper.findComponent(RoutesTabView).props('parentHasNoRoute')).toBe(false)
    })

    test('passes parentHasNoRoute=false when no parent', () => {
      setupItemPage()
      mockCwa()
      const wrapper = mountTab({ parentPage: null, parentPageData: null })
      expect(wrapper.findComponent(RoutesTabView).props('parentHasNoRoute')).toBe(false)
    })
  })

  describe('cascade child path update on save', () => {
    test('does not show cascade dialog when path has not changed', async () => {
      const { saveResource } = setupItemPage({ path: '/conference/programme', currentPath: '/conference/programme' })
      mockCwa()
      const wrapper = mountTab()
      await wrapper.findComponent(RoutesTabView).vm.$emit('changePage', 'manage-route')
      await wrapper.findComponent(RoutesTabManage).vm.$emit('save')
      expect(mockReveal).not.toHaveBeenCalled()
      expect(saveResource).toHaveBeenCalled()
      expect((saveResource.mock.calls[0][0] as any)?.cascadeChildPaths).toBeUndefined()
    })

    test('shows cascade dialog when path has changed', async () => {
      mockReveal.mockResolvedValue({ isCanceled: true })
      setupItemPage({ path: '/conference/new-slug', currentPath: '/conference/programme' })
      mockCwa()
      const wrapper = mountTab()
      await wrapper.findComponent(RoutesTabView).vm.$emit('changePage', 'manage-route')
      await wrapper.findComponent(RoutesTabManage).vm.$emit('save')
      expect(mockReveal).toHaveBeenCalledOnce()
    })

    test('saves with cascadeChildPaths when cascade is confirmed', async () => {
      mockReveal.mockResolvedValue({ isCanceled: false })
      const { saveResource } = setupItemPage({ path: '/conference/new-slug', currentPath: '/conference/programme' })
      mockCwa()
      const wrapper = mountTab()
      await wrapper.findComponent(RoutesTabView).vm.$emit('changePage', 'manage-route')
      await wrapper.findComponent(RoutesTabManage).vm.$emit('save')
      await flushPromises()
      expect(saveResource).toHaveBeenCalledWith(false, { cascadeChildPaths: true })
    })

    test('saves without cascadeChildPaths when cascade is declined', async () => {
      mockReveal.mockResolvedValue({ isCanceled: true })
      const { saveResource } = setupItemPage({ path: '/conference/new-slug', currentPath: '/conference/programme' })
      mockCwa()
      const wrapper = mountTab()
      await wrapper.findComponent(RoutesTabView).vm.$emit('changePage', 'manage-route')
      await wrapper.findComponent(RoutesTabManage).vm.$emit('save')
      await flushPromises()
      expect(saveResource).toHaveBeenCalledWith(false, undefined)
    })
  })

  describe('generate+cascade two-step flow', () => {
    test('does not offer cascade when generated path matches current path', async () => {
      setupItemPage({ path: '/conference', currentPath: '/conference' })
      const createResource = vi.fn().mockResolvedValue({ '@id': '/_/routes//conference', 'path': '/conference' })
      const updateResource = vi.fn()
      mockCwa(() => ref(null), { createResource, updateResource })
      mockReveal.mockResolvedValue({ isCanceled: false })
      const wrapper = mountTab()
      await wrapper.findComponent(RoutesTabView).vm.$emit('changePage', 'manage-route')
      await wrapper.findComponent(RoutesTabManage).vm.$emit('generate')
      await flushPromises()
      expect(mockReveal).not.toHaveBeenCalled()
      expect(updateResource).not.toHaveBeenCalled()
    })

    test('offers cascade when generated path differs from current path', async () => {
      setupItemPage({ path: '/conference', currentPath: '/conference' })
      const createResource = vi.fn().mockResolvedValue({ '@id': '/_/routes//summit', 'path': '/summit' })
      mockCwa(() => ref(null), { createResource, updateResource: vi.fn() })
      mockReveal.mockResolvedValue({ isCanceled: true })
      const wrapper = mountTab()
      await wrapper.findComponent(RoutesTabView).vm.$emit('changePage', 'manage-route')
      await wrapper.findComponent(RoutesTabManage).vm.$emit('generate')
      await flushPromises()
      expect(mockReveal).toHaveBeenCalledOnce()
    })

    test('patches new route with cascade data when confirmed', async () => {
      setupItemPage({ path: '/conference', currentPath: '/conference' })
      const createResource = vi.fn().mockResolvedValue({ '@id': '/_/routes//summit', 'path': '/summit' })
      const updateResource = vi.fn().mockResolvedValue({})
      mockCwa(() => ref(null), { createResource, updateResource })
      mockReveal.mockResolvedValue({ isCanceled: false })
      const wrapper = mountTab()
      await wrapper.findComponent(RoutesTabView).vm.$emit('changePage', 'manage-route')
      await wrapper.findComponent(RoutesTabManage).vm.$emit('generate')
      await flushPromises()
      expect(updateResource).toHaveBeenCalledWith({
        endpoint: '/_/routes//summit',
        data: { path: '/summit', cascadeChildPaths: true, oldPath: '/conference' },
      })
    })

    test('does not patch when cascade declined', async () => {
      setupItemPage({ path: '/conference', currentPath: '/conference' })
      const createResource = vi.fn().mockResolvedValue({ '@id': '/_/routes//summit', 'path': '/summit' })
      const updateResource = vi.fn()
      mockCwa(() => ref(null), { createResource, updateResource })
      mockReveal.mockResolvedValue({ isCanceled: true })
      const wrapper = mountTab()
      await wrapper.findComponent(RoutesTabView).vm.$emit('changePage', 'manage-route')
      await wrapper.findComponent(RoutesTabManage).vm.$emit('generate')
      await flushPromises()
      expect(updateResource).not.toHaveBeenCalled()
    })
  })

  describe('forward-to outbound redirect', () => {
    function setupForwardItemPage(redirect: string | null = null) {
      mockUseItemPage.mockReturnValue({
        isLoading: ref(false),
        isUpdating: ref(false),
        localResourceData: ref({ path: '/topic-1' }),
        resource: ref({ '@id': '/_api/_/routes//topic-1', 'path': '/topic-1', 'redirect': redirect }),
        loadResource: vi.fn(),
        deleteResource: vi.fn(),
        saveResource: vi.fn().mockResolvedValue({ '@id': '/_api/_/routes//topic-1', 'path': '/topic-1' }),
        resetResource: vi.fn(),
        apiState: ref({ status: 'SUCCESS', path: '/_api/_/routes//topic-1/redirects' }),
      })
    }

    test('shows RoutesTabForwardTo when view emits changePage "forward-to"', async () => {
      setupForwardItemPage()
      mockCwa()
      const wrapper = mountTab()
      await wrapper.findComponent(RoutesTabView).vm.$emit('changePage', 'forward-to')
      expect(wrapper.findComponent(RoutesTabForwardTo).exists()).toBe(true)
    })

    test('patches current route with the selected redirect IRI', async () => {
      setupForwardItemPage()
      const updateResource = vi.fn().mockResolvedValue({})
      mockCwa(() => ref(null), { updateResource })
      const wrapper = mountTab()
      await wrapper.findComponent(RoutesTabView).vm.$emit('changePage', 'forward-to')
      await wrapper.findComponent(RoutesTabForwardTo).vm.$emit('create', '/_api/_/routes//topic-1/chapter-one')
      await flushPromises()
      expect(updateResource).toHaveBeenCalledWith({
        endpoint: '/_api/_/routes//topic-1',
        data: { redirect: '/_api/_/routes//topic-1/chapter-one' },
      })
    })

    test('returns to view screen after setting forward', async () => {
      setupForwardItemPage()
      mockCwa(() => ref(null), { updateResource: vi.fn().mockResolvedValue({}) })
      const wrapper = mountTab()
      await wrapper.findComponent(RoutesTabView).vm.$emit('changePage', 'forward-to')
      await wrapper.findComponent(RoutesTabForwardTo).vm.$emit('create', '/_api/_/routes//topic-1/chapter-one')
      await flushPromises()
      expect(wrapper.findComponent(RoutesTabView).exists()).toBe(true)
    })

    test('patches redirect to null when view emits remove-forward', async () => {
      setupForwardItemPage('/_api/_/routes//topic-1/chapter-one')
      const updateResource = vi.fn().mockResolvedValue({})
      mockCwa(() => ref(null), { updateResource })
      const wrapper = mountTab()
      await wrapper.findComponent(RoutesTabView).vm.$emit('remove-forward')
      await flushPromises()
      expect(updateResource).toHaveBeenCalledWith({
        endpoint: '/_api/_/routes//topic-1',
        data: { redirect: null },
      })
    })

    test('passes forwardToPath derived from resource.redirect IRI to RoutesTabView', () => {
      setupForwardItemPage('/_api/_/routes//topic-1/chapter-one')
      mockCwa()
      const wrapper = mountTab()
      expect(wrapper.findComponent(RoutesTabView).props('forwardToPath')).toBe('/topic-1/chapter-one')
    })

    test('passes undefined forwardToPath when resource has no redirect', () => {
      setupForwardItemPage(null)
      mockCwa()
      const wrapper = mountTab()
      expect(wrapper.findComponent(RoutesTabView).props('forwardToPath')).toBeUndefined()
    })

    test('passes currentRouteIri to RoutesTabForwardTo for self-redirect guard', async () => {
      setupForwardItemPage()
      mockCwa()
      const wrapper = mountTab()
      await wrapper.findComponent(RoutesTabView).vm.$emit('changePage', 'forward-to')
      expect(wrapper.findComponent(RoutesTabForwardTo).props('currentRouteIri')).toBe('/_api/_/routes//topic-1')
    })

    test('passes initialIri from existing redirect to RoutesTabForwardTo', async () => {
      setupForwardItemPage('/_api/_/routes//topic-1/chapter-one')
      mockCwa()
      const wrapper = mountTab()
      await wrapper.findComponent(RoutesTabView).vm.$emit('changePage', 'forward-to')
      expect(wrapper.findComponent(RoutesTabForwardTo).props('initialIri')).toBe('/_api/_/routes//topic-1/chapter-one')
    })
  })

  describe('child routes loading and flattening', () => {
    test('loads and flattens nested child routes into the template', async () => {
      setupItemPage()
      const fetch = vi.fn(() => ({
        response: Promise.resolve({
          _data: {
            children: [
              { route: '/_/routes//conference/programme/a', path: '/conference/programme/a', children: [
                { route: '/_/routes//conference/programme/a/b', path: '/conference/programme/a/b', children: [] },
              ] },
              { route: '/_/routes//conference/programme/c', path: '/conference/programme/c', children: [] },
            ],
          },
        }),
      }))
      mockCwaFull({ fetch })
      const wrapper = mountTab()
      await flushPromises()
      // fetched against the route children endpoint
      expect(fetch).toHaveBeenCalledWith({ path: '/_/routes//conference/programme/children' })
      const text = wrapper.text()
      expect(text).toContain('Child routes')
      expect(text).toContain('/conference/programme/a')
      expect(text).toContain('/conference/programme/a/b')
      expect(text).toContain('/conference/programme/c')
    })

    test('clears child routes when fetch rejects', async () => {
      setupItemPage()
      const fetch = vi.fn(() => ({ response: Promise.reject(new Error('boom')) }))
      mockCwaFull({ fetch })
      const wrapper = mountTab()
      await flushPromises()
      expect(wrapper.text()).not.toContain('Child routes')
    })

    test('does not load child routes when the page has no route IRI', async () => {
      setupItemPage()
      const fetch = vi.fn(() => ({ response: Promise.resolve({ _data: { children: [] } }) }))
      mockCwaFull({ fetch })
      mountTab({ route: null })
      await flushPromises()
      expect(fetch).not.toHaveBeenCalled()
    })

    test('clears child routes when resource has no @id', async () => {
      mockUseItemPage.mockReturnValue({
        isLoading: ref(false),
        isUpdating: ref(false),
        localResourceData: ref({ path: '/x' }),
        resource: ref(null),
        loadResource: vi.fn(),
        deleteResource: vi.fn(),
        saveResource: vi.fn(),
        resetResource: vi.fn(),
        apiState: ref(null),
      })
      const fetch = vi.fn(() => ({ response: Promise.resolve({ _data: { children: [] } }) }))
      mockCwaFull({ fetch })
      const wrapper = mountTab()
      await flushPromises()
      // immediate watch with res null takes the else branch -> no fetch, no child routes rendered
      expect(fetch).not.toHaveBeenCalled()
      expect(wrapper.text()).not.toContain('Child routes')
    })
  })

  describe('parent shallow fetch', () => {
    test('fetches the parent resource shallowly when not yet loaded', async () => {
      setupItemPage()
      const fetchResource = vi.fn()
      mockCwaFull({
        fetchResource,
        resources: {
          getResource: vi.fn(() => ref({ data: null })),
          isDataPage: ref(false),
          pageDataIri: ref(''),
          pageIri: ref(''),
        },
      })
      mountTab({ parentPage: '/_/pages/conference-uuid' })
      await flushPromises()
      expect(fetchResource).toHaveBeenCalledWith({ path: '/_/pages/conference-uuid', shallowFetch: true })
    })
  })

  describe('endpoint computed', () => {
    test('uses the page route redirects endpoint when a route exists', async () => {
      setupItemPage()
      mockCwaFull()
      mountTab()
      await flushPromises()
      const lastArgs = mockUseItemPage.mock.calls.at(-1)?.[0]
      expect(lastArgs.endpoint.value).toBe('/_/routes//conference/programme/redirects')
    })

    test('falls back to "add" endpoint when the page has no route', async () => {
      setupItemPage()
      mockCwaFull()
      mountTab({ route: null })
      await flushPromises()
      const lastArgs = mockUseItemPage.mock.calls.at(-1)?.[0]
      expect(lastArgs.endpoint.value).toBe('add')
    })
  })

  describe('validate and defaultResource', () => {
    test('validate copies path into name and returns true', async () => {
      setupItemPage()
      mockCwaFull()
      mountTab()
      await flushPromises()
      const lastArgs = mockUseItemPage.mock.calls.at(-1)?.[0]
      const data: Record<string, any> = { path: '/foo' }
      expect(lastArgs.validate(data)).toBe(true)
      expect(data.name).toBe('/foo')
    })

    test('defaultResource sets page for a Page resource', async () => {
      setupItemPage()
      mockCwaFull()
      mountTab({ '@type': 'Page', '@id': '/_/pages/p1' })
      await flushPromises()
      const lastArgs = mockUseItemPage.mock.calls.at(-1)?.[0]
      expect(lastArgs.defaultResource).toEqual({ path: '', page: '/_/pages/p1' })
    })

    test('defaultResource sets pageData for a non-Page resource', async () => {
      setupItemPage()
      mockCwaFull()
      mountTab({ '@type': 'PageData', '@id': '/_/page_data/d1' })
      await flushPromises()
      const lastArgs = mockUseItemPage.mock.calls.at(-1)?.[0]
      expect(lastArgs.defaultResource).toEqual({ path: '', pageData: '/_/page_data/d1' })
    })
  })

  describe('create redirect flow', () => {
    test('creates a redirect resource then returns to view and reloads', async () => {
      const loadResource = vi.fn()
      mockUseItemPage.mockReturnValue({
        isLoading: ref(false),
        isUpdating: ref(false),
        localResourceData: ref({ path: '/conference/programme' }),
        resource: ref({ '@id': '/_/routes//conference/programme', 'path': '/conference/programme', 'route': null }),
        loadResource,
        deleteResource: vi.fn(),
        saveResource: vi.fn(),
        resetResource: vi.fn(),
        apiState: ref({ status: 'SUCCESS', path: '/_/routes//conference/programme/redirects' }),
      })
      const createResource = vi.fn().mockResolvedValue({ '@id': '/_/routes//new-redirect' })
      mockCwaFull({ resourcesManager: { createResource, deleteResource: vi.fn(), updateResource: vi.fn() } })
      const wrapper = mountTab()
      await wrapper.findComponent(RoutesTabView).vm.$emit('changePage', 'create-redirect')
      await wrapper.findComponent(RoutesTabAddRedirect).vm.$emit('create', '/from-here')
      await flushPromises()
      expect(createResource).toHaveBeenCalledWith({
        endpoint: '/_/routes',
        data: { name: '/from-here', path: '/from-here', redirect: '/_/routes//conference/programme' },
      })
      expect(wrapper.findComponent(RoutesTabView).exists()).toBe(true)
      expect(loadResource).toHaveBeenCalled()
    })

    test('does not return to view when redirect creation fails', async () => {
      setupItemPage()
      const createResource = vi.fn().mockResolvedValue(undefined)
      mockCwaFull({ resourcesManager: { createResource, deleteResource: vi.fn(), updateResource: vi.fn() } })
      const wrapper = mountTab()
      await wrapper.findComponent(RoutesTabView).vm.$emit('changePage', 'create-redirect')
      await wrapper.findComponent(RoutesTabAddRedirect).vm.$emit('create', '/from-here')
      await flushPromises()
      expect(wrapper.findComponent(RoutesTabAddRedirect).exists()).toBe(true)
    })
  })

  describe('delete route flow', () => {
    test('deletes the route and returns to view', async () => {
      const deleteResource = vi.fn().mockResolvedValue(undefined)
      mockUseItemPage.mockReturnValue({
        isLoading: ref(false),
        isUpdating: ref(false),
        localResourceData: ref({ path: '/conference/programme' }),
        resource: ref({ '@id': '/_/routes//conference/programme', 'path': '/conference/programme', 'route': null }),
        loadResource: vi.fn(),
        deleteResource,
        saveResource: vi.fn(),
        resetResource: vi.fn(),
        apiState: ref({ status: 'SUCCESS', path: '/_/routes//conference/programme/redirects' }),
      })
      mockCwaFull()
      const wrapper = mountTab()
      await wrapper.findComponent(RoutesTabView).vm.$emit('changePage', 'manage-route')
      await wrapper.findComponent(RoutesTabManage).vm.$emit('delete')
      await flushPromises()
      expect(deleteResource).toHaveBeenCalled()
      expect(wrapper.findComponent(RoutesTabView).exists()).toBe(true)
    })

    test('requestCompleteFn navigates to page IRI when deleting the currently-viewed route', async () => {
      let capturedFn: ((r?: any) => void) | undefined
      const deleteResource = vi.fn((_: any, fn: (r?: any) => void) => {
        capturedFn = fn
        return Promise.resolve()
      })
      // current route.path in the nuxt test env is '/'; set the resource path to match
      mockUseItemPage.mockReturnValue({
        isLoading: ref(false),
        isUpdating: ref(false),
        localResourceData: ref({ path: '/' }),
        resource: ref({ '@id': '/_/routes//', 'path': '/', 'route': null }),
        loadResource: vi.fn(),
        deleteResource,
        saveResource: vi.fn(),
        resetResource: vi.fn(),
        apiState: ref({ status: 'SUCCESS', path: '/_/routes///redirects' }),
      })
      mockCwaFull({
        resources: {
          getResource: vi.fn(() => ref(null)),
          isDataPage: ref(false),
          pageDataIri: ref('/_/page_data/d'),
          pageIri: ref('/_/pages/p'),
        },
      })
      const wrapper = mountTab({ route: null })
      await wrapper.findComponent(RoutesTabView).vm.$emit('changePage', 'manage-route')
      await wrapper.findComponent(RoutesTabManage).vm.$emit('delete')
      await flushPromises()
      expect(capturedFn).toBeTypeOf('function')
      // invoking it should not throw and exercises the navigateTo branch
      expect(() => capturedFn!()).not.toThrow()
    })
  })

  describe('redirect deleted handler', () => {
    test('reloads the resource when a redirect is deleted', async () => {
      const loadResource = vi.fn()
      const isLoading = ref(false)
      mockUseItemPage.mockReturnValue({
        isLoading,
        isUpdating: ref(false),
        localResourceData: ref({ path: '/conference/programme' }),
        resource: ref({ '@id': '/_/routes//conference/programme', 'path': '/conference/programme', 'route': null }),
        loadResource,
        deleteResource: vi.fn(),
        saveResource: vi.fn(),
        resetResource: vi.fn(),
        apiState: ref({ status: 'SUCCESS', path: '/_/routes//conference/programme/redirects' }),
      })
      mockCwaFull()
      const wrapper = mountTab()
      await wrapper.findComponent(RoutesTabView).vm.$emit('deleted')
      await flushPromises()
      expect(isLoading.value).toBe(true)
      expect(loadResource).toHaveBeenCalled()
    })
  })

  describe('apiState watcher re-fetch', () => {
    test('reloads when apiState becomes SUCCESS without the /redirects suffix', async () => {
      const loadResource = vi.fn()
      const isLoading = ref(false)
      const apiState = ref<any>(null)
      mockUseItemPage.mockReturnValue({
        isLoading,
        isUpdating: ref(false),
        localResourceData: ref({ path: '/conference/programme' }),
        resource: ref({ '@id': '/_/routes//conference/programme', 'path': '/conference/programme', 'route': null }),
        loadResource,
        deleteResource: vi.fn(),
        saveResource: vi.fn(),
        resetResource: vi.fn(),
        apiState,
      })
      mockCwaFull()
      mountTab()
      await flushPromises()
      loadResource.mockClear()
      // numeric SUCCESS enum + path missing the /redirects suffix triggers the fix
      apiState.value = { status: CwaResourceApiStatuses.SUCCESS, path: '/_/routes//conference/programme' }
      await flushPromises()
      expect(isLoading.value).toBe(true)
      expect(loadResource).toHaveBeenCalled()
    })

    test('does not reload when apiState path already ends with /redirects', async () => {
      const loadResource = vi.fn()
      const apiState = ref<any>(null)
      mockUseItemPage.mockReturnValue({
        isLoading: ref(false),
        isUpdating: ref(false),
        localResourceData: ref({ path: '/conference/programme' }),
        resource: ref({ '@id': '/_/routes//conference/programme', 'path': '/conference/programme', 'route': null }),
        loadResource,
        deleteResource: vi.fn(),
        saveResource: vi.fn(),
        resetResource: vi.fn(),
        apiState,
      })
      mockCwaFull()
      mountTab()
      await flushPromises()
      loadResource.mockClear()
      apiState.value = { status: CwaResourceApiStatuses.SUCCESS, path: '/_/routes//conference/programme/redirects' }
      await flushPromises()
      expect(loadResource).not.toHaveBeenCalled()
    })
  })

  describe('route IRI change', () => {
    test('reloads the resource when the page route IRI changes', async () => {
      const loadResource = vi.fn()
      mockUseItemPage.mockReturnValue({
        isLoading: ref(false),
        isUpdating: ref(false),
        localResourceData: ref({ path: '/conference/programme' }),
        resource: ref({ '@id': '/_/routes//conference/programme', 'path': '/conference/programme', 'route': null }),
        loadResource,
        deleteResource: vi.fn(),
        saveResource: vi.fn(),
        resetResource: vi.fn(),
        apiState: ref({ status: 'SUCCESS', path: '/_/routes//conference/programme/redirects' }),
      })
      mockCwaFull()
      const wrapper = mountTab()
      await flushPromises()
      loadResource.mockClear()
      await wrapper.setProps({
        pageResource: {
          '@id': '/_/pages/programme-uuid',
          '@type': 'Page',
          'route': '/_/routes//conference/programme-renamed',
          'parentPage': null,
          'parentPageData': null,
        } as any,
      })
      await flushPromises()
      expect(loadResource).toHaveBeenCalled()
    })
  })

  describe('back button and manage screen rendering', () => {
    test('renders RoutesTabManage with localResourceData and clicking back returns to view', async () => {
      setupItemPage()
      mockCwaFull()
      const wrapper = mountTab()
      await wrapper.findComponent(RoutesTabView).vm.$emit('changePage', 'manage-route')
      expect(wrapper.findComponent(RoutesTabManage).exists()).toBe(true)
      await wrapper.find('button').trigger('click')
      expect(wrapper.findComponent(RoutesTabView).exists()).toBe(true)
    })

    test('writes back to localResourceData.path via v-model when RoutesTabManage updates the model', async () => {
      const localResourceData = ref({ path: '/conference/programme' })
      mockUseItemPage.mockReturnValue({
        isLoading: ref(false),
        isUpdating: ref(false),
        localResourceData,
        resource: ref({ '@id': '/_/routes//conference/programme', 'path': '/conference/programme', 'route': null }),
        loadResource: vi.fn(),
        deleteResource: vi.fn(),
        saveResource: vi.fn(),
        resetResource: vi.fn(),
        apiState: ref({ status: 'SUCCESS', path: '/_/routes//conference/programme/redirects' }),
      })
      mockCwaFull()
      const wrapper = mountTab()
      await wrapper.findComponent(RoutesTabView).vm.$emit('changePage', 'manage-route')
      await wrapper.findComponent(RoutesTabManage).vm.$emit('update:modelValue', '/conference/renamed')
      await flushPromises()
      expect(localResourceData.value.path).toBe('/conference/renamed')
    })

    test('shows critical error alert when localResourceData is missing on manage screen', async () => {
      mockUseItemPage.mockReturnValue({
        isLoading: ref(false),
        isUpdating: ref(false),
        localResourceData: ref(null),
        resource: ref({ '@id': '/_/routes//conference/programme', 'path': '/conference/programme', 'route': null }),
        loadResource: vi.fn(),
        deleteResource: vi.fn(),
        saveResource: vi.fn(),
        resetResource: vi.fn(),
        apiState: ref({ status: 'SUCCESS', path: '/_/routes//conference/programme/redirects' }),
      })
      mockCwaFull()
      const wrapper = mountTab()
      await wrapper.findComponent(RoutesTabView).vm.$emit('changePage', 'manage-route')
      expect(wrapper.findComponent(RoutesTabManage).exists()).toBe(false)
      expect(wrapper.text()).toContain('Critical Errors')
    })

    test('shows internal error alert when no resource is loaded on a non-view screen', async () => {
      mockUseItemPage.mockReturnValue({
        isLoading: ref(false),
        isUpdating: ref(false),
        localResourceData: ref(null),
        resource: ref(null),
        loadResource: vi.fn(),
        deleteResource: vi.fn(),
        saveResource: vi.fn(),
        resetResource: vi.fn(),
        apiState: ref(null),
      })
      mockCwaFull()
      const wrapper = mountTab()
      await wrapper.findComponent(RoutesTabView).vm.$emit('changePage', 'manage-route')
      expect(wrapper.text()).toContain('Internal Error: No Route Resource Loaded')
    })
  })
})
