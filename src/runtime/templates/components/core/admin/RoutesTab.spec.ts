// @vitest-environment nuxt
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import RoutesTab from './RoutesTab.vue'
import * as cwaComposable from '#cwa/composables/cwa'

const { mockUseItemPage } = vi.hoisted(() => ({
  mockUseItemPage: vi.fn(),
}))

vi.mock('#cwa-layer/pages/_cwa/index/composables/useItemPage', () => ({ useItemPage: mockUseItemPage }))

function mockCwa(getResourceImpl: (iri: string) => any = () => ref(null)) {
  // @ts-expect-error
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    resources: { getResource: vi.fn(getResourceImpl) },
    resourcesManager: { createResource: vi.fn(), deleteResource: vi.fn() },
  }))
}

function setupItemPage() {
  mockUseItemPage.mockReturnValue({
    isLoading: ref(false),
    isUpdating: ref(false),
    localResourceData: ref({ path: '/conference/programme' }),
    resource: ref({ '@id': '/_/routes//conference/programme', 'path': '/conference/programme', 'route': null }),
    loadResource: vi.fn(),
    deleteResource: vi.fn(),
    saveResource: vi.fn(),
    resetResource: vi.fn(),
    apiState: ref({ status: 'SUCCESS', path: '/_/routes//conference/programme/redirects' }),
  })
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
})
