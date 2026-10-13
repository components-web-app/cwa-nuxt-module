// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { createSSRApp, defineComponent, h, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
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

function inputParent(model: { value: string }) {
  return defineComponent({
    render: () => h(InputField, {
      'name': 'username',
      'label': 'Username',
      'modelValue': model.value,
      'onUpdate:modelValue': (value: string) => {
        model.value = value
      },
    }),
  })
}

async function hydrateWithValueFilledBeforeHydration(initialModel: string, filledValue: string) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  container.innerHTML = await renderToString(createSSRApp(inputParent({ value: initialModel })))
  const input = container.querySelector('input') as HTMLInputElement
  input.value = filledValue
  const model = ref(initialModel)
  createSSRApp(inputParent(model)).mount(container)
  await flushPromises()
  return { input, model }
}

describe('InputField', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  describe('a value filled into the server-rendered input before hydration', () => {
    test('is kept in the input and written to the model, as a password manager autofill on /login needs', async () => {
      const { input, model } = await hydrateWithValueFilledBeforeHydration('', 'autofilled-user')

      expect(input.value).toBe('autofilled-user')
      expect(model.value).toBe('autofilled-user')
    })

    test('does not emit when the input still holds the server-rendered value', async () => {
      const emitted: string[] = []
      const container = document.createElement('div')
      document.body.appendChild(container)
      container.innerHTML = await renderToString(createSSRApp(inputParent({ value: 'mock_user' })))
      createSSRApp(inputParent({
        get value() {
          return 'mock_user'
        },
        set value(value: string) {
          emitted.push(value)
        },
      })).mount(container)
      await flushPromises()

      expect(emitted).toEqual([])
    })

    test('a client-side mount does not overwrite the model with the empty new input', () => {
      const wrapper = createWrapper({
        name: 'login',
        label: 'Login',
        modelValue: 'mock_user',
      })

      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
      expect(wrapper.find('input').element.value).toBe('mock_user')
    })
  })

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
