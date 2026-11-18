// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { axe } from '../../../../../test/utils/axe'
import { drawsFocusRing } from '../../../../../test/utils/focus-ring'
import FilterToggle from './FilterToggle.vue'

enableAutoUnmount(afterEach)

function mountToggle(modelValue = false, colour: 'static' | 'dynamic' = 'static') {
  const wrapper = mount(FilterToggle, {
    props: { 'label': colour === 'static' ? 'Static' : 'Dynamic', colour, modelValue, 'onUpdate:modelValue': (value: boolean) => wrapper.setProps({ modelValue: value }) },
    attachTo: document.body,
  })
  return wrapper
}

describe('CwaUiFilterToggle (#461)', () => {
  test('is a toggle button named by its label that reports being pressed', async () => {
    const wrapper = mountToggle()
    const button = wrapper.get('button')

    expect(button.text()).toBe('Static')
    expect(button.attributes('aria-pressed')).toBe('false')
    await button.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([[true]])
    expect(button.attributes('aria-pressed')).toBe('true')
  })

  test('off, it shows its type\'s mark in the type\'s colour on the field fill: a circle for Static, a square for Dynamic', () => {
    const staticMark = mountToggle(false, 'static').get('[data-testid="filter-toggle-mark"]').classes()
    const dynamicMark = mountToggle(false, 'dynamic').get('[data-testid="filter-toggle-mark"]').classes()

    expect(staticMark).toEqual(expect.arrayContaining(['cwa:rounded-full', 'cwa:bg-type-static']))
    expect(dynamicMark).toContain('cwa:bg-type-dynamic')
    expect(dynamicMark).not.toContain('cwa:rounded-full')
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
