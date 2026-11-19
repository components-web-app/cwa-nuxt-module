// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { axe } from '../../../../../test/utils/axe'
import { onPhone } from '../../../../../test/utils/sheet-media'
import Select from './Select.vue'

enableAutoUnmount(afterEach)

const options = [
  { label: 'Split image', value: 'split' },
  { group: 'More', items: [
    { label: 'Wide', value: 'wide', description: 'Full width' },
    { label: 'Full bleed', value: 'bleed', disabled: true, disabledReason: 'Unavailable inside a narrow column' },
    { label: 'Padded', value: 'padded' },
  ] },
]

function mountSelect(props: Record<string, unknown> = {}) {
  return mount(Select, { props: { label: 'UI', options, modelValue: 'wide', ...props }, attachTo: document.body })
}

async function openSelect(props: Record<string, unknown> = {}) {
  const wrapper = mountSelect(props)
  const trigger = wrapper.get<HTMLElement>('[data-testid="select-trigger"]')
  await trigger.trigger('keydown', { key: 'Enter' })
  await flushPromises()
  return { wrapper, trigger: trigger.element, sheet: document.querySelector<HTMLElement>('[data-testid="select-sheet"]') }
}

function option(root: HTMLElement, label: string) {
  return [...root.querySelectorAll<HTMLElement>('[role="option"]')].find(item => item.textContent?.includes(label))!
}

async function key(target: Element, name: string) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }))
  await flushPromises()
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('CwaUiSelect on a phone (#461)', () => {
  beforeEach(() => onPhone())

  test('opens a bottom sheet titled by its label, with Done, holding the options as a listbox, instead of the anchored menu', async () => {
    const { sheet } = await openSelect()

    expect(document.querySelector('[data-testid="select-menu"]')).toBeNull()
    expect(sheet!.getAttribute('role')).toBe('dialog')
    expect(document.getElementById(sheet!.getAttribute('aria-labelledby')!)!.textContent!.trim()).toBe('UI')
    expect(sheet!.querySelector('[data-testid="select-sheet-close"]')!.textContent!.trim()).toBe('Done')
    const listbox = sheet!.querySelector<HTMLElement>('[role="listbox"]')!
    expect(listbox.getAttribute('aria-label')).toBe('UI')
    expect(listbox.textContent).toContain('More')
    expect(option(listbox, 'Full bleed').getAttribute('aria-disabled')).toBe('true')
    expect(option(listbox, 'Full bleed').textContent).toContain('Unavailable inside a narrow column')
    expect(option(listbox, 'Wide').textContent).toContain('Full width')
    expect(option(listbox, 'Wide').getAttribute('aria-selected')).toBe('true')
  })

  test('its rows are the full tap height, at the sheet\'s inset', async () => {
    const { sheet } = await openSelect()

    expect(option(sheet!, 'Wide').className).toContain('cwa:min-h-hit')
    expect(option(sheet!, 'Wide').className).toContain('cwa:px-4')
    expect(option(sheet!, 'Wide').className).not.toContain('cwa:min-h-option')
  })

  test('the trigger says it is expanded and controls the sheet, so focus inside it stays in the field, and not once it closes', async () => {
    const { trigger, sheet } = await openSelect()

    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(document.getElementById(trigger.getAttribute('aria-controls')!)!.contains(sheet!.querySelector('[role="listbox"]'))).toBe(true)

    sheet!.querySelector<HTMLElement>('[data-testid="select-sheet-close"]')!.click()
    await flushPromises()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  test('focus starts on the chosen option; typeahead, the arrow keys, Home and End move it, skipping a disabled one', async () => {
    const { sheet } = await openSelect()

    expect(document.activeElement).toBe(option(sheet!, 'Wide'))
    await key(document.activeElement!, 'p')
    expect(document.activeElement).toBe(option(sheet!, 'Padded'))
    await key(document.activeElement!, 'ArrowUp')
    expect(document.activeElement).toBe(option(sheet!, 'Wide'))
    await key(document.activeElement!, 'Home')
    expect(document.activeElement).toBe(option(sheet!, 'Split image'))
    await key(document.activeElement!, 'End')
    expect(document.activeElement).toBe(option(sheet!, 'Padded'))
  })

  test.each([
    ['a tap', async (element: HTMLElement) => element.click()],
    ['End then Enter', async () => {
      await key(document.activeElement!, 'End')
      await key(document.activeElement!, 'Enter')
    }],
    ['End then Space', async () => {
      await key(document.activeElement!, 'End')
      await key(document.activeElement!, ' ')
    }],
  ])('choosing an option with %s emits it, closes the sheet and returns focus to the trigger', async (_, pick) => {
    const { wrapper, sheet, trigger } = await openSelect()

    await pick(option(sheet!, 'Padded'))
    await flushPromises()

    expect(wrapper.emitted('update:modelValue')).toEqual([['padded']])
    expect(document.querySelector('[data-testid="select-sheet"]')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  test('choosing the option already chosen only closes it', async () => {
    const { wrapper, sheet } = await openSelect()

    option(sheet!, 'Wide').click()
    await flushPromises()

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(document.querySelector('[data-testid="select-sheet"]')).toBeNull()
  })

  test('a nullable select lists None first in the sheet, and choosing it emits null', async () => {
    const { wrapper, sheet } = await openSelect({ nullable: true, noneLabel: 'Default' })

    expect(sheet!.querySelectorAll('[role="option"]')[0]!.textContent).toContain('Default')
    option(sheet!, 'Default').click()
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toEqual([[null]])
  })

  test.each([
    ['Done', () => document.querySelector<HTMLElement>('[data-testid="select-sheet-close"]')!.click()],
    ['Escape', () => key(document.activeElement!, 'Escape')],
    ['a tap on the scrim', async () => {
      await new Promise(resolve => setTimeout(resolve))
      document.querySelector('[data-testid="select-sheet-scrim"]')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    }],
  ])('%s closes it without choosing and returns focus to the trigger', async (_, close) => {
    const { wrapper, trigger } = await openSelect()

    await close()
    await flushPromises()

    expect(document.querySelector('[data-testid="select-sheet"]')).toBeNull()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(document.activeElement).toBe(trigger)
  })

  test('disabled with a reason opens no sheet', async () => {
    const { sheet } = await openSelect({ disabled: true, disabledReason: 'Publish first' })

    expect(sheet).toBeNull()
  })

  test('has no axe violations open, and with an option highlighted', async () => {
    const { sheet } = await openSelect({ nullable: true })
    expect(await axe(document.body)).toHaveNoViolations()

    await key(document.activeElement!, 'ArrowDown')
    expect(sheet!.contains(document.activeElement)).toBe(true)
    expect(await axe(document.body)).toHaveNoViolations()
  })
})

describe('CwaUiSelect wider than a phone (#461)', () => {
  beforeEach(() => onPhone(false))

  test('opens the anchored menu, never a sheet', async () => {
    const { sheet } = await openSelect()

    expect(sheet).toBeNull()
    expect(document.querySelector('[data-testid="select-menu"]')!.querySelector('[role="option"]')).not.toBeNull()
  })
})
