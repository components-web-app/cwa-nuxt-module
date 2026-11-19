// @vitest-environment nuxt
import { describe, test, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ListRow from '#cwa/templates/components/core/admin/ListRow.vue'
import LayoutsListPage from './layouts.vue'

const cwaConfig = vi.hoisted(() => ({
  resourcesConfig: {} as Record<string, any>,
  uiConfig: {} as Record<string, any>,
  layoutsConfig: {} as Record<string, any>,
  pagesConfig: {} as Record<string, any>,
}))
vi.mock('#build/cwa-config', () => cwaConfig)

vi.mock('#cwa-layer/_composables/useListPage', () => ({
  useListPage: () => ({ goToAdd: vi.fn(), triggerReload: vi.fn(), computedItemLink: vi.fn(() => '/_cwa/layouts/x') }),
}))

function setup(uiComponent: string) {
  cwaConfig.layoutsConfig = {
    Primary: { name: 'Primary Layout' },
  }
  const item = { '@id': '/_/layouts/1', 'reference': 'Main', uiComponent }
  return mount(LayoutsListPage, {
    shallow: true,
    global: {
      stubs: {
        ListContent: {
          name: 'ListContent',
          props: ['fetchUrl', 'searchFields', 'columns'],
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
    expect(wrapper.findComponent(ListRow).props('sub')).toBe('UI: Primary Layout')
  })

  test('a layout row offers Edit only, as a layout has no page of its own to view', () => {
    const wrapper = setup('CwaLayoutPrimary')

    expect(wrapper.findComponent(ListRow).props()).toMatchObject({ actions: true, to: '/_cwa/layouts/x', view: undefined })
    expect(wrapper.findComponent({ name: 'ListContent' }).props('columns').at(-1)).toMatchObject({ label: 'Actions', labelHidden: true })
  })

  test('falls back to the name without CwaLayout when the layout UI is not configured', () => {
    const wrapper = setup('CwaLayoutSecondary')
    expect(wrapper.findComponent(ListRow).props('sub')).toBe('UI: Secondary')
  })
})
