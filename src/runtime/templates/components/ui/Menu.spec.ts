// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import { axe } from '../../../../../test/utils/axe'
import { drawsOpenLine, drawsOpenState, failingInk, shownColour } from '../../../../../test/utils/kit-css'
import { menuGroups } from '../core/ui/menu-entries'
import Menu from './Menu.vue'

enableAutoUnmount(afterEach)

const items = [
  { label: 'Cancel schedule', value: 'cancel' },
  { group: null, items: [{ label: 'Add before', value: 'before' }, { label: 'Add after', value: 'after', disabled: true, disabledReason: 'Main is full' }] },
  { group: 'More', items: [{ label: 'Clone', value: 'clone', testId: 'menu-clone' }, { label: 'Delete', value: 'delete', tone: 'danger' as const }] },
]

async function openMenu(onSelect = vi.fn()) {
  const wrapper = mount(Menu, {
    props: { items, label: 'More actions', open: true, onSelect },
    slots: { default: () => h('button', { type: 'button' }, '⋮') },
    attachTo: document.body,
  })
  await flushPromises()
  return { wrapper, onSelect, menu: document.querySelector<HTMLElement>('[data-testid="kit-menu"]')! }
}

describe('menuGroups (#459)', () => {
  test('keeps loose items in their own group, never merged into a group given before them, and drops empty groups', () => {
    const entries = [...items, { group: 'Empty', items: [] }, { label: 'Discard', value: 'discard' }]

    expect(menuGroups(entries).map(group => [group.group, group.items.map(item => item.label)])).toEqual([
      [null, ['Cancel schedule']],
      [null, ['Add before', 'Add after']],
      ['More', ['Clone', 'Delete']],
      [null, ['Discard']],
    ])
  })
})

describe('CwaUiMenu (#459)', () => {
  test('a named menu with a separator between groups, a group label, and a disabled item that says why', async () => {
    const { menu } = await openMenu()

    expect(menu.getAttribute('role')).toBe('menu')
    expect(menu.getAttribute('aria-label')).toBe('More actions')
    expect(menu.querySelectorAll('[role="separator"]')).toHaveLength(2)
    expect(menu.textContent).toContain('More')
    const disabled = [...menu.querySelectorAll('[role="menuitem"]')].find(item => item.textContent?.includes('Add after'))!
    expect(disabled.getAttribute('aria-disabled')).toBe('true')
    expect(disabled.textContent).toContain('Main is full')
  })

  test('on touch every row is the hit height, so a tap lands on the row meant', async () => {
    const { menu } = await openMenu()

    const rows = [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every(row => row.classList.contains('cwa:pointer-coarse:min-h-hit'))).toBe(true)
  })

  test('choosing an item emits it', async () => {
    const { menu, onSelect } = await openMenu()

    menu.querySelector<HTMLElement>('[data-testid="menu-clone"]')!.click()
    await flushPromises()
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ value: 'clone' }))
  })

  test('a disabled item emits nothing', async () => {
    const { menu, onSelect } = await openMenu()
    const disabled = [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(item => item.textContent?.includes('Add after'))!

    disabled.click()
    await flushPromises()
    expect(onSelect).not.toHaveBeenCalled()
  })

  test('has no axe violations', async () => {
    await openMenu()

    expect(await axe(document.body)).toHaveNoViolations()
  })

  test('opens at a point with no trigger, carries its attributes onto the panel, and shows a header above the items', async () => {
    mount(Menu, {
      props: { items: [{ label: 'Add after', value: 'after' }], label: 'Clone next to Hero', open: true, at: { x: 40, y: 60 } },
      attrs: { 'data-testid': 'clone-menu' },
      slots: { header: () => h('p', { 'data-testid': 'menu-header' }, 'Clone next to Hero') },
      attachTo: document.body,
    })
    await flushPromises()

    const menu = document.querySelector<HTMLElement>('[data-testid="clone-menu"]')!
    expect(menu.getAttribute('role')).toBe('menu')
    expect(menu.firstElementChild!.getAttribute('data-testid')).toBe('menu-header')
    expect(menu.querySelector('[role="menuitem"]')!.textContent).toContain('Add after')
    expect(document.querySelector('[aria-haspopup="menu"]')).toBeNull()
  })

  test('a disabled item with reasons keeps them behind its ⓘ, a menu item that opens them in a popover and leaves the menu open', async () => {
    const onSelect = vi.fn()
    const wrapper = mount(Menu, {
      props: { items: [{ label: 'Add before', value: 'before', disabled: true, reasons: ['Main content is full', 'Not allowed here'], reasonsLabel: 'Why Add before is unavailable', testId: 'clone-option' }], label: 'Clone', open: true, at: { x: 0, y: 0 }, onSelect },
      attachTo: document.body,
    })
    await flushPromises()

    const menu = document.querySelector<HTMLElement>('[data-testid="kit-menu"]')!
    expect(menu.textContent).not.toContain('Main content is full')
    const why = [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(item => item.getAttribute('aria-label') === 'Why Add before is unavailable')!
    expect(why.getAttribute('aria-disabled')).toBeNull()
    why.click()
    await flushPromises()
    expect(wrapper.emitted('update:open')).toBeUndefined()

    const reasons = document.querySelector<HTMLElement>('[data-testid="menu-item-reasons"]')!
    expect([...reasons.querySelectorAll('li')].map(item => item.textContent)).toEqual(['Main content is full', 'Not allowed here'])
    expect([...reasons.classList]).toEqual(expect.arrayContaining(['cwa:bg-surface-info', 'cwa:text-white', 'cwa:leading-normal', 'cwa:ring-1', 'cwa:ring-white/15']))
    expect(failingInk(reasons)).toEqual([])
    expect(document.querySelector('[data-testid="kit-menu"]')).not.toBeNull()
    expect(onSelect).not.toHaveBeenCalled()
  })

  test('the ⓘ shows its reasons open by turning its glyph the accent blue, even while it is the highlighted item, and goes back once they close, with no axe violations open', async () => {
    mount(Menu, {
      props: { items: [{ label: 'Add before', value: 'before', disabled: true, reasons: ['Main content is full'], reasonsLabel: 'Why Add before is unavailable' }], label: 'Clone', open: true, at: { x: 0, y: 0 } },
      attachTo: document.body,
    })
    await flushPromises()
    const why = document.querySelector<HTMLElement>('[data-testid="menu-item-why"]')!
    const glyph = why.querySelector('svg')!
    expect(drawsOpenState(why)).toBe(false)
    expect(shownColour(glyph)).toBe('fg-muted')

    why.click()
    await flushPromises()
    expect(drawsOpenState(why)).toBe(true)
    expect(drawsOpenLine(why)).toBe(false)
    why.setAttribute('data-highlighted', '')
    expect(shownColour(glyph)).toBe('accent-fg')
    why.removeAttribute('data-highlighted')
    expect(shownColour(glyph)).toBe('accent-fg')
    expect(await axe(document.body, { rules: { region: { enabled: false } } })).toHaveNoViolations()

    why.click()
    await flushPromises()
    expect(drawsOpenState(why)).toBe(false)
    expect(shownColour(glyph)).toBe('fg-muted')
  })
})
