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

  test('the type is a coloured mark named for screen readers: a round dot for Static and for Dynamic, told apart by colour and name', async () => {
    const staticType = (await mountRow({ type: { label: 'Static', colour: 'static' } })).get('[data-testid="list-row-type"]')
    const dynamicType = (await mountRow({ type: { label: 'Dynamic', colour: 'dynamic' } })).get('[data-testid="list-row-type"]')

    expect(staticType.attributes()).toMatchObject({ 'role': 'img', 'aria-label': 'Static' })
    expect(staticType.classes()).toEqual(expect.arrayContaining(['cwa:rounded-full', 'cwa:bg-type-static']))
    expect(dynamicType.attributes()).toMatchObject({ 'role': 'img', 'aria-label': 'Dynamic' })
    expect(dynamicType.classes()).toEqual(expect.arrayContaining(['cwa:rounded-full', 'cwa:bg-type-dynamic']))
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
