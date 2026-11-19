// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { axe } from '../../../../../test/utils/axe'
import { onPhone } from '../../../../../test/utils/sheet-media'
import MultiSelect from './MultiSelect.vue'
import { announceKey } from '../core/ui/field-keys'

enableAutoUnmount(afterEach)

const options = [
  { label: 'Dark background', value: 'dark' },
  { label: 'Extra padding', value: 'padding' },
  { label: 'Wide', value: 'wide' },
  { label: 'Full bleed', value: 'bleed', disabled: true, disabledReason: 'Unavailable inside a narrow column' },
]

function mountMulti(props: Record<string, unknown> = {}, announce = vi.fn()) {
  return mount(MultiSelect, {
    props: { label: 'Style', options, modelValue: ['padding', 'dark'], ...props },
    global: { provide: { [announceKey as symbol]: announce } },
    attachTo: document.body,
  })
}

async function tapOpen(props: Record<string, unknown> = {}) {
  const wrapper = mountMulti(props)
  const input = wrapper.get<HTMLInputElement>('[data-testid="multi-input"]').element
  const mousedown = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
  input.dispatchEvent(mousedown)
  input.click()
  await flushPromises()
  return { wrapper, input, mousedown, sheet: document.querySelector<HTMLElement>('[data-testid="multi-sheet"]') }
}

function labels(root: HTMLElement) {
  return [...root.querySelectorAll('[role="option"]')].map(option => option.textContent!.trim())
}

function option(root: HTMLElement, label: string) {
  return [...root.querySelectorAll<HTMLElement>('[role="option"]')].find(item => item.textContent?.includes(label))!
}

function search() {
  return document.querySelector<HTMLInputElement>('[data-testid="multi-sheet-input"]')!
}

