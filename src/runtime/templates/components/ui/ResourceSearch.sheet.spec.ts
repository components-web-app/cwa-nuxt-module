// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { axe } from '../../../../../test/utils/axe'
import { onPhone, stubVisualViewport } from '../../../../../test/utils/sheet-media'
import ResourceSearch from './ResourceSearch.vue'
import { announceKey } from '../core/ui/field-keys'

vi.mock('#cwa/composables/cwa', () => ({
  useCwa: () => ({ resources: { getResource: () => ({ value: undefined }) }, fetch: vi.fn() }),
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

async function tapOpen(props: Record<string, unknown> = {}, said: string[] = []) {
  const wrapper = mountSearch(props, said)
  const input = wrapper.get<HTMLInputElement>('[data-testid="search-input"]').element
  const mousedown = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
  input.dispatchEvent(mousedown)
  input.click()
  await flushPromises()
  return { wrapper, input, mousedown, sheet: document.querySelector<HTMLElement>('[data-testid="search-sheet"]') }
}

function search() {
  return document.querySelector<HTMLInputElement>('[data-testid="search-sheet-input"]')!
}

function options(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>('[role="option"]')]
}

async function key(target: Element, name: string) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }))
  await flushPromises()
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('CwaUiResourceSearch on a phone (#461)', () => {
  beforeEach(() => onPhone())

  test('a tap opens a 60vh search sheet titled by its label instead of the anchored menu, without focusing the field\'s own input, and loads the first page', async () => {
    const load = vi.fn(async () => ({ items: many, total: 21 }))
    const { sheet, input, mousedown } = await tapOpen({ load })

    expect(document.querySelector('[data-testid="search-menu"]')).toBeNull()
    expect(sheet!.getAttribute('role')).toBe('dialog')
    expect(document.getElementById(sheet!.getAttribute('aria-labelledby')!)!.textContent!.trim()).toBe('Page')
    expect(sheet!.className).toContain('cwa:h-[60vh]')
    expect(mousedown.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(search())
    expect(document.activeElement).not.toBe(input)
    expect(load).toHaveBeenCalledWith('', 1)
    expect(options(sheet!)).toHaveLength(21)
    expect(options(sheet!)[0]!.className).toContain('cwa:min-h-hit')
    expect(sheet!.querySelector('[data-testid="search-count"]')!.textContent).toContain('Showing 20 of 21.')
  })

  test('sits above the on-screen keyboard and inside the visible viewport', async () => {
    vi.stubGlobal('innerHeight', 844)
    const viewport = stubVisualViewport({ height: 844 })
    const { sheet } = await tapOpen({ load: async () => ({ items: many, total: 21 }) })

    viewport.resize({ height: 450 })
    await flushPromises()

    expect(sheet!.style.bottom).toBe('394px')
    expect(sheet!.style.height).toBe('434px')
  })

  test('typing in the sheet searches after 250 ms, and the field is the combobox controlling the sheet', async () => {
    vi.useFakeTimers()
    const load = vi.fn(async (term: string) => ({ items: term ? [page(7)] : many, total: term ? 1 : 21 }))
    const { input, sheet } = await tapOpen({ load })

    search().value = 'page-7'
    search().dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    vi.advanceTimersByTime(250)
    await flushPromises()

    expect(load).toHaveBeenLastCalledWith('page-7', 1)
    expect(options(sheet!).map(option => option.textContent!.trim())).toEqual(['/page-7'])
    expect(input.getAttribute('aria-expanded')).toBe('true')
    expect(document.getElementById(input.getAttribute('aria-controls')!)!.contains(sheet!.querySelector('[role="listbox"]'))).toBe(true)
  })

  test('shows the same states as the menu: the first load\'s skeleton rows, and a failure with Retry as an option', async () => {
    let fail = true
    const load = vi.fn(() => fail ? Promise.reject(new Error('down')) : Promise.resolve({ items: [page(1)], total: 1 }))
    const { sheet } = await tapOpen({ load })

    expect(sheet!.querySelector('[data-testid="search-failure"]')!.textContent).toContain('The server couldn’t search just now.')
    fail = false
    options(sheet!).find(option => option.textContent!.includes('Retry'))!.click()
    await flushPromises()
    expect(load).toHaveBeenCalledTimes(2)
    expect(options(sheet!).map(option => option.textContent!.trim())).toEqual(['/page-1'])
  })

  test('a first load still waiting shows five skeleton rows at the tap height', async () => {
    const { sheet } = await tapOpen({ load: () => new Promise(() => {}) })

    const skeletons = sheet!.querySelectorAll('[data-testid="search-skeleton"]')
    expect(skeletons).toHaveLength(5)
    expect(skeletons[0]!.className).toContain('cwa:h-hit')
  })

  test.each([
    ['a tap', async (option: HTMLElement) => option.click()],
    ['ArrowDown then Enter', async () => {
      await key(search(), 'ArrowDown')
      await key(search(), 'ArrowDown')
      await key(search(), 'Enter')
    }],
  ])('choosing a result with %s emits its IRI, closes the sheet and returns focus to the field\'s toggle', async (_, pick) => {
    const { wrapper, sheet } = await tapOpen({ load: async () => ({ items: [page(1), page(2)], total: 2 }) })

    await pick(options(sheet!)[1]!)
    await flushPromises()

    expect(wrapper.emitted('update:modelValue')).toEqual([['/_/routes/2']])
    expect(document.querySelector('[data-testid="search-sheet"]')).toBeNull()
    expect(document.activeElement).toBe(wrapper.get('[data-testid="search-toggle"]').element)
  })

  test.each([
    ['Apply', () => document.querySelector<HTMLElement>('[data-testid="search-sheet-apply"]')!.click()],
    ['Discard changes', () => document.querySelector<HTMLElement>('[data-testid="search-sheet-discard"]')!.click()],
    ['Escape', () => key(search(), 'Escape')],
    ['a tap on the scrim', async () => {
      await new Promise(resolve => setTimeout(resolve))
      document.querySelector('[data-testid="search-sheet-scrim"]')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    }],
  ])('%s closes it without choosing and clears the search', async (_, close) => {
    const { wrapper, input } = await tapOpen({ load: async () => ({ items: [page(1)], total: 1 }) })
    search().value = 'pa'
    search().dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()

    await close()
    await flushPromises()

    expect(document.querySelector('[data-testid="search-sheet"]')).toBeNull()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(input.getAttribute('aria-expanded')).toBe('false')
    expect(input.value).toBe('')
  })

  test('opened from the keyboard, Escape returns focus to the field\'s input', async () => {
    const wrapper = mountSearch({ load: async () => ({ items: [page(1)], total: 1 }) })
    const input = wrapper.get<HTMLInputElement>('[data-testid="search-input"]').element
    input.focus()
    await key(input, 'ArrowDown')
    expect(document.activeElement).toBe(search())

    await key(search(), 'Escape')

    expect(document.activeElement).toBe(input)
  })

  test.each([
    ['loading', () => new Promise(() => {})],
    ['with results', async () => ({ items: many, total: 21 })],
    ['failed', () => Promise.reject(new Error('down'))],
  ])('has no axe violations %s, and with a result highlighted', async (_, load) => {
    await tapOpen({ load })
    expect(await axe(document.body)).toHaveNoViolations()

    await key(search(), 'ArrowDown')
    expect(await axe(document.body)).toHaveNoViolations()
  })
})

describe('CwaUiResourceSearch wider than a phone (#461)', () => {
  beforeEach(() => onPhone(false))

  test('a click opens the anchored menu and leaves the mousedown alone', async () => {
    const { sheet, mousedown } = await tapOpen({ load: async () => ({ items: [page(1)], total: 1 }) })

    expect(sheet).toBeNull()
    expect(mousedown.defaultPrevented).toBe(false)
    expect(document.querySelector('[data-testid="search-menu"]')).not.toBeNull()
  })
})
