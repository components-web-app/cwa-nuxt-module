// @vitest-environment nuxt
import { describe, test, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ModalRadioTabs from './ModalRadioTabs.vue'

const options = [
  { label: 'None', value: null },
  { label: 'Page', value: 'page' },
  { label: 'Data', value: 'data' },
]

describe('ModalRadioTabs', () => {
  test('renders all option buttons with correct labels', () => {
    const wrapper = mount(ModalRadioTabs, {
      props: { options, modelValue: null },
    })
    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(3)
    expect(buttons[0].text()).toBe('None')
    expect(buttons[1].text()).toBe('Page')
    expect(buttons[2].text()).toBe('Data')
  })

  test('marks the active option with aria-current and not others', () => {
    const wrapper = mount(ModalRadioTabs, {
      props: { options, modelValue: 'page' },
    })
    const buttons = wrapper.findAll('button')
    expect(buttons[1].attributes('aria-current')).toBe('true')
    expect(buttons[0].attributes('aria-current')).toBeUndefined()
    expect(buttons[2].attributes('aria-current')).toBeUndefined()
  })

  test('emits update:modelValue with option value when a tab is clicked', async () => {
    const wrapper = mount(ModalRadioTabs, {
      props: { options, modelValue: null },
    })
    await wrapper.findAll('button')[1].trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['page']])
  })

  test('emits null when the None tab is clicked', async () => {
    const wrapper = mount(ModalRadioTabs, {
      props: { options, modelValue: 'page' },
    })
    await wrapper.findAll('button')[0].trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[null]])
  })
})
