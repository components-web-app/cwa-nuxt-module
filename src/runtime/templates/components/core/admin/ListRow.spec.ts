// @vitest-environment nuxt
import { afterEach, describe, expect, test } from 'vitest'
import { enableAutoUnmount } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { h } from 'vue'
import ListRow from './ListRow.vue'
import ListCell from './ListCell.vue'
import { axe } from '../../../../../../test/utils/axe'
import { drawsFocusRing } from '../../../../../../test/utils/focus-ring'

enableAutoUnmount(afterEach)

function mountRow(props: Record<string, unknown> = {}, slots: Record<string, unknown> = {}) {
  return mountSuspended({
    render: () => h('div', { 'role': 'table', 'aria-label': 'Pages' }, [h('div', { role: 'rowgroup' }, [h(ListRow, { title: 'Kitchens', ...props }, slots)])]),
  }, { attachTo: document.body })
}

describe('ListRow (#461)', () => {
  test('the title is the link to the item\'s modal and stretches over the whole row, drawing its own focus ring', async () => {
    const wrapper = await mountRow({ to: '/_cwa/pages/x' })
    const link = wrapper.get('[data-testid="list-row-link"]')

    expect(link.text()).toBe('Kitchens')
    expect(link.attributes('href')).toBe('/_cwa/pages/x')
    expect(link.classes()).toEqual(expect.arrayContaining(['cwa:after:absolute', 'cwa:after:inset-0']))
    expect(drawsFocusRing(link.classes())).toBe(true)
  })

  test('a row with nowhere to go has a plain title and no hover fill', async () => {
    const wrapper = await mountRow()

    expect(wrapper.find('[data-testid="list-row-link"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="list-row-title"]').text()).toBe('Kitchens')
    expect(wrapper.get('[role="row"]').classes()).not.toContain('cwa:hover:bg-field-hover/50')
  })

  test.each([
    ['Static page', 'static', 'cwa:bg-type-static', 'cwa:outline-type-static'],
    ['Dynamic template', 'dynamic', 'cwa:bg-type-dynamic', 'cwa:outline-type-dynamic'],
  ] as const)('the type %s is a round dot after the name, 8px, filled, with a 1px outline 2px out, named for screen readers', async (label, colour, fill, outline) => {
    const type = (await mountRow({ type: { label, colour } })).get('[data-testid="list-row-type"]')

    expect(type.attributes()).toMatchObject({ 'role': 'img', 'aria-label': label })
    expect(type.classes()).toEqual(expect.arrayContaining(['cwa:size-2', 'cwa:rounded-full', 'cwa:outline-1', 'cwa:outline-offset-2', fill, outline]))
  })

  describe('row actions', () => {
    test('Edit goes where the row does and View to the page on the site, as icon-only links named for the row', async () => {
      const wrapper = await mountRow({ to: '/_cwa/pages/x', view: '/kitchens', actions: true })
      const edit = wrapper.get('[data-testid="list-row-edit"]')
      const view = wrapper.get('[data-testid="list-row-view"]')

      expect(edit.attributes()).toMatchObject({ 'href': '/_cwa/pages/x', 'aria-label': 'Edit Kitchens', 'title': 'Edit Kitchens' })
      expect(view.attributes()).toMatchObject({ 'href': '/kitchens', 'aria-label': 'View Kitchens', 'title': 'View Kitchens' })
      expect(edit.text()).toBe('')
      expect(view.text()).toBe('')
    })

    test('the actions are named for the given name when the title is not it', async () => {
      const wrapper = await mountRow({ to: '/x', view: '/y', actions: true, name: 'the Kitchens page' })

      expect(wrapper.get('[data-testid="list-row-edit"]').attributes('aria-label')).toBe('Edit the Kitchens page')
      expect(wrapper.get('[data-testid="list-row-view"]').attributes('aria-label')).toBe('View the Kitchens page')
    })

    test('keyboard users get exactly two stops, Edit then View, while the whole row still opens Edit', async () => {
      const wrapper = await mountRow({ to: '/_cwa/pages/x', view: '/kitchens', actions: true })
      const row = wrapper.get('[role="row"]').element
      const stops = [...row.querySelectorAll<HTMLElement>('a, button')].filter(element => element.tabIndex >= 0)

      expect(stops.map(element => element.dataset.testid)).toEqual(['list-row-edit', 'list-row-view'])
      const link = wrapper.get('[data-testid="list-row-link"]')
      expect(link.attributes()).toMatchObject({ href: '/_cwa/pages/x', tabindex: '-1' })
      expect(link.classes()).toEqual(expect.arrayContaining(['cwa:after:absolute', 'cwa:after:inset-0']))
    })

    test('a row with nothing to view has Edit only', async () => {
      const wrapper = await mountRow({ to: '/_cwa/layouts/x', actions: true })

      expect(wrapper.find('[data-testid="list-row-edit"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="list-row-view"]').exists()).toBe(false)
    })

    test('without actions the title link stays the row\'s one stop', async () => {
      const wrapper = await mountRow({ to: '/x' })

      expect(wrapper.find('[data-testid="list-row-edit"]').exists()).toBe(false)
      expect(wrapper.get('[data-testid="list-row-link"]').attributes('tabindex')).toBeUndefined()
    })

    test('the actions sit tight at the row end, above the stretched link, with large filled glyphs in square targets of at least 24px, 44px on coarse pointers, and focus rings', async () => {
      const wrapper = await mountRow({ to: '/x', view: '/y', actions: true })
      const cell = wrapper.get('[data-testid="list-row-actions"]')

      expect(cell.attributes('role')).toBe('cell')
      expect(cell.classes()).toEqual(expect.arrayContaining(['cwa:relative', 'cwa:z-[1]', 'cwa:flex', 'cwa:justify-end', 'cwa:gap-2']))
      for (const testId of ['list-row-edit', 'list-row-view']) {
        const action = wrapper.get(`[data-testid="${testId}"]`)
        expect(action.classes()).toEqual(expect.arrayContaining(['cwa:size-8', 'cwa:pointer-coarse:size-hit']))
        expect(drawsFocusRing(action.classes())).toBe(true)
        const glyph = action.get('svg')
        expect(glyph.attributes('aria-hidden')).toBe('true')
        expect(glyph.classes().some(name => /^cwa:(size|h)-(5|6)$/.test(name))).toBe(true)
        expect(glyph.find('[fill="currentColor"]').exists()).toBe(true)
      }
    })

    test('other actions given to the row share its actions cell', async () => {
      const wrapper = await mountRow({ to: '/x', actions: true }, { actions: () => h('button', { 'type': 'button', 'data-testid': 'extra' }, 'Delete') })

      expect(wrapper.get('[data-testid="list-row-actions"]').find('[data-testid="extra"]').exists()).toBe(true)
    })

    test('has no axe violations', async () => {
      await mountRow({ to: '/x', view: '/y', actions: true, type: { label: 'Dynamic template', colour: 'dynamic' } })

      expect(await axe(document.body)).toHaveNoViolations()
    })
  })

  test('the second line gives way to the phone line below md when there is one', async () => {
    const plain = await mountRow({ sub: '/kitchens' })
    expect(plain.get('[data-testid="list-row-sub"]').classes()).not.toContain('cwa:max-md:hidden')

    const phone = await mountRow({ sub: '/kitchens' }, { phone: () => 'Live · /kitchens' })
    expect(phone.get('[data-testid="list-row-sub"]').classes()).toContain('cwa:max-md:hidden')
    expect(phone.get('[data-testid="list-row-phone"]').classes()).toContain('cwa:md:hidden')
  })

  test('cells hide below md unless they hold an action, which sits above the stretched link', async () => {
    const wrapper = await mountRow({ to: '/x' }, { default: () => [h(ListCell, null, () => 'Live'), h(ListCell, { align: 'end' }, () => '17 Nov 2026'), h(ListCell, { action: true }, () => 'x')] })
    const [, status, date, action] = wrapper.findAll('[role="cell"]')

    expect(status!.classes()).toContain('cwa:max-md:hidden')
    expect(date!.classes()).toEqual(expect.arrayContaining(['cwa:text-end', 'cwa:tabular-nums']))
    expect(action!.classes()).toEqual(expect.arrayContaining(['cwa:relative', 'cwa:z-[1]']))
    expect(action!.classes()).not.toContain('cwa:max-md:hidden')
  })

  test('a dimmed row mutes its title', async () => {
    expect((await mountRow({ to: '/x', dim: true })).get('[data-testid="list-row-link"]').classes()).toContain('cwa:text-fg-muted')
  })

  test('has no axe violations', async () => {
    await mountRow({ to: '/x', sub: '/kitchens', type: { label: 'Static', colour: 'static' } }, { default: () => h(ListCell, null, () => 'Live') })

    expect(await axe(document.body)).toHaveNoViolations()
  })
})
