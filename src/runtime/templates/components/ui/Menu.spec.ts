// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import { axe } from '../../../../../test/utils/axe'
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
})
