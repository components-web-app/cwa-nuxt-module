// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { axe } from '../../../../../test/utils/axe'
import { announceKey } from '../core/ui/field-keys'
import Num from './Number.vue'

enableAutoUnmount(afterEach)

function mountNumber(props: Record<string, unknown> = {}, announce = vi.fn()) {
  const wrapper = mount(Num, {
    props: { 'label': 'Columns', 'min': 1, 'max': 6, 'modelValue': 3, 'onUpdate:modelValue': (value: number) => wrapper.setProps({ modelValue: value }), ...props },
    global: { provide: { [announceKey as symbol]: announce } },
  })
  return { wrapper, announce, input: wrapper.get('input'), down: wrapper.get('[data-step="down"]'), up: wrapper.get('[data-step="up"]') }
}

describe('CwaUiNumber (#459)', () => {
  test('is a spinbutton that reads its value against the range', () => {
    const { input } = mountNumber()

    expect(input.attributes('role')).toBe('spinbutton')
    expect(input.attributes('aria-valuemin')).toBe('1')
    expect(input.attributes('aria-valuemax')).toBe('6')
    expect(input.attributes('aria-valuetext')).toBe('3 of 6')
  })

  test.each([
    ['ArrowUp', 4],
    ['ArrowDown', 2],
    ['PageUp', 6],
    ['PageDown', 1],
    ['Home', 1],
    ['End', 6],
  ])('%s moves it to %s, never past an end', async (key, expected) => {
    const { wrapper, input } = mountNumber()

    await input.trigger('keydown', { key })
    expect(wrapper.emitted('update:modelValue')).toEqual([[expected]])
  })

  test('at an end the step button stays focusable, says why it does nothing, and does nothing', async () => {
    const { wrapper, up } = mountNumber({ modelValue: 6, maxReason: 'Six is the most' })

    expect(up.attributes('disabled')).toBeUndefined()
    expect(up.attributes('aria-disabled')).toBe('true')
    expect(wrapper.get(`#${up.attributes('aria-describedby')}`).text()).toBe('Six is the most')
    await up.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  test('typing out of range is allowed and marked, and on blur it snaps to the nearest end and says so', async () => {
    const { wrapper, input, announce } = mountNumber()

    await input.setValue('9')
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('[data-testid="number-range"]').text()).toBe('Between 1 and 6')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    await input.trigger('blur')
    expect(wrapper.emitted('update:modelValue')).toEqual([[6]])
    expect(announce).toHaveBeenCalledWith('Set to 6, the highest value')
    expect(wrapper.find('[data-testid="number-range"]').exists()).toBe(false)
  })

  test('keeps only digits, and a minus only when the range goes below zero', async () => {
    const positive = mountNumber()
    await positive.input.setValue('-4a')
    expect(positive.input.element.value).toBe('4')

    const signed = mountNumber({ min: -5 })
    await signed.input.setValue('-4a')
    expect(signed.input.element.value).toBe('-4')
  })

  test('Enter commits what was typed', async () => {
    const { wrapper, input } = mountNumber()

    await input.setValue('5')
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:modelValue')).toEqual([[5]])
  })

  test('the step buttons take their names from the props', () => {
    const { down, up } = mountNumber({ decrementLabel: 'Move up', incrementLabel: 'Move down' })

    expect(down.attributes('aria-label')).toBe('Move up')
    expect(up.attributes('aria-label')).toBe('Move down')
  })

  test.each([3, 9])('with %s typed it has no axe violations', async (typed) => {
    const wrapper = mount(Num, { props: { label: 'Columns', min: 1, max: 6, modelValue: 3, minReason: 'One is the fewest', maxReason: 'Six is the most' }, attachTo: document.body })
    await wrapper.get('input').setValue(String(typed))

    expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()
  })
})