async function key(target: Element, name: string) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }))
  await flushPromises()
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('CwaUiMultiSelect on a phone (#461)', () => {
  beforeEach(() => onPhone())

  test('a tap opens a 60vh search sheet titled by its label, with Done, instead of the anchored menu, without focusing the field\'s own input', async () => {
    const { sheet, input, mousedown } = await tapOpen()

    expect(document.querySelector('[data-testid="multi-menu"]')).toBeNull()
    expect(sheet!.getAttribute('role')).toBe('dialog')
    expect(document.getElementById(sheet!.getAttribute('aria-labelledby')!)!.textContent!.trim()).toBe('Style')
    expect(sheet!.querySelector('[data-testid="multi-sheet-close"]')!.textContent!.trim()).toBe('Done')
    expect(sheet!.className).toContain('cwa:h-[60vh]')
    expect(mousedown.defaultPrevented).toBe(true)
    expect(document.activeElement).not.toBe(input)
  })

  test('typing happens in the sheet: its search is focused, named, and controls the listbox', async () => {
    const { sheet } = await tapOpen()

    expect(document.activeElement).toBe(search())
    expect(search().getAttribute('aria-label')).toBe('Search Style')
    expect(search().getAttribute('role')).toBe('combobox')
    expect(document.getElementById(search().getAttribute('aria-controls')!)!.getAttribute('role')).toBe('listbox')
    expect(sheet!.querySelector('[role="listbox"]')!.getAttribute('aria-multiselectable')).toBe('true')
  })

  test('what was already typed in the field is carried into the sheet\'s search, the caret at its end', async () => {
    const wrapper = mountMulti()
    await wrapper.get('[data-testid="multi-input"]').setValue('wid')
    await flushPromises()

    expect(document.activeElement).toBe(search())
    expect(search().value).toBe('wid')
    expect(search().selectionStart).toBe(3)
    expect(labels(document.querySelector('[data-testid="multi-sheet"]')!)).toEqual(['Wide'])
  })

  test('the field says it is expanded and controls the sheet while it is open', async () => {
    const { input, sheet } = await tapOpen()

    expect(input.getAttribute('aria-expanded')).toBe('true')
    expect(document.getElementById(input.getAttribute('aria-controls')!)!.contains(sheet!.querySelector('[role="listbox"]'))).toBe(true)
  })

  test('lists every option at the full tap height, chosen ones first and checked, a disabled one saying why', async () => {
    const { sheet } = await tapOpen()

    expect(labels(sheet!).slice(0, 2)).toEqual(['Extra padding', 'Dark background'])
    expect(sheet!.querySelectorAll('[role="option"][aria-selected="true"]')).toHaveLength(2)
    expect(option(sheet!, 'Full bleed').textContent).toContain('Unavailable inside a narrow column')
    expect(option(sheet!, 'Wide').className).toContain('cwa:min-h-hit')
  })

  test('shows the chosen options as a strip of chips under the search, each removable', async () => {
    const { wrapper, sheet } = await tapOpen()
    const chips = sheet!.querySelector<HTMLElement>('[data-testid="multi-sheet-chips"]')!

    expect([...chips.querySelectorAll('[data-testid="multi-sheet-chip"]')].map(chip => chip.textContent!.trim())).toEqual(['Extra padding', 'Dark background'])
    chips.querySelector<HTMLElement>('button[aria-label="Remove Dark background"]')!.click()
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([['padding']])
  })

  test('picking an option adds it and keeps the sheet open, so the next pick is one tap away', async () => {
    const { wrapper, sheet } = await tapOpen()

    option(sheet!, 'Wide').click()
    await flushPromises()

    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([['padding', 'dark', 'wide']])
    expect(document.querySelector('[data-testid="multi-sheet"]')).not.toBeNull()
  })

  test('the arrow keys highlight an option from the search and Enter toggles it', async () => {
    const { wrapper } = await tapOpen()

    await key(search(), 'ArrowDown')
    const highlighted = document.getElementById(search().getAttribute('aria-activedescendant')!)!
    expect(highlighted.textContent).toContain('Dark background')
    await key(search(), 'Enter')

    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([['padding']])
  })

  test('Backspace in an empty search marks the last chip, and a second removes it', async () => {
    const { wrapper } = await tapOpen()

    await key(search(), 'Backspace')
    expect(document.querySelector('[data-testid="multi-sheet-chip"]:last-child')!.className).toContain('cwa:outline-accent-fg')
    await key(search(), 'Backspace')
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([['padding']])
  })

  test.each([
    ['Done', () => document.querySelector<HTMLElement>('[data-testid="multi-sheet-close"]')!.click()],
    ['Escape', () => key(search(), 'Escape')],
    ['a tap on the scrim', async () => {
      await new Promise(resolve => setTimeout(resolve))
      document.querySelector('[data-testid="multi-sheet-scrim"]')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    }],
  ])('%s closes it and returns focus to the field\'s toggle, never its input, so no keyboard rises', async (_, close) => {
    const { wrapper, input } = await tapOpen()

    await close()
    await flushPromises()

    expect(document.querySelector('[data-testid="multi-sheet"]')).toBeNull()
    expect(input.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(wrapper.get('[data-testid="multi-toggle"]').element)
  })

  test('opened from the keyboard, closing returns focus to the field\'s input', async () => {
    const wrapper = mountMulti()
    const input = wrapper.get<HTMLInputElement>('[data-testid="multi-input"]').element
    input.focus()
    await key(input, 'ArrowDown')
    expect(document.activeElement).toBe(search())

    await key(search(), 'Escape')

    expect(document.activeElement).toBe(input)
  })

  test('closing clears the sheet\'s search', async () => {
    await tapOpen()
    search().value = 'wid'
    search().dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()

    await key(search(), 'Escape')
    expect(document.querySelector<HTMLInputElement>('[data-testid="multi-input"]')!.value).toBe('')
  })

  test('has no axe violations open, filtered, and with a chip marked', async () => {
    await tapOpen()
    expect(await axe(document.body)).toHaveNoViolations()

    await key(search(), 'ArrowDown')
    expect(await axe(document.body)).toHaveNoViolations()

    await key(search(), 'Backspace')
    expect(await axe(document.body)).toHaveNoViolations()
  })
})

describe('CwaUiMultiSelect wider than a phone (#461)', () => {
  beforeEach(() => onPhone(false))

  test('a click opens the anchored menu and leaves the mousedown alone', async () => {
    const { sheet, mousedown } = await tapOpen()

    expect(sheet).toBeNull()
    expect(mousedown.defaultPrevented).toBe(false)
    expect(document.querySelector('[data-testid="multi-menu"]')).not.toBeNull()
  })
})
