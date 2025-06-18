// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import InputField from './InputField.vue'

interface InputMeta {
  name: string
  label: string
  modelValue: string
  type?: string
  autocomplete?: string
  required?: boolean
  errors?: string[]
}

function createWrapper({
  name,
  label,
  modelValue,
  type = 'text',
  autocomplete = 'login',
  required = false,
  errors,
}: InputMeta) {
  return shallowMount(InputField, {
    props: {
      name,
      label,
      modelValue,
      type,
      autocomplete,
      required,
      errors,
    },
    global: {
      renderStubDefaultSlot: true,
    },
  })
}

describe('InputField', () => {
  describe('emits', () => {
    test('should emit updated value', async () => {
      const mockNewValue = 'new input value'
      const wrapper = createWrapper({
        name: 'login',
        label: 'Login',
        modelValue: '',
      })

      const input = wrapper.find('input')

      await input.setValue(mockNewValue)

      expect(wrapper.emitted('update:modelValue')).toEqual([[mockNewValue]])
    })
  })

  describe('props', () => {
    test('native input should accept value from modelValue prop', () => {
      const value = 'mock_user'
      const wrapper = createWrapper({
        name: 'login',
        label: 'Login',
        modelValue: value,
      })

      const input = wrapper.find('input')

      expect(input.element.value).toEqual(value)
    })
  })

  describe('snapshots', () => {
    test('should match snapshot with passed content', () => {
      const wrapper = createWrapper({
        name: 'login',
        label: 'Login',
        modelValue: '',
      })

      expect(wrapper.element).toMatchSnapshot()
    })

    test('should match snapshot IF input is marked as required', () => {
      const wrapper = createWrapper({
        name: 'login',
        label: 'Login',
        modelValue: '',
        required: true,
      })

      expect(wrapper.element).toMatchSnapshot()
    })

    test('should match snapshot IF input is of type password', () => {
      const wrapper = createWrapper({
        name: 'password',
        label: 'Password',
        autocomplete: 'password',
        modelValue: '',
        type: 'password',
      })

      expect(wrapper.element).toMatchSnapshot()
    })

    test('should match snapshot IF errors are present', () => {
      const wrapper = createWrapper({
        name: 'login',
        label: 'Login',
        modelValue: '',
        errors: ['Login should be minimum 6 characters long', 'Login cannot contain whitespaces'],
      })

      expect(wrapper.element).toMatchSnapshot()
    })
  })
})
