// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { axe } from '../../../../../test/utils/axe'
import { drawsFocusRing } from '../../../../../test/utils/focus-ring'
import { fakeFieldModel } from '../../../../../playground/app/kit/fake-field-model'
import Toggle from './Toggle.vue'

enableAutoUnmount(afterEach)

describe('CwaUiToggle (#459)', () => {
  test('is a switch named by its own label, which toggles it and reports the new value', async () => {
    const wrapper = mount(Toggle, { props: { 'label': 'Schedule', 'modelValue': false, 'onUpdate:modelValue': (value: boolean) => wrapper.setProps({ modelValue: value }) } })
    const control = wrapper.get('[role="switch"]')

    expect(wrapper.get(`label[for="${control.attributes('id')}"]`).text()).toBe('Schedule')
    await control.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([[true]])
    expect(control.attributes('aria-checked')).toBe('true')
  })

  test('bound to a model, it writes the model and shows the model\'s saving state', async () => {
    const model = fakeFieldModel(false, 'saving')
    const wrapper = mount(Toggle, { props: { label: 'Featured', model } })

    expect(wrapper.get('[role="switch"]').attributes('aria-busy')).toBe('true')
    await wrapper.get('[role="switch"]').trigger('click')
    expect(model.model.value).toBe(true)
  })

  test('disabled, it neither toggles nor reports', async () => {
    const wrapper = mount(Toggle, { props: { label: 'Schedule', modelValue: false, disabled: true } })

    await wrapper.get('[role="switch"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  test.each(['idle', 'saving', 'error'] as const)('a %s toggle with info has no axe violations', async (status) => {
    const wrapper = mount(Toggle, { props: { label: 'Featured', info: 'Shows it first.', model: fakeFieldModel(true, status) }, attachTo: document.body })

    expect(await axe(wrapper.element.parentElement as HTMLElement)).toHaveNoViolations()
  })

  test('the switch draws its focus ring when focused from the keyboard', () => {
    const wrapper = mount(Toggle, { props: { label: 'Schedule', modelValue: false } })

    expect(drawsFocusRing(wrapper.get('[role="switch"]').classes())).toBe(true)
  })
})
