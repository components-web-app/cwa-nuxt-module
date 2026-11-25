// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import { axe } from '../../../../../test/utils/axe'
import DetailList from './DetailList.vue'
import FormSection from './FormSection.vue'
import Badge from './Badge.vue'

const order = [
  { label: 'Reference', value: 'ORD-1042' },
  { label: 'Placed', value: '24 Nov 2026, 10:12' },
  { label: 'Items', value: 3 },
]

describe('CwaUiDetailList', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  test('is one <dl> with a <dt> label and <dd> value per item, in order', () => {
    const wrapper = mount(DetailList, { props: { items: order } })

    const lists = wrapper.findAll('dl')
    expect(lists).toHaveLength(1)
    expect(wrapper.findAll('dl > div > dt').map(dt => dt.text())).toEqual(['Reference', 'Placed', 'Items'])
    expect(wrapper.findAll('dl > div > dd').map(dd => dd.text())).toEqual(['ORD-1042', '24 Nov 2026, 10:12', '3'])
  })

  test('looks like the Info tab\'s History block, so the two read as one design', () => {
    const wrapper = mount(DetailList, { props: { items: order } })

    expect(wrapper.get('dt').classes()).toEqual(['cwa:text-label', 'cwa:text-fg'])
    expect(wrapper.get('dd').classes()).toEqual(expect.arrayContaining(['cwa:m-0', 'cwa:mt-1.5', 'cwa:text-control', 'cwa:text-fg-secondary']))
    expect(wrapper.get('dl').classes()).toEqual(expect.arrayContaining(['cwa:grid', 'cwa:grid-cols-1', 'cwa:gap-x-4', 'cwa:gap-y-stack']))
  })

  test('stacks on a phone and puts two items a row once its container is wide, as a two-column form section does', () => {
    const wrapper = mount(DetailList, { props: { items: order } })

    expect(wrapper.get('[data-testid="detail-list"]').classes()).toContain('cwa:@container')
    expect(wrapper.get('dl').classes()).toContain('cwa:@lg:grid-cols-2')
  })

  test('a single item stays full width, never half a row', () => {
    const wrapper = mount(DetailList, { props: { items: [order[0]!] } })

    expect(wrapper.get('dl').classes()).not.toContain('cwa:@lg:grid-cols-2')
  })

  test.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty string', ''],
  ])('a value that is %s shows the History block\'s em dash, read out as "Not set"', (_, value) => {
    const wrapper = mount(DetailList, { props: { items: [{ label: 'Shipped', value }] } })

    const dd = wrapper.get('dd')
    expect(dd.get('[aria-hidden="true"]').text()).toBe('—')
    expect(dd.get('.cwa\\:sr-only').text()).toBe('Not set')
  })

  test('zero is a value, not an empty one', () => {
    const wrapper = mount(DetailList, { props: { items: [{ label: 'Discount', value: 0 }] } })

    expect(wrapper.get('dd').text()).toBe('0')
  })

  test('the value slot gets each item and its index, for markup such as a badge, and the other items keep their text', () => {
    const wrapper = mount(DetailList, {
      props: { items: [{ label: 'Status', value: 'paid' }, ...order] },
      slots: {
        value: ({ item, index }: { item: { label: string, value?: string | number | null }, index: number }) =>
          index === 0 ? h(Badge, { tone: 'success' }, () => `Paid (${item.value})`) : item.value,
      },
    })

    const values = wrapper.findAll('dd')
    expect(values[0]!.findComponent(Badge).exists()).toBe(true)
    expect(values[0]!.text()).toBe('Paid (paid)')
    expect(values[1]!.text()).toBe('ORD-1042')
  })

  describe('has no axe violations', () => {
    test.each([
      ['with values', order],
      ['with empty values', [{ label: 'Shipped', value: null }, { label: 'Tracking' }]],
      ['with no items', []],
    ])('%s', async (_, items) => {
      const wrapper = mount(DetailList, { props: { items }, attachTo: document.body })
      expect(await axe(wrapper.element)).toHaveNoViolations()
    })

    test('with a badge in the value slot, inside a form section', async () => {
      const wrapper = mount(FormSection, {
        props: { title: 'Order' },
        slots: {
          default: () => h(DetailList, { items: order }, { value: ({ item }: { item: { value?: string | number | null } }) => h(Badge, { tone: 'accent' }, () => String(item.value)) }),
        },
        attachTo: document.body,
      })
      expect(await axe(wrapper.element)).toHaveNoViolations()
    })
  })
})
