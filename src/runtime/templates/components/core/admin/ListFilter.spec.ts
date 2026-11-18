// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import ListFilter from './ListFilter.vue'
import Select from '#cwa/templates/components/ui/Select.vue'
import { axe } from '../../../../../../test/utils/axe'

// eslint-disable-next-line no-var
var mockRoute: { query: Record<string, any> }
const routerReplace = vi.fn()
vi.mock('vue-router', async () => {
  const { reactive } = await import('vue')
  mockRoute = reactive({ query: {} as Record<string, any> })
  const mod = await vi.importActual<typeof import('vue-router')>('vue-router')
  return { ...mod, useRoute: () => mockRoute, useRouter: () => ({ replace: routerReplace }) }
})

enableAutoUnmount(afterEach)

const orderOptions = [
  { label: 'Newest first', value: { createdAt: 'desc' } },
  { label: 'A to Z', value: { reference: 'asc' } },
]

function mountComponent(props: Record<string, unknown> = {}, slots: Record<string, string> = {}) {
  return mount(ListFilter, {
    props: { orderOptions, searchLabel: 'Search pages', ...props },
    slots,
    attachTo: document.body,
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
    await wrapper.get('input[type="search"]').setValue('my search')
    vi.advanceTimersByTime(250)
    await flushPromises()
    expect(routerReplace).toHaveBeenCalledWith({ query: { search: 'my search' } })
  })

  test('a search value already in the url is shown in the input', async () => {
    mockRoute.query = { search: 'from the url' }
    const wrapper = mountComponent()
    await flushPromises()
    expect((wrapper.get('input[type="search"]').element as HTMLInputElement).value).toBe('from the url')
  })

  test('changing the sort keeps the search parameter in the browser url', async () => {
    mockRoute.query = { search: 'my search' }
    const wrapper = mountComponent()
    await flushPromises()
    wrapper.findComponent(Select).vm.$emit('update:modelValue', '1')
    await flushPromises()
    vi.advanceTimersByTime(250)
    await flushPromises()
    expect(routerReplace).toHaveBeenCalledWith({ query: { 'search': 'my search', 'order[reference]': 'asc' } })
  })

  describe('the kit toolbar (#461)', () => {
    test('the search field is named by the list it searches', () => {
      expect(mountComponent().get('input[type="search"]').attributes('aria-label')).toBe('Search pages')
    })

    test('the sort is a select of the list\'s orders, showing the one in the url', async () => {
      mockRoute.query = { 'order[reference]': 'asc' }
      const select = mountComponent().findComponent(Select)
      await flushPromises()

      expect(select.props('label')).toBe('Sort')
      expect(select.props('options')).toEqual([{ label: 'Newest first', value: '0' }, { label: 'A to Z', value: '1' }])
      expect(select.props('modelValue')).toBe('1')
    })

    test('with no order in the url the sort shows the first order', () => {
      expect(mountComponent().findComponent(Select).props('modelValue')).toBe('0')
    })

    test('"+ Page" is named Create page and asks its page to add one', async () => {
      const wrapper = mountComponent({ createNoun: 'page' })
      const create = wrapper.get('[data-testid="list-create"]')

      expect(create.text()).toBe('Page')
      expect(create.attributes('aria-label')).toBe('Create page')
      await create.trigger('click')
      expect(wrapper.emitted('add')).toHaveLength(1)
    })

    test('a list with nothing to create has no create button', () => {
      expect(mountComponent().find('[data-testid="list-create"]').exists()).toBe(false)
    })

    test('shows the count it is given and the filters its page puts in', () => {
      const wrapper = mountComponent({ count: '143 pages' }, { filters: '<button type="button" class="filter-stub">Static</button>' })

      expect(wrapper.get('[data-testid="list-count"]').text()).toBe('143 pages')
      expect(wrapper.find('.filter-stub').exists()).toBe(true)
    })

    test('has no axe violations', async () => {
      vi.useRealTimers()
      mountComponent({ count: '143 pages', createNoun: 'page' })

      expect(await axe(document.body)).toHaveNoViolations()
    })
  })
})
