// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ListFilter from './ListFilter.vue'

// eslint-disable-next-line no-var
var mockRoute: { query: Record<string, any> }
const routerReplace = vi.fn()
vi.mock('vue-router', async () => {
  const { reactive } = await import('vue')
  mockRoute = reactive({ query: {} as Record<string, any> })
  const mod = await vi.importActual<typeof import('vue-router')>('vue-router')
  return { ...mod, useRoute: () => mockRoute, useRouter: () => ({ replace: routerReplace }) }
})

const ListContainerStub = { template: '<div><slot /></div>' }
const FilterFormWrapperStub = {
  name: 'FilterFormWrapper',
  props: ['label', 'inputId'],
  template: '<div><slot /></div>',
}
const FilterSelectStub = {
  name: 'FilterSelect',
  props: ['modelValue', 'options'],
  emits: ['update:modelValue'],
  template: '<div class="filter-select-stub" />',
}
const CwaUiIconSearchIconStub = { name: 'CwaUiIconSearchIcon', template: '<svg />' }

const orderOptions = [
  { label: 'New - Old', value: { createdAt: 'desc' } },
  { label: 'A - Z', value: { reference: 'asc' } },
]

function mountComponent() {
  return mount(ListFilter, {
    props: { orderOptions },
    global: {
      stubs: {
        ListContainer: ListContainerStub,
        FilterFormWrapper: FilterFormWrapperStub,
        FilterSelect: FilterSelectStub,
        CwaUiIconSearchIcon: CwaUiIconSearchIconStub,
      },
    },
  })
}

describe('ListFilter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRoute.query = {}
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('typing a search value puts only the search parameter in the browser url', async () => {
    const wrapper = mountComponent()
    await wrapper.find('#search-input').setValue('my search')
    vi.advanceTimersByTime(250)
    await flushPromises()
    expect(routerReplace).toHaveBeenCalledWith({ query: { search: 'my search' } })
  })

  test('a search value already in the url is shown in the input', async () => {
    mockRoute.query = { search: 'from the url' }
    const wrapper = mountComponent()
    await flushPromises()
    expect((wrapper.find('#search-input').element as HTMLInputElement).value).toBe('from the url')
  })

  test('changing the sort keeps the search parameter in the browser url', async () => {
    mockRoute.query = { search: 'my search' }
    const wrapper = mountComponent()
    await flushPromises()
    wrapper.findComponent(FilterSelectStub).vm.$emit('update:modelValue', { reference: 'asc' })
    await flushPromises()
    vi.advanceTimersByTime(250)
    await flushPromises()
    expect(routerReplace).toHaveBeenCalledWith({ query: { 'search': 'my search', 'order[reference]': 'asc' } })
  })
})
