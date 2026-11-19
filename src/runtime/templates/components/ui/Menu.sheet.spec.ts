// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import { axe } from '../../../../../test/utils/axe'
import { onPhone } from '../../../../../test/utils/sheet-media'
import Menu from './Menu.vue'
import Button from './Button.vue'

enableAutoUnmount(afterEach)

const items = [
  { label: 'Cancel schedule', value: 'cancel' },
  { group: null, items: [{ label: 'Add before', value: 'before' }, { label: 'Add after', value: 'after', disabled: true, disabledReason: 'Main is full' }] },
  { group: 'More', items: [{ label: 'Clone', value: 'clone', testId: 'menu-clone' }, { label: 'Delete', value: 'delete', tone: 'danger' as const }] },
]

function mountMenu(props: Record<string, unknown> = {}, slots: Record<string, () => unknown> = {}) {
  const onSelect = vi.fn()
  const wrapper = mount(Menu, {
    props: { items, label: 'More actions', onSelect, ...props },
    slots: { default: () => h('button', { 'type': 'button', 'data-testid': 'menu-trigger' }, '⋮'), ...slots },
    attachTo: document.body,
  })
  return { wrapper, onSelect, trigger: wrapper.get<HTMLElement>('[data-testid="menu-trigger"]').element }
}

async function tapOpen(props: Record<string, unknown> = {}, slots: Record<string, () => unknown> = {}) {
  const opened = mountMenu(props, slots)
  opened.trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))
  await flushPromises()
  return { ...opened, sheet: document.querySelector<HTMLElement>('[data-testid="kit-menu-sheet"]'), menu: document.querySelector<HTMLElement>('[data-testid="kit-menu"]') }
}

function menuItems(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>('[role="menuitem"]')]
}

function item(root: HTMLElement, label: string) {
  return menuItems(root).find(element => element.textContent?.trim().startsWith(label))!
}

