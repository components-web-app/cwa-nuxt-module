// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import { axe } from '../../../../../test/utils/axe'
import Badge from './Badge.vue'
import { badgeTintPercent } from './kit-looks'

const Clock = { name: 'ClockIcon', render: () => h('svg', { 'data-testid': 'clock' }) }

describe('CwaUiBadge (#456)', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  test('is a square, unwrapping label in the flag type, neutral by default', () => {
    const wrapper = mount(Badge, { slots: { default: () => 'Draft' } })

    expect(wrapper.element.tagName).toBe('SPAN')
    expect(wrapper.text()).toBe('Draft')
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['cwa:text-flag', 'cwa:whitespace-nowrap', 'cwa:px-2', 'cwa:py-0.5', 'cwa:bg-field', 'cwa:text-fg']))
    expect(wrapper.classes().some(c => c.includes('rounded'))).toBe(false)
  })

  test.each([
    ['success', 'cwa:bg-[color-mix(in_srgb,var(--cwa-color-success)_var(--cwa-badge-tint),var(--cwa-color-surface))]', 'cwa:text-success'],
    ['warning', 'cwa:bg-[color-mix(in_srgb,var(--cwa-color-warning)_var(--cwa-badge-tint),var(--cwa-color-surface))]', 'cwa:text-warning'],
    ['danger', 'cwa:bg-[color-mix(in_srgb,var(--cwa-color-danger)_var(--cwa-badge-tint),var(--cwa-color-surface))]', 'cwa:text-danger'],
    ['accent', 'cwa:bg-accent-tint', 'cwa:text-accent-fg'],
    ['neutral', 'cwa:bg-field', 'cwa:text-fg-muted'],
  ] as const)('a %s badge has its tinted fill, keeps fg text, and its dot carries the tone', (tone, fill, mark) => {
    const wrapper = mount(Badge, { props: { tone, dot: true }, slots: { default: () => 'Live' } })

    expect(wrapper.classes()).toContain(fill)
    expect(wrapper.attributes('style')).toContain(`--cwa-badge-tint: ${badgeTintPercent}%`)
    expect(wrapper.classes()).toContain('cwa:text-fg')
    const dot = wrapper.get('[data-testid="badge-mark"]')
    expect(dot.attributes('aria-hidden')).toBe('true')
    expect(dot.classes()).toEqual(expect.arrayContaining([mark, 'cwa:bg-current', 'cwa:rounded-full', 'cwa:size-2']))
  })

  test('has no mark unless asked, so a count or a label stands alone', () => {
    const wrapper = mount(Badge, { props: { tone: 'accent' }, slots: { default: () => 'Shared · 3 places' } })

    expect(wrapper.find('[data-testid="badge-mark"]').exists()).toBe(false)
  })

  test('shows an icon in the tone\'s colour instead of the dot', () => {
    const wrapper = mount(Badge, { props: { tone: 'accent', icon: Clock, dot: true }, slots: { default: () => 'Scheduled' } })

    const icon = wrapper.get('[data-testid="clock"]')
    expect(icon.attributes('aria-hidden')).toBe('true')
    expect(icon.classes()).toEqual(expect.arrayContaining(['cwa:text-accent-fg', 'cwa:size-2.5']))
    expect(wrapper.findAll('[data-testid="badge-mark"]')).toHaveLength(0)
  })

  describe('has no axe violations', () => {
    const tones = ['neutral', 'accent', 'success', 'warning', 'danger'] as const
    const marks = { 'plain': {}, 'with a dot': { dot: true }, 'with an icon': { icon: Clock } } as const
    const cases = tones.flatMap(tone => Object.entries(marks).map(([mark, props]) => [`${tone}, ${mark}`, { tone, ...props }] as const))

    test.each(cases)('%s', async (_, props) => {
      const wrapper = mount(Badge, { props, slots: { default: () => 'Live' }, attachTo: document.body })

      expect(await axe(wrapper.element)).toHaveNoViolations()
    })
  })
})
