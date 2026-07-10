// @vitest-environment happy-dom
import { describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import Select from './Select.vue'

// Stub Headless UI — its listbox behaviour is its own (tested upstream); here we assert OUR wiring:
// options rendering, trigger label, the `multiple` passthrough, and v-model propagation.
vi.mock('@headlessui/vue', () => ({
  Listbox: {
    name: 'Listbox',
    props: ['modelValue', 'by', 'multiple'],
    emits: ['update:modelValue'],
    template: '<div><slot /></div>',
  },
  ListboxButton: { name: 'ListboxButton', template: '<button><slot /></button>' },
  ListboxOptions: { name: 'ListboxOptions', template: '<ul><slot /></ul>' },
  ListboxOption: {
    name: 'ListboxOption',
    props: ['value', 'disabled', 'as'],
    // real Headless UI with `as="template"` renders the slot directly, no wrapper element
    template: '<slot :active="false" :selected="false" />',
  },
}))

vi.mock('#cwa/composables/popper', () => ({
  usePopper: vi.fn(() => [ref(null), ref(null)]),
}))

const options = [
  { label: 'First', value: 'a' },
  { label: 'Second', value: 'b' },
  { label: 'Third', value: 'c', disabled: true },
]

describe('CwaUiSelect', () => {
  test('renders one entry per option with its label', () => {
    const wrapper = mount(Select, { props: { options, modelValue: 'a' } })
    const items = wrapper.findAll('li')
    expect(items).toHaveLength(3)
    expect(wrapper.text()).toContain('First')
    expect(wrapper.text()).toContain('Second')
    expect(wrapper.text()).toContain('Third')
  })

  test('trigger shows the selected option label (single mode)', () => {
    const wrapper = mount(Select, { props: { options, modelValue: 'b' } })
    expect(wrapper.find('button').text()).toContain('Second')
  })

  test('trigger shows the placeholder when nothing is selected (multiple mode)', () => {
    const wrapper = mount(Select, { props: { options, modelValue: [], multiple: true, placeholder: 'Default' } })
    expect(wrapper.find('button').text()).toContain('Default')
  })

  test('trigger joins selected labels (multiple mode)', () => {
    const wrapper = mount(Select, { props: { options, modelValue: ['a', 'b'], multiple: true } })
    expect(wrapper.find('button').text()).toContain('First, Second')
  })

  test('passes `multiple` through to the underlying Listbox', () => {
    const wrapper = mount(Select, { props: { options, modelValue: [], multiple: true } })
    const listbox = wrapper.findComponent({ name: 'Listbox' })
    expect(listbox.props('multiple')).toBe(true)
  })

  test('propagates the Listbox selection as update:modelValue', async () => {
    const wrapper = mount(Select, { props: { options, modelValue: 'a' } })
    wrapper.findComponent({ name: 'Listbox' }).vm.$emit('update:modelValue', 'b')
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['b'])
  })
})