async function key(target: Element, name: string) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }))
  await flushPromises()
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('CwaUiMenu on a phone (#461)', () => {
  beforeEach(() => onPhone())

  test('opens as a bottom sheet titled by its label, with Close, holding the same named menu, never the anchored one', async () => {
    const { sheet, menu } = await tapOpen()

    expect(sheet!.getAttribute('role')).toBe('dialog')
    expect(document.getElementById(sheet!.getAttribute('aria-labelledby')!)!.textContent!.trim()).toBe('More actions')
    expect(sheet!.querySelector('[data-testid="kit-menu-sheet-close"]')!.textContent!.trim()).toBe('Close')
    expect(sheet!.contains(menu)).toBe(true)
    expect(menu!.getAttribute('role')).toBe('menu')
    expect(menu!.getAttribute('aria-label')).toBe('More actions')
    expect(document.querySelectorAll('[data-testid="kit-menu"]')).toHaveLength(1)
  })

  test('keeps the groups, separators, group label, disabled reason and danger tone, at the full tap height', async () => {
    const { menu } = await tapOpen()

    expect(menu!.querySelectorAll('[role="separator"]')).toHaveLength(2)
    expect(menu!.querySelector('[role="group"][aria-labelledby]')).not.toBeNull()
    expect(document.getElementById(menu!.querySelector('[role="group"][aria-labelledby]')!.getAttribute('aria-labelledby')!)!.textContent!.trim()).toBe('More')
    const disabled = item(menu!, 'Add after')
    expect(disabled.getAttribute('aria-disabled')).toBe('true')
    expect(disabled.textContent).toContain('Main is full')
    expect(item(menu!, 'Delete').className).toContain('cwa:text-danger-fg')
    expect(item(menu!, 'Clone').className).toContain('cwa:min-h-hit')
    expect(item(menu!, 'Clone').getAttribute('data-testid')).toBe('menu-clone')
  })

  test('focus starts on the first item; the arrow keys skip a disabled item and wrap, Home and End jump, and a letter jumps to the next item starting with it', async () => {
    const { menu } = await tapOpen()

    expect(document.activeElement).toBe(item(menu!, 'Cancel schedule'))
    await key(document.activeElement!, 'ArrowDown')
    expect(document.activeElement).toBe(item(menu!, 'Add before'))
    await key(document.activeElement!, 'ArrowDown')
    expect(document.activeElement).toBe(item(menu!, 'Clone'))
    await key(document.activeElement!, 'End')
    expect(document.activeElement).toBe(item(menu!, 'Delete'))
    await key(document.activeElement!, 'ArrowDown')
    expect(document.activeElement).toBe(item(menu!, 'Cancel schedule'))
    await key(document.activeElement!, 'd')
    expect(document.activeElement).toBe(item(menu!, 'Delete'))
    await key(document.activeElement!, 'Home')
    expect(document.activeElement).toBe(item(menu!, 'Cancel schedule'))
  })

  test('choosing an item emits it, closes the sheet and returns focus to the trigger', async () => {
    const { menu, onSelect, wrapper, trigger } = await tapOpen()

    item(menu!, 'Clone').click()
    await flushPromises()

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ value: 'clone' }))
    expect(wrapper.emitted('update:open')!.at(-1)).toEqual([false])
    expect(document.querySelector('[data-testid="kit-menu-sheet"]')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  test('a disabled item emits nothing and leaves the sheet open', async () => {
    const { menu, onSelect } = await tapOpen()

    item(menu!, 'Add after').click()
    await flushPromises()

    expect(onSelect).not.toHaveBeenCalled()
    expect(document.querySelector('[data-testid="kit-menu-sheet"]')).not.toBeNull()
  })

  test.each([
    ['Close', () => document.querySelector<HTMLElement>('[data-testid="kit-menu-sheet-close"]')!.click()],
    ['Escape', () => key(document.activeElement!, 'Escape')],
    ['a tap on the scrim', async () => {
      await new Promise(resolve => setTimeout(resolve))
      document.querySelector('[data-testid="kit-menu-sheet-scrim"]')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    }],
  ])('%s closes it without choosing and returns focus to the trigger', async (_, close) => {
    const { onSelect, wrapper, trigger } = await tapOpen()

    await close()
    await flushPromises()

    expect(document.querySelector('[data-testid="kit-menu-sheet"]')).toBeNull()
    expect(wrapper.emitted('update:open')!.at(-1)).toEqual([false])
    expect(onSelect).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(trigger)
  })

  test('opened at a point with no trigger, it is still a sheet, carries its attributes onto the menu and hands its header the sheet, under the title', async () => {
    mount(Menu, {
      props: { items: [{ label: 'Add after', value: 'after' }], label: 'Clone next to Hero', open: true, at: { x: 40, y: 60 } },
      attrs: { 'data-testid': 'clone-menu' },
      slots: { header: ({ sheet }: { sheet: boolean }) => h('p', { 'data-testid': 'menu-header' }, sheet ? 'in a sheet' : 'anchored') },
      attachTo: document.body,
    })
    await flushPromises()

    const sheet = document.querySelector<HTMLElement>('[data-testid="kit-menu-sheet"]')!
    expect(sheet.querySelector('[data-testid="menu-header"]')!.textContent).toBe('in a sheet')
    expect(sheet.querySelector('[data-testid="clone-menu"]')!.getAttribute('role')).toBe('menu')
  })

  test('a disabled item\'s reasons stay behind its ⓘ, a menu item that shows them under the row and leaves the sheet open', async () => {
    const { menu, onSelect, wrapper } = await tapOpen({ items: [
      { label: 'Add before', value: 'before', disabled: true, reasons: ['Main content is full', 'Not allowed here'], reasonsLabel: 'Why Add before is unavailable' },
      { label: 'Add after', value: 'after' },
    ] })

    expect(menu!.textContent).not.toContain('Main content is full')
    expect(document.activeElement!.getAttribute('aria-label')).toBe('Why Add before is unavailable')
    const why = document.activeElement as HTMLElement
    expect(why.getAttribute('aria-expanded')).toBe('false')
    why.click()
    await flushPromises()

    expect(why.getAttribute('aria-expanded')).toBe('true')
    const reasons = document.getElementById(why.getAttribute('aria-controls')!)!
    expect([...reasons.querySelectorAll('li')].map(entry => entry.textContent!.trim())).toEqual(['Main content is full', 'Not allowed here'])
    expect(wrapper.emitted('update:open')!.at(-1)).toEqual([true])
    expect(onSelect).not.toHaveBeenCalled()
    expect(await axe(document.body)).toHaveNoViolations()
  })

  test('has no axe violations open, and with focus moved', async () => {
    await tapOpen()
    expect(await axe(document.body)).toHaveNoViolations()

    await key(document.activeElement!, 'ArrowDown')
    expect(await axe(document.body)).toHaveNoViolations()
  })
})

describe('CwaUiMenu wider than a phone (#461)', () => {
  beforeEach(() => onPhone(false))

  test('opens the anchored menu, never a sheet', async () => {
    const { sheet, menu } = await tapOpen()

    expect(sheet).toBeNull()
    expect(menu!.getAttribute('role')).toBe('menu')
  })
})

describe('the split button\'s ⋮ on a phone (#461)', () => {
  beforeEach(() => onPhone())

  test('opens its actions as a bottom sheet, and choosing one emits it from the button and returns focus to ⋮', async () => {
    const wrapper = mount(Button, { props: { label: 'Publish now', variant: 'solid', options: items }, attachTo: document.body })
    const more = wrapper.get<HTMLElement>('[data-testid="button-options"]')

    await more.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    const sheet = document.querySelector<HTMLElement>('[data-testid="kit-menu-sheet"]')!
    expect(document.getElementById(sheet.getAttribute('aria-labelledby')!)!.textContent!.trim()).toBe('More actions')
    item(sheet, 'Clone').click()
    await flushPromises()

    expect(wrapper.emitted('select')).toEqual([[expect.objectContaining({ value: 'clone' })]])
    expect(document.activeElement).toBe(more.element)
  })
})
