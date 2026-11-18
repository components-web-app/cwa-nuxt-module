// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { axe } from '../../../../../test/utils/axe'
import ResourceSearch from './ResourceSearch.vue'
import { announceKey } from '../core/ui/field-keys'

vi.mock('#cwa/composables/cwa', () => ({
  useCwa: () => ({ resources: { getResource: () => ({ value: undefined }) } }),
}))

enableAutoUnmount(afterEach)

const page = (n: number) => ({ '@id': `/_/routes/${n}`, '@type': 'Route', 'path': `/page-${n}` })
const many = Array.from({ length: 20 }, (_, i) => page(i + 1))

function mountSearch(props: Record<string, unknown> = {}, said: string[] = []) {
  return mount(ResourceSearch, {
    props: { label: 'Page', endpoint: '/_/routes', modelValue: null, labelOf: (r: any) => r.path, ...props },
    global: { provide: { [announceKey as symbol]: (message: string) => said.push(message) } },
    attachTo: document.body,
  })
}

async function open(wrapper: ReturnType<typeof mountSearch>) {
  await wrapper.get('[data-testid="search-input"]').trigger('click')
  await flushPromises()
}

function menu() {
  return document.querySelector<HTMLElement>('[data-testid="search-menu"]')!
}

describe('CwaUiResourceSearch (#460)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('the first open shows five shimmering skeleton rows and says it is loading once', async () => {
    const said: string[] = []
    const wrapper = mountSearch({ load: () => new Promise(() => {}) }, said)
    await open(wrapper)

    expect(menu().querySelectorAll('[data-testid="search-skeleton"]')).toHaveLength(5)
    expect(menu().querySelector('.cwa\\:skeleton')).not.toBeNull()
    expect(menu().textContent).not.toContain('Still loading')
    expect(said).toEqual(['Loading pages'])

    vi.advanceTimersByTime(5000)
    await flushPromises()
    expect(menu().textContent).toContain('Still loading…')
  })

  test('results show 20 at a time with the total, Show more fetches the next page, and the count is announced once settled', async () => {
    const said: string[] = []
    const load = vi.fn(async (_term: string, pageNumber: number) => ({ items: pageNumber === 1 ? many : [page(21)], total: 21 }))
    const wrapper = mountSearch({ load }, said)
    await open(wrapper)

    expect(menu().querySelectorAll('[role="option"]')).toHaveLength(21)
    expect(menu().querySelector('[data-testid="search-count"]')!.textContent).toContain('Showing 20 of 21. Keep typing to narrow it down.')
    expect(said.at(-1)).toBe('20 of 21 pages')

    const more = [...menu().querySelectorAll<HTMLElement>('[role="option"]')].find(option => option.textContent!.includes('Show 1 more'))!
    more.click()
    await flushPromises()

    expect(load).toHaveBeenLastCalledWith('', 2)
    expect(menu().querySelector('[data-testid="search-count"]')).toBeNull()
  })

  test('typing searches 250ms after the last key, and an answer that is not the latest is ignored', async () => {
    let answer!: (value: { items: any[], total: number }) => void
    const load = vi.fn().mockResolvedValueOnce({ items: many.slice(0, 3), total: 3 })
      .mockImplementationOnce(() => new Promise((resolve) => {
        answer = resolve
      }))
      .mockResolvedValueOnce({ items: [page(9)], total: 1 })
    const wrapper = mountSearch({ load })
    await open(wrapper)
    const input = wrapper.get('[data-testid="search-input"]')

    await input.setValue('pa')
    vi.advanceTimersByTime(249)
    expect(load).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    await flushPromises()
    expect(load).toHaveBeenLastCalledWith('pa', 1)
    expect(menu().querySelector('[data-testid="search-searching"]')!.textContent).toContain('Searching…')

    await input.setValue('page-9')
    vi.advanceTimersByTime(250)
    await flushPromises()
    answer({ items: many, total: 20 })
    await flushPromises()

    expect([...menu().querySelectorAll('[role="option"]')].map(option => option.textContent!.trim())).toEqual(['/page-9'])
  })

  test('no matches says so', async () => {
    const wrapper = mountSearch({ load: async (term: string) => ({ items: term ? [] : many.slice(0, 2), total: term ? 0 : 2 }) })
    await open(wrapper)
    await wrapper.get('[data-testid="search-input"]').setValue('abc')
    vi.advanceTimersByTime(250)
    await flushPromises()

    expect(menu().querySelector('[data-testid="search-empty"]')!.textContent).toContain('No pages match “abc”.')
  })

  test('a failed search keeps the previous results and offers Retry', async () => {
    const load = vi.fn().mockResolvedValueOnce({ items: many.slice(0, 2), total: 2 }).mockRejectedValueOnce(new Error('500')).mockResolvedValueOnce({ items: [page(5)], total: 1 })
    const wrapper = mountSearch({ load })
    await open(wrapper)
    await wrapper.get('[data-testid="search-input"]').setValue('x')
    vi.advanceTimersByTime(250)
    await flushPromises()

    expect(menu().querySelector('[data-testid="search-failure"]')!.textContent).toContain('The server couldn’t search just now.')
    expect(menu().textContent).toContain('/page-1')
    const retry = [...menu().querySelectorAll<HTMLElement>('[role="option"]')].find(option => option.textContent!.trim() === 'Retry')!
    retry.click()
    await flushPromises()
    expect(load).toHaveBeenLastCalledWith('x', 1)
  })

  test('picking a result emits its IRI and shows its label in the field', async () => {
    const wrapper = mountSearch({ load: async () => ({ items: many.slice(0, 3), total: 3 }) })
    await open(wrapper)
    const second = [...menu().querySelectorAll<HTMLElement>('[role="option"]')][1]!
    second.click()
    await flushPromises()

    expect(wrapper.emitted('update:modelValue')).toEqual([['/_/routes/2']])
    await wrapper.setProps({ modelValue: '/_/routes/2' })
    expect((wrapper.get('[data-testid="search-input"]').element as HTMLInputElement).value).toBe('/page-2')
  })

  test('a chosen value not in the results has its label read on its own, with a skeleton meanwhile', async () => {
    let found!: (resource: any) => void
    const wrapper = mountSearch({ modelValue: '/_/routes/77', resolve: () => new Promise((resolve) => {
      found = resolve
    }) })
    await flushPromises()
    expect(wrapper.find('[data-testid="search-chosen-skeleton"]').exists()).toBe(true)

    found(page(77))
    await flushPromises()
    expect(wrapper.find('[data-testid="search-chosen-skeleton"]').exists()).toBe(false)
    expect((wrapper.get('[data-testid="search-input"]').element as HTMLInputElement).value).toBe('/page-77')
  })

  test('has no axe violations closed, loading and with results', async () => {
    vi.useRealTimers()
    const wrapper = mountSearch({ load: async () => ({ items: many.slice(0, 3), total: 3 }) })
    expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()

    await open(wrapper)
    expect(await axe(menu())).toHaveNoViolations()
  })
})
