// @vitest-environment nuxt
import { describe, test, expect, vi, afterEach } from 'vitest'
import { computed, ref } from 'vue'
import { mount } from '@vue/test-utils'
import ListRow from '#cwa/templates/components/core/admin/ListRow.vue'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import PagesListPage from './pages.vue'
import FilterToggle from '#cwa/templates/components/core/ui/FilterToggle.vue'

const { mockUseCwa, typesModel, listRoutes } = vi.hoisted(() => ({
  mockUseCwa: vi.fn(),
  typesModel: { value: [] as string[] },
  listRoutes: { routes: {} as Record<string, any>, load: (() => {}) as (...args: any[]) => void, error: undefined as unknown, retry: (() => {}) as () => void },
}))

vi.mock('#cwa-layer/_composables/useListPage', () => ({
  useListPage: () => ({ goToAdd: vi.fn(), triggerReload: vi.fn(), computedItemLink: vi.fn(() => '/_cwa/pages/x') }),
}))
vi.mock('#cwa/composables/cwa-query-bound-model', () => ({
  useQueryBoundModel: (param: string) => {
    expect(param).toBe('isTemplate[]')
    const model = ref(typesModel.value)
    return {
      model: computed({
        get: () => model.value,
        set: (value: string[]) => {
          model.value = value
          typesModel.value = value
        },
      }),
    }
  },
}))
vi.mock('#cwa-layer/_composables/useListRoutes', async () => {
  const { ref } = await import('vue')
  return {
    useListRoutes: () => ({ routes: ref(listRoutes.routes), known: ref(true), error: ref(listRoutes.error), now: ref(new Date()), load: listRoutes.load, retry: listRoutes.retry }),
  }
})

mockNuxtImport('useCwa', () => mockUseCwa)
mockNuxtImport('useCwaResourceRoute', () => () => ({ getInternalResourceLink: vi.fn() }))

function setup(uiComponent: string, stored: Record<string, any> = {}, listed: Record<string, any> = {}) {
  mockUseCwa.mockReturnValue({
    pagesConfig: {
      PrimaryPageTemplate: { name: 'Primary Page' },
    },
  })
  const item = { '@id': '/_/pages/1', 'reference': 'Home', 'isTemplate': false, uiComponent, ...stored }
  const raw = { ...item, ...listed }
  return mount(PagesListPage, {
    shallow: true,
    global: {
      stubs: {
        CwaUiAlert: false,
        CwaUiButton: false,
        ListContent: {
          name: 'ListContent',
          props: ['fetchUrl', 'searchFields', 'columns'],
          setup: () => ({ item, raw }),
          template: '<div><slot name="notice" /><slot name="item" :data="item" :raw-data="raw" /></div>',
        },
        ListFilter: { name: 'ListFilter', template: '<div><slot name="filters" /></div>' },
      },
    },
  })
}

describe('/_cwa/pages page UI label', () => {
  afterEach(() => {
    vi.clearAllMocks()
    typesModel.value = []
    listRoutes.routes = {}
  })

  test('the Status column fits the widest status badge, Inherited scheduled with its date (#461)', () => {
    const status = setup('CwaPagePrimaryPageTemplate').findComponent({ name: 'ListContent' }).props('columns').find((column: { label: string }) => column.label === 'Status')
    expect(status.width).toBe('17.5rem')
  })

  test('shows the configured page UI name for a page stored with the full CwaPage name', () => {
    const wrapper = setup('CwaPagePrimaryPageTemplate')
    expect(mockUseCwa).toHaveBeenCalled()
    expect(wrapper.findComponent(ListRow).props('sub')).toBe('UI: Primary Page')
  })

  test('shows the configured page UI name for a page still stored short', () => {
    const wrapper = setup('PrimaryPageTemplate')
    expect(wrapper.findComponent(ListRow).props('sub')).toBe('UI: Primary Page')
  })

  test('falls back to the name without CwaPage when the page UI is not configured', () => {
    const wrapper = setup('CwaPageNestedSubPageTemplate')
    expect(wrapper.findComponent(ListRow).props('sub')).toBe('UI: NestedSubPageTemplate')
  })
})

