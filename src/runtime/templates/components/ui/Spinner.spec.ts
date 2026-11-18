// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import { axe } from '../../../../../test/utils/axe'
import Spinner from './Spinner.vue'

describe('CwaUiSpinner (#456)', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  test('is decoration only: hidden from assistive technology, which hears the busy state from its control', () => {
    const wrapper = mount(Spinner)

    expect(wrapper.attributes('aria-hidden')).toBe('true')
    expect(wrapper.attributes('role')).toBeUndefined()
    expect(wrapper.text()).toBe('')
  })

  test('is a 1rem ring in the current text colour by default, and 0.75rem with a thinner ring when small', () => {
    const md = mount(Spinner)
    expect(md.classes()).toEqual(expect.arrayContaining(['cwa:size-4', 'cwa:border-2', 'cwa:border-current/28', 'cwa:border-t-current', 'cwa:rounded-full']))

    const sm = mount(Spinner, { props: { size: 'sm' } })
    expect(sm.classes()).toEqual(expect.arrayContaining(['cwa:size-3', 'cwa:border-[1.5px]']))
    expect(sm.classes()).not.toContain('cwa:size-4')
    expect(sm.classes()).not.toContain('cwa:border-2')
  })

  test('is the only motion that repeats, and turns once every 2 s under reduced motion instead of stopping', () => {
    const wrapper = mount(Spinner)

    expect(wrapper.classes()).toEqual(expect.arrayContaining(['cwa:animate-spinner', 'cwa:motion-reduce:animate-spinner-reduced']))
  })

  test.each(['sm', 'md'] as const)('has no axe violations at %s, inside the busy control it decorates', async (size) => {
    const wrapper = mount({ render: () => h('button', { 'type': 'button', 'aria-busy': 'true' }, [h(Spinner, { size }), 'Saving']) }, { attachTo: document.body })

    expect(await axe(wrapper.element)).toHaveNoViolations()
  })
})
