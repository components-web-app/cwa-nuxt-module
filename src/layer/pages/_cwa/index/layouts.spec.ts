// @vitest-environment nuxt
import { describe, test, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import LayoutsListPage from './layouts.vue'

const { mockUseCwa } = vi.hoisted(() => ({
  mockUseCwa: vi.fn(),
}))

vi.mock('#cwa-layer/_composables/useListPage', () => ({
  useListPage: () => ({ goToAdd: vi.fn(), triggerReload: vi.fn(), computedItemLink: vi.fn(() => '/_cwa/layouts/x') }),
}))

mockNuxtImport('useCwa', () => mockUseCwa)

function setup(uiComponent: string) {
  mockUseCwa.mockReturnValue({
    layoutsConfig: {
      Primary: { name: 'Primary Layout' },
    },
  })
  const item = { '@id': '/_/layouts/1', 'reference': 'Main', uiComponent }
  return mount(LayoutsListPage, {
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

describe('/_cwa/layouts layout UI label', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('shows the configured layout UI name for a layout\'s full CwaLayout name', () => {
    const wrapper = setup('CwaLayoutPrimary')
    expect(mockUseCwa).toHaveBeenCalled()
    expect(wrapper.text()).toContain('UI: Primary Layout')
  })

  test('falls back to the name without CwaLayout when the layout UI is not configured', () => {
    const wrapper = setup('CwaLayoutSecondary')
    expect(wrapper.text()).toContain('UI: Secondary')
    expect(wrapper.text()).not.toContain('CwaLayoutSecondary')
  })
})
