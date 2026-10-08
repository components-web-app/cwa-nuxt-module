// @vitest-environment nuxt
import { describe, test, expect, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import DataTypeListPage from './[type].vue'

const { mockGetApiDocumentation } = vi.hoisted(() => ({
  mockGetApiDocumentation: vi.fn(),
}))

vi.mock('#cwa-layer/_composables/useDataType', () => ({
  useDataType: () => ({ pageDataClassName: ref('EventData'), dataType: ref('event_data') }),
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
      },
    },
  })
  await flushPromises()
  return wrapper
}

function statusDotClasses(wrapper: Awaited<ReturnType<typeof setup>>) {
  return wrapper.find('span.cwa\\:rounded-full').classes()
}

describe('/_cwa/data/[type]', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('a page data with a route shows the green dot', async () => {
    const wrapper = await setup({ '@id': '/event_data/1', 'title': 'Routed', 'route': '/_/routes/r', 'isReachableWithoutRoute': false })
    expect(statusDotClasses(wrapper)).toContain('cwa:bg-green')
  })

  test('a routeless page data public without a route shows the green dot, as it is publicly loadable', async () => {
    const wrapper = await setup({ '@id': '/event_data/1', 'title': 'Flagged', 'route': null, 'isReachableWithoutRoute': true })
    expect(statusDotClasses(wrapper)).toContain('cwa:bg-green')
    expect(statusDotClasses(wrapper)).not.toContain('cwa:bg-orange')
  })

  test('a routeless page data not flagged shows the orange dot', async () => {
    const wrapper = await setup({ '@id': '/event_data/1', 'title': 'Private', 'route': null, 'isReachableWithoutRoute': false })
    expect(statusDotClasses(wrapper)).toContain('cwa:bg-orange')
    expect(statusDotClasses(wrapper)).not.toContain('cwa:bg-green')
  })
})
