// @vitest-environment nuxt
import { describe, test, expect, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import PagesListPage from './pages.vue'

const { mockUseCwa } = vi.hoisted(() => ({
  mockUseCwa: vi.fn(),
}))

vi.mock('#cwa-layer/_composables/useListPage', () => ({
  useListPage: () => ({ goToAdd: vi.fn(), triggerReload: vi.fn(), computedItemLink: vi.fn(() => '/_cwa/pages/x') }),
}))
vi.mock('#cwa/composables/cwa-query-bound-model', () => ({
  useQueryBoundModel: () => ({ model: ref(['true', 'false']) }),
}))

mockNuxtImport('useCwa', () => mockUseCwa)
mockNuxtImport('useCwaResourceRoute', () => () => ({ getInternalResourceLink: vi.fn() }))

function setup(uiComponent: string) {
  mockUseCwa.mockReturnValue({
    pagesConfig: {
      PrimaryPageTemplate: { name: 'Primary Page' },
    },
  })
  const item = { '@id': '/_/pages/1', 'reference': 'Home', 'isTemplate': false, uiComponent }
  return mount(PagesListPage, {
    shallow: true,
    global: {
      stubs: {
        ListContent: {
          name: 'ListContent',
          props: ['fetchUrl', 'searchFields'],
          setup: () => ({ item }),
          template: '<div><slot name="item" :data="item" /></div>',
        },
      },
    },
  })
}

describe('/_cwa/pages page UI label', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('shows the configured page UI name for a page stored with the full CwaPage name', () => {
    const wrapper = setup('CwaPagePrimaryPageTemplate')
    expect(mockUseCwa).toHaveBeenCalled()
    expect(wrapper.text()).toContain('UI: Primary Page')
  })

  test('shows the configured page UI name for a page still stored short', () => {
    const wrapper = setup('PrimaryPageTemplate')
    expect(wrapper.text()).toContain('UI: Primary Page')
  })

  test('falls back to the name without CwaPage when the page UI is not configured', () => {
    const wrapper = setup('CwaPageNestedSubPageTemplate')
    expect(wrapper.text()).toContain('UI: NestedSubPageTemplate')
    expect(wrapper.text()).not.toContain('CwaPageNestedSubPageTemplate')
  })
})
