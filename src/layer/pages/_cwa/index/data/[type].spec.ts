// @vitest-environment nuxt
import { describe, test, expect, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import DataTypeListPage from './[type].vue'
import ListFilter from '#cwa/templates/components/core/admin/ListFilter.vue'

const { mockGetApiDocumentation } = vi.hoisted(() => ({
  mockGetApiDocumentation: vi.fn(),
}))

vi.mock('#cwa-layer/_composables/useDataType', () => ({
  useDataType: () => ({ pageDataClassName: ref('Events'), dataTypeClassName: ref('EventData'), pageDataConfig: ref({ name: 'Events' }), dataType: ref('event_data') }),
}))
vi.mock('#cwa-layer/_composables/useListPage', () => ({
  useListPage: () => ({ goToAdd: vi.fn(), triggerReload: vi.fn(), computedItemLink: vi.fn(() => '/_cwa/data/event_data/x') }),
}))
vi.mock('#cwa-layer/_composables/useDynamicPageLoader', () => ({
  useDynamicPageLoader: () => ({ dynamicPages: ref([]), loadDynamicPageOptions: vi.fn() }),
}))
vi.mock('#cwa-layer/_composables/useDataList', () => ({ useDataList: vi.fn() }))

mockNuxtImport('useCwa', () => () => ({ getApiDocumentation: mockGetApiDocumentation }))
mockNuxtImport('useCwaResourceRoute', () => () => ({ getInternalResourceLink: vi.fn() }))

async function setup(item: Record<string, any>) {
  mockGetApiDocumentation.mockResolvedValue({ entrypoint: { event_data: '/event_data' } })
  const wrapper = mount(DataTypeListPage, {
    shallow: true,
    global: {
      stubs: {
        ListContent: {
          name: 'ListContent',
          props: ['fetchUrl', 'searchFields'],
          setup: () => ({ item }),
          template: '<div><slot name="item" :data="item" /></div>',
        },
        ListRow: false,
        ListCell: false,
        PageListStatus: false,
      },
    },
  })
  await flushPromises()
  return wrapper
}

function status(wrapper: Awaited<ReturnType<typeof setup>>) {
  return wrapper.findAll('[role="cell"]')[1]!.text()
}

describe('/_cwa/data/[type]', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('a page data with a route shows a loading badge until its route is read', async () => {
    const wrapper = await setup({ '@id': '/event_data/1', 'title': 'Routed', 'route': '/_/routes/r', 'isReachableWithoutRoute': false })
    expect(status(wrapper)).toBe('Loading status')
    expect(wrapper.find('[data-testid="page-status-no-route"]').exists()).toBe(false)
  })

  test('a routeless page data public without a route says so, as it is publicly loadable', async () => {
    const wrapper = await setup({ '@id': '/event_data/1', 'title': 'Flagged', 'route': null, 'isReachableWithoutRoute': true })
    expect(wrapper.find('[data-testid="page-status-public"]').exists()).toBe(true)
    expect(status(wrapper)).toBe('Public without a route')
  })

  test('a routeless page data not flagged says it has no route', async () => {
    const wrapper = await setup({ '@id': '/event_data/1', 'title': 'Private', 'route': null, 'isReachableWithoutRoute': false })
    expect(wrapper.find('[data-testid="page-status-no-route"]').exists()).toBe(true)
    expect(status(wrapper)).toBe('No route')
  })

  test('the create button is named by one item of the type, never the list\'s plural title (#461)', async () => {
    const wrapper = await setup({ '@id': '/event_data/1', 'title': 'Private', 'route': null })
    expect(wrapper.findComponent(ListFilter).props('createNoun')).toBe('event')
    expect(wrapper.findComponent(ListFilter).props('searchLabel')).toBe('Search events')
  })
})
