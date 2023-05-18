// @vitest-environment nuxt
import { describe, expect, test, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import InputField from './InputField.vue'

vi.mock('uuid', () => ({
  v4 () {
    return 'this-is-unique-string'
  }
}))

interface IInputMeta {
  name: string;
  label: string;
  modelValue: string;
  type?: string;
  autocomplete?: string;
  required?: boolean;
  errors?: string[];
}

function createWrapper ({
  name,
  label,
  modelValue,
  type = 'text',
  autocomplete = 'login',
  required = false,
  errors
}: IInputMeta) {
  return shallowMount(InputField, {
    props: {
      name,
      label,
      modelValue,
      type,
      autocomplete,
      required,
      errors
    },
    global: {
      renderStubDefaultSlot: true
    }
  })
}

describe('InputField', () => {
  describe('emits', () => {
    test('should emit updated value', async () => {
      const mockNewValue = 'new input value'
      const wrapper = createWrapper({
        name: 'login',
        label: 'Login',
        modelValue: ''
      })

      const input = wrapper.find('input')

      await input.setValue(mockNewValue)

      expect(wrapper.emitted('update:modelValue')).toEqual([[mockNewValue]])
    })
  })

  describe('snapshots', () => {
    test('should match snapshot with passed content', () => {
      const wrapper = createWrapper({
        name: 'login',
        label: 'Login',
        modelValue: ''
      })

      expect(wrapper.element).toMatchSnapshot()
    })

    test('should match snapshot IF errors are present', () => {
      const wrapper = createWrapper({
        name: 'login',
        label: 'Login',
        modelValue: '',
        errors: ['Login should be minimum 6 characters long', 'Login cannot contain whitespaces']
      })

      expect(wrapper.element).toMatchSnapshot()
    })
  })
})
