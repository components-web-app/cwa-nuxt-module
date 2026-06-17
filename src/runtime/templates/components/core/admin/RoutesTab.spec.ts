// @vitest-environment nuxt
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import RoutesTab from './RoutesTab.vue'
import RoutesTabView from './RoutesTabView.vue'
import RoutesTabManage from './RoutesTabManage.vue'
import * as cwaComposable from '#cwa/composables/cwa'

const { mockUseItemPage, mockReveal } = vi.hoisted(() => ({
  mockUseItemPage: vi.fn(),
  mockReveal: vi.fn(),
}))

vi.mock('#cwa-layer/pages/_cwa/index/composables/useItemPage', () => ({ useItemPage: mockUseItemPage }))
vi.mock('vuejs-confirm-dialog', () => ({
  createConfirmDialog: vi.fn(() => ({ reveal: mockReveal })),
}))

function mockCwa(getResourceImpl: (iri: string) => any = () => ref(null)) {
  // @ts-expect-error
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    resources: { getResource: vi.fn(getResourceImpl) },
    resourcesManager: { createResource: vi.fn(), deleteResource: vi.fn() },
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
    test('shows the parent route prefix when parentPage is set and parent has a route', () => {
      setupItemPage()
      mockCwa((iri) => {
        if (iri === '/_/pages/conference-uuid') {
          return ref({ data: { route: '/_/routes//conference' } })
        }
        return ref(null)
      })
      const wrapper = mountTab({ parentPage: '/_/pages/conference-uuid' })
      expect(wrapper.text()).toContain('/conference')
    })

    test('shows the parent route prefix when parentPageData is set and parent has a route', () => {
      setupItemPage()
      mockCwa((iri) => {
        if (iri === '/_/abstract_page_data/parent-uuid') {
          return ref({ data: { route: '/_/routes//events' } })
        }
        return ref(null)
      })
      const wrapper = mountTab({ parentPageData: '/_/abstract_page_data/parent-uuid' })
      expect(wrapper.text()).toContain('/events')
    })

    test('does not show a prefix when parentPage and parentPageData are not set', () => {
      setupItemPage()
      mockCwa()
      const wrapper = mountTab({ parentPage: null, parentPageData: null })
      expect(wrapper.find('[data-route-prefix]').exists()).toBe(false)
    })

    test('does not show a prefix when the parent resource has no route', () => {
      setupItemPage()
      mockCwa((iri) => {
        if (iri === '/_/pages/conference-uuid') {
          return ref({ data: { route: null } })
        }
        return ref(null)
      })
      const wrapper = mountTab({ parentPage: '/_/pages/conference-uuid' })
      expect(wrapper.find('[data-route-prefix]').exists()).toBe(false)
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

  describe('RoutesTabManage receives parentRoutePrefix', () => {
    test('passes the parent route path to RoutesTabManage when on manage-route screen', async () => {
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

    test('passes null parentRoutePrefix to RoutesTabManage when no parent', async () => {
      setupItemPage()
      mockCwa()
      const wrapper = mountTab({ parentPage: null, parentPageData: null })
      await wrapper.findComponent(RoutesTabView).vm.$emit('changePage', 'manage-route')
      expect(wrapper.findComponent(RoutesTabManage).props('parentRoutePrefix')).toBeNull()
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
      expect(saveResource).toHaveBeenCalledWith(false, { cascadeChildPaths: true })
    })

    test('saves without cascadeChildPaths when cascade is declined', async () => {
      mockReveal.mockResolvedValue({ isCanceled: true })
      const { saveResource } = setupItemPage({ path: '/conference/new-slug', currentPath: '/conference/programme' })
      mockCwa()
      const wrapper = mountTab()
      await wrapper.findComponent(RoutesTabView).vm.$emit('changePage', 'manage-route')
      await wrapper.findComponent(RoutesTabManage).vm.$emit('save')
      expect(saveResource).toHaveBeenCalledWith(false, undefined)
    })
  })
})
