// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import Button from '../../ui/Button.vue'
import Toast from './Toast.vue'

describe('Toast (#457)', () => {
  test.each([
    ['success', 'cwa:toast-success'],
    ['info', 'cwa:toast-info'],
    ['warning', 'cwa:toast-warning'],
    ['error', 'cwa:toast-error'],
  ] as const)('a %s toast is square, carries its tone and a solid glyph of its own shape, hidden from screen readers', (tone, toneClass) => {
    const wrapper = mount(Toast, { props: { tone, title: 'Published' } })

    expect(wrapper.classes()).toEqual(expect.arrayContaining(['cwa:toast', toneClass, 'cwa:p-popover', 'cwa:text-fg']))
    expect(wrapper.classes().some(c => c.includes('rounded'))).toBe(false)
    const glyph = wrapper.get('[data-testid="toast-glyph"]')
    expect(glyph.attributes('aria-hidden')).toBe('true')
    expect(glyph.attributes('data-tone')).toBe(tone)
  })

  test('each tone has a different glyph', () => {
    const paths = (['success', 'info', 'warning', 'error'] as const).map(tone => mount(Toast, { props: { tone, title: 'x' } }).get('[data-testid="toast-glyph"] path').attributes('d'))

    expect(new Set(paths).size).toBe(4)
  })

  test('shows its title and description, and a named dismiss button that emits dismiss', async () => {
    const wrapper = mount(Toast, { props: { tone: 'info', title: 'Updated from your other window', description: 'Title and Intro on Hero section.' } })

    expect(wrapper.get('[data-testid="toast-title"]').text()).toBe('Updated from your other window')
    expect(wrapper.get('[data-testid="toast-description"]').text()).toBe('Title and Intro on Hero section.')
    const dismiss = wrapper.findAllComponents(Button).find(button => button.props('label') === 'Dismiss')!
    expect(dismiss.props()).toEqual(expect.objectContaining({ variant: 'ghost', iconOnly: true, size: 'sm' }))
    expect(dismiss.attributes('aria-label')).toBe('Dismiss')

    await dismiss.trigger('click')
    expect(wrapper.emitted('dismiss')).toHaveLength(1)
    expect(wrapper.emitted('action')).toBeUndefined()
  })

  test('without a description there is no description line', () => {
    expect(mount(Toast, { props: { tone: 'info', title: 'Saved' } }).find('[data-testid="toast-description"]').exists()).toBe(false)
  })

  test('actions are the kit\'s small buttons, the primary one solid and the rest soft, each emitting its index', async () => {
    const wrapper = mount(Toast, {
      props: {
        tone: 'error',
        title: 'Title wasn\'t saved',
        actions: [{ label: 'Show me', primary: true }, { label: 'Retry' }, { label: 'Reset' }],
      },
    })

    const actions = wrapper.get('[data-testid="toast-actions"]').findAllComponents(Button)
    expect(actions.map(button => [button.props('label'), button.props('variant'), button.props('size')])).toEqual([
      ['Show me', 'solid', 'sm'],
      ['Retry', 'soft', 'sm'],
      ['Reset', 'soft', 'sm'],
    ])

    await actions[2]!.trigger('click')
    expect(wrapper.emitted('action')).toEqual([[2]])
    expect(wrapper.emitted('dismiss')).toBeUndefined()
  })

  test('with no actions there is no actions row', () => {
    expect(mount(Toast, { props: { tone: 'error', title: 'Failed', actions: [] } }).find('[data-testid="toast-actions"]').exists()).toBe(false)
  })
})
