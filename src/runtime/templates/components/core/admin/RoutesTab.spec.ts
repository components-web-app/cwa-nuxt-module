// @vitest-environment nuxt
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import RoutesTab from './RoutesTab.vue'
import RoutesTabView from './RoutesTabView.vue'
import RoutesTabManage from './RoutesTabManage.vue'
import RoutesTabForwardTo from './RoutesTabForwardTo.vue'
import * as cwaComposable from '#cwa/composables/cwa'

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
})
