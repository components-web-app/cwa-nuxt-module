// @vitest-environment nuxt
import { describe, test, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ModalReachableToggle from './ModalReachableToggle.vue'

function setup(props: { modelValue?: boolean, hasRoute?: boolean } = {}) {
  return mount(ModalReachableToggle, {
    props: { modelValue: false, hasRoute: false, ...props },
  })
}

describe('ModalReachableToggle', () => {
  test('is labelled "Public without a route" and reflects the model value', () => {
    const wrapper = setup({ modelValue: true })
    expect(wrapper.text()).toContain('Public without a route')
    expect(wrapper.find('[role="switch"]').attributes('aria-checked')).toBe('true')
  })

  test('emits the new value when switched', async () => {
    const wrapper = setup()
    await wrapper.find('[role="switch"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[true]])
  })

  test('stays enabled without a route and says a parent page must also be live, so it can be set ahead of a parent going live', () => {
    const wrapper = setup()
    expect(wrapper.find('[role="switch"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.text()).toContain('Also needs any parent page to be live.')
  })

  test('is disabled with a route, because the route then decides who can read the page', async () => {
    const wrapper = setup({ hasRoute: true, modelValue: true })
    const toggle = wrapper.find('[role="switch"]')
    expect(toggle.attributes('disabled')).toBeDefined()
    expect(toggle.attributes('aria-checked')).toBe('true')
    expect(wrapper.text()).toContain('Has no effect while this page has a route.')
    expect(wrapper.text()).not.toContain('Also needs any parent page to be live.')
    await toggle.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
