// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import Form from './Form.vue'

const mocks = vi.hoisted(() => ({
  useCwaComponent: vi.fn(),
  useCwaForm: vi.fn(),
  useCwaFormInput: vi.fn(),
}))

vi.mock('#cwa/composables/cwa-component', () => ({ useCwaComponent: mocks.useCwaComponent }))
vi.mock('#cwa/composables/cwa-form', () => ({ useCwaForm: mocks.useCwaForm }))
vi.mock('#cwa/composables/cwa-form-input', () => ({ useCwaFormInput: mocks.useCwaFormInput }))

const child = (fullName: string, blockPrefixes: string[]) => ({ vars: { full_name: fullName, block_prefixes: blockPrefixes } })

const labels: Record<string, string> = {
  'example_form[text]': 'Your name',
  'example_form[email]': 'Your email',
  'example_form[message]': 'Message',
}

const submit = vi.fn()

beforeEach(() => {
  mocks.useCwaComponent.mockReturnValue({
    resource: ref({
      data: {
        '@type': 'Form',
        'formView': {
          children: [
            child('example_form[text]', ['form', 'text', '_example_form_text']),
            child('example_form[subject]', ['form', 'choice', '_example_form_subject']),
            child('example_form[email]', ['form', 'text', 'email', '_example_form_email']),
            child('example_form[message]', ['form', 'text', 'textarea', '_example_form_message']),
            child('example_form[randomCheckbox]', ['form', 'checkbox', '_example_form_randomCheckbox']),
            child('example_form[submit]', ['button', 'submit', '_example_form_submit']),
          ],
        },
      },
    }),
    exposeMeta: {},
  })
  mocks.useCwaForm.mockReturnValue({ submit, submitting: ref(false), success: ref(false), formErrors: ref([]) })
  mocks.useCwaFormInput.mockImplementation((_iri, fullName: string) => ({
    value: ref(''),
    vars: ref({ label: labels[fullName], id: fullName.replace(/\W+/g, '_') }),
    errors: ref([]),
    displayErrors: ref(false),
    onBlur: vi.fn(),
    onInput: vi.fn(),
  }))
})

describe('the module\'s Form renderer', () => {
  test('a Form resource with no uiComponent renders its text fields with the form composables', async () => {
    const wrapper = mount(Form, { props: { iri: '/component/forms/1' } })

    expect(mocks.useCwaFormInput.mock.calls.map(([, fullName]) => fullName)).toEqual([
      'example_form[text]',
      'example_form[email]',
      'example_form[message]',
    ])
    expect(wrapper.findAll('label').map(label => label.text())).toEqual(['Your name', 'Your email', 'Message'])
    expect(wrapper.find('input[type="email"]').exists()).toBe(true)
    expect(wrapper.findAll('textarea')).toHaveLength(1)

    await wrapper.find('form').trigger('submit')
    expect(submit).toHaveBeenCalled()
  })
})