describe('/_cwa/pages list (#461)', () => {
  afterEach(() => {
    typesModel.value = []
    listRoutes.routes = {}
    listRoutes.load = () => {}
    listRoutes.error = undefined
    listRoutes.retry = () => {}
  })

  test('a template\'s count comes from the list\'s own answer, never the stored copy, which nothing refreshes when page data is added', () => {
    const wrapper = setup('CwaPagePrimaryPageTemplate', { isTemplate: true, _metadata: { pageDataCount: 0 } }, { _metadata: { pageDataCount: 14 } })

    const statuses = wrapper.findAllComponents({ name: 'PageListStatus' })
    expect(statuses.length).toBeGreaterThan(0)
    statuses.forEach(status => expect(status.props('pageDataCount')).toBe(14))
  })

  test('routes that could not be read mark every status unavailable and offer Retry, which reads them again', async () => {
    const retry = vi.fn()
    listRoutes.retry = retry
    listRoutes.error = new Error('offline')
    const wrapper = setup('CwaPagePrimaryPageTemplate', { route: '/_/routes//home' })

    const statuses = wrapper.findAllComponents({ name: 'PageListStatus' })
    expect(statuses.length).toBeGreaterThan(0)
    statuses.forEach(status => expect(status.props('failed')).toBe(true))
    expect(wrapper.get('[data-testid="list-routes-error"]').text()).toContain('Route statuses couldn\'t be loaded.')
    await wrapper.get('[data-testid="list-routes-retry"]').trigger('click')
    expect(retry).toHaveBeenCalledOnce()
  })

  test('routes that were read show no alert', () => {
    const wrapper = setup('CwaPagePrimaryPageTemplate')

    expect(wrapper.find('[data-testid="list-routes-error"]').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'PageListStatus' }).props('failed')).toBe(false)
  })

  test('a routed page\'s second line is its route path', () => {
    listRoutes.routes = { '/_/pages/1': { path: '/kitchens' } }
    const wrapper = setup('CwaPagePrimaryPageTemplate')
    expect(wrapper.findComponent(ListRow).props('sub')).toBe('/kitchens')
  })

  test('the loaded pages are handed over to read their routes', () => {
    const load = vi.fn()
    listRoutes.load = load
    const wrapper = setup('CwaPagePrimaryPageTemplate')
    wrapper.findComponent({ name: 'ListContent' }).vm.$emit('loaded', [{ '@id': '/_/pages/1' }])
    expect(load).toHaveBeenCalledWith([{ '@id': '/_/pages/1' }])
  })

  test('with neither type pressed every page is listed, and pressing one filters to it', async () => {
    const wrapper = setup('CwaPagePrimaryPageTemplate')
    const [staticToggle, dynamicToggle] = wrapper.findAllComponents(FilterToggle)
    expect(staticToggle!.props('modelValue')).toBe(false)
    expect(dynamicToggle!.props('modelValue')).toBe(false)

    staticToggle!.vm.$emit('update:modelValue', true)
    expect(typesModel.value).toEqual(['false'])
    dynamicToggle!.vm.$emit('update:modelValue', true)
    expect(typesModel.value).toEqual(['false', 'true'])
  })

  test('releasing a pressed type removes only that type', () => {
    typesModel.value = ['false', 'true']
    const wrapper = setup('CwaPagePrimaryPageTemplate')
    wrapper.findAllComponents(FilterToggle)[0]!.vm.$emit('update:modelValue', false)
    expect(typesModel.value).toEqual(['true'])
  })

  test('a template row is marked Dynamic and a page Static', () => {
    const wrapper = setup('CwaPagePrimaryPageTemplate')
    expect(wrapper.findComponent(ListRow).props('type')).toEqual({ label: 'Static', colour: 'static' })
  })
})
