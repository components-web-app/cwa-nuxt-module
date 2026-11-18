// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { axe } from '../../../../../../test/utils/axe'
import { drawsFocusRing } from '../../../../../../test/utils/focus-ring'
import FilterToggle from './FilterToggle.vue'

enableAutoUnmount(afterEach)

function mountToggle(modelValue = false, colour: 'static' | 'dynamic' = 'static') {
  const wrapper = mount(FilterToggle, {
    props: { 'label': colour === 'static' ? 'Static' : 'Dynamic', colour, modelValue, 'onUpdate:modelValue': (value: boolean) => wrapper.setProps({ modelValue: value }) },
    attachTo: document.body,
  })
  return wrapper
}

describe('FilterToggle (#461)', () => {
  test('is a toggle button named by its label that reports being pressed', async () => {
    const wrapper = mountToggle()
    const button = wrapper.get('button')

    expect(button.text()).toBe('Static')
    expect(button.attributes('aria-pressed')).toBe('false')
    await button.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([[true]])
    expect(button.attributes('aria-pressed')).toBe('true')
  })

  test.each([
    ['static', 'cwa:bg-type-static', 'cwa:outline-type-static'],
    ['dynamic', 'cwa:bg-type-dynamic', 'cwa:outline-type-dynamic'],
  ] as const)('off, a %s toggle shows the list rows\' round dot: 8px, filled, with a 1px outline 2px out, in its type\'s colour', (colour, fill, outline) => {
    const mark = mountToggle(false, colour).get('[data-testid="filter-toggle-mark"]').classes()

    expect(mark).toEqual(expect.arrayContaining(['cwa:size-2', 'cwa:rounded-full', 'cwa:outline-1', 'cwa:outline-offset-2', fill, outline]))
  })

  test('on, it is filled in its type\'s colour with dark text and a check in place of the mark', () => {
    const button = mountToggle(true, 'dynamic').get('button')

    expect(button.classes()).toEqual(expect.arrayContaining(['cwa:bg-type-dynamic', 'cwa:text-stone-900']))
    expect(button.find('[data-testid="filter-toggle-mark"]').exists()).toBe(false)
    expect(button.find('svg').exists()).toBe(true)
  })

  test('draws the keyboard focus ring', () => {
    expect(drawsFocusRing(mountToggle().get('button').classes())).toBe(true)
  })

  test.each([false, true])('pressed %s, it has no axe violations', async (pressed) => {
    mountToggle(pressed)

    expect(await axe(document.body)).toHaveNoViolations()
  })
})
