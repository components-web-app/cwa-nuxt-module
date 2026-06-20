// @vitest-environment happy-dom
import { describe, expect, test, vi, beforeEach } from 'vitest'
import { computed, reactive, ref } from 'vue'
import { useCwaFormInput } from '#cwa/composables/cwa-form-input'

const mockGetForm = vi.hoisted(() => vi.fn())
const mockValidateField = vi.hoisted(() => vi.fn())
const mockIsSubmitAttempted = vi.hoisted(() => vi.fn().mockReturnValue(false))
const mockSetFieldValue = vi.hoisted(() => vi.fn())
const mockClearFieldValue = vi.hoisted(() => vi.fn())

vi.mock('#cwa/composables/cwa', () => ({
  useCwa: () => ({
    forms: {
      getForm: mockGetForm,
      validateField: mockValidateField,
      isSubmitAttempted: mockIsSubmitAttempted,
      setFieldValue: mockSetFieldValue,
      clearFieldValue: mockClearFieldValue,
    },
  }),
}))

function makeFormData(overrides: Record<string, any> = {}, rootMethod = 'PATCH') {
  return reactive({
    'contact_form': {
      vars: {
        full_name: 'contact_form',
        action: '/_/contact_requests',
        method: rootMethod,
      },
    },
    'contact_form[name]': {
      vars: {
        full_name: 'contact_form[name]',
        value: 'Alice',
        errors: [] as string[],
        valid: null as boolean | null,
        label: 'Name',
        required: true,
        action: '/_/contact_requests',
        ...overrides,
      },
    },
  })
}

describe('useCwaFormInput', () => {
  const iri = ref<string | undefined>('/_/form_components/123')

  beforeEach(() => {
    iri.value = '/_/form_components/123'
    vi.clearAllMocks()
  })

  describe('vars', () => {
    test('returns the ViewVars for the given fullName', () => {
      const formData = makeFormData()
      mockGetForm.mockReturnValue(computed(() => formData))
      const { vars } = useCwaFormInput(iri, 'contact_form[name]')
      expect(vars.value).toEqual(formData['contact_form[name]'].vars)
    })

    test('returns undefined when iri is undefined', () => {
      mockGetForm.mockReturnValue(computed(() => undefined))
      iri.value = undefined
      const { vars } = useCwaFormInput(iri, 'contact_form[name]')
      expect(vars.value).toBeUndefined()
    })

    test('returns undefined when the field key is not in the form', () => {
      const formData = makeFormData()
      mockGetForm.mockReturnValue(computed(() => formData))
      const { vars } = useCwaFormInput(iri, 'contact_form[missing]')
      expect(vars.value).toBeUndefined()
    })

    test('updates reactively when store form data changes', async () => {
      const formData = makeFormData()
      mockGetForm.mockReturnValue(computed(() => formData))
      const { vars } = useCwaFormInput(iri, 'contact_form[name]')
      expect(vars.value?.label).toBe('Name')
      formData['contact_form[name]'].vars.label = 'Full name'
      expect(vars.value?.label).toBe('Full name')
    })
  })

  describe('value', () => {
    test('is initialised from vars.value at creation', () => {
      const formData = makeFormData({ value: 'Alice' })
      mockGetForm.mockReturnValue(computed(() => formData))
      const { value } = useCwaFormInput(iri, 'contact_form[name]')
      expect(value.value).toBe('Alice')
    })

    test('is undefined when vars is undefined', () => {
      mockGetForm.mockReturnValue(computed(() => undefined))
      const { value } = useCwaFormInput(iri, 'contact_form[name]')
      expect(value.value).toBeUndefined()
    })

    test('is writable independently of the store', () => {
      const formData = makeFormData({ value: 'Alice' })
      mockGetForm.mockReturnValue(computed(() => formData))
      const { value } = useCwaFormInput(iri, 'contact_form[name]')
      value.value = 'Bob'
      expect(value.value).toBe('Bob')
      expect(formData['contact_form[name]'].vars.value).toBe('Alice')
    })

    test('resets to new vars.value when iri changes', async () => {
      const formData = makeFormData({ value: 'Alice' })
      mockGetForm.mockReturnValue(computed(() => formData))
      const { value } = useCwaFormInput(iri, 'contact_form[name]')
      value.value = 'Bob'
      expect(value.value).toBe('Bob')

      const newFormData = makeFormData({ value: 'Carol' })
      mockGetForm.mockReturnValue(computed(() => newFormData))
      iri.value = '/_/form_components/456'
      await new Promise(r => setTimeout(r, 0))
      expect(value.value).toBe('Carol')
    })
  })

  describe('errors', () => {
    test('returns vars.errors', () => {
      const formData = makeFormData({ errors: ['Required'] })
      mockGetForm.mockReturnValue(computed(() => formData))
      const { errors } = useCwaFormInput(iri, 'contact_form[name]')
      expect(errors.value).toEqual(['Required'])
    })

    test('returns empty array when vars has no errors', () => {
      const formData = makeFormData({ errors: [] })
      mockGetForm.mockReturnValue(computed(() => formData))
      const { errors } = useCwaFormInput(iri, 'contact_form[name]')
      expect(errors.value).toEqual([])
    })

    test('updates reactively when store errors change', () => {
      const formData = makeFormData({ errors: [] })
      mockGetForm.mockReturnValue(computed(() => formData))
      const { errors } = useCwaFormInput(iri, 'contact_form[name]')
      expect(errors.value).toEqual([])
      formData['contact_form[name]'].vars.errors = ['Too short']
      expect(errors.value).toEqual(['Too short'])
    })
  })

  describe('valid', () => {
    test('is null when vars.valid is null', () => {
      const formData = makeFormData({ valid: null })
      mockGetForm.mockReturnValue(computed(() => formData))
      const { valid } = useCwaFormInput(iri, 'contact_form[name]')
      expect(valid.value).toBeNull()
    })

    test('is true when vars.valid is true', () => {
      const formData = makeFormData({ valid: true })
      mockGetForm.mockReturnValue(computed(() => formData))
      const { valid } = useCwaFormInput(iri, 'contact_form[name]')
      expect(valid.value).toBe(true)
    })

    test('is false when vars.valid is false', () => {
      const formData = makeFormData({ valid: false })
      mockGetForm.mockReturnValue(computed(() => formData))
      const { valid } = useCwaFormInput(iri, 'contact_form[name]')
      expect(valid.value).toBe(false)
    })

    test('updates reactively', () => {
      const formData = makeFormData({ valid: null })
      mockGetForm.mockReturnValue(computed(() => formData))
      const { valid } = useCwaFormInput(iri, 'contact_form[name]')
      expect(valid.value).toBeNull()
      formData['contact_form[name]'].vars.valid = true
      expect(valid.value).toBe(true)
    })
  })

  describe('displayErrors', () => {
    test('is false initially', () => {
      const formData = makeFormData({ errors: ['Required'], valid: false })
      mockGetForm.mockReturnValue(computed(() => formData))
      const { displayErrors } = useCwaFormInput(iri, 'contact_form[name]')
      expect(displayErrors.value).toBe(false)
    })

    test('becomes true after onBlur()', () => {
      const formData = makeFormData()
      mockGetForm.mockReturnValue(computed(() => formData))
      const { displayErrors, onBlur } = useCwaFormInput(iri, 'contact_form[name]')
      expect(displayErrors.value).toBe(false)
      onBlur()
      expect(displayErrors.value).toBe(true)
    })

    test('becomes true when field was previously valid then becomes invalid, without blur', async () => {
      const formData = makeFormData({ valid: null })
      mockGetForm.mockReturnValue(computed(() => formData))
      const { displayErrors } = useCwaFormInput(iri, 'contact_form[name]')
      expect(displayErrors.value).toBe(false)

      formData['contact_form[name]'].vars.valid = true
      await new Promise(r => setTimeout(r, 0))

      formData['contact_form[name]'].vars.valid = false
      await new Promise(r => setTimeout(r, 0))
      expect(displayErrors.value).toBe(true)
    })

    test('stays false when invalid but never blurred and never previously valid', () => {
      const formData = makeFormData({ valid: false, errors: ['Bad'] })
      mockGetForm.mockReturnValue(computed(() => formData))
      const { displayErrors } = useCwaFormInput(iri, 'contact_form[name]')
      expect(displayErrors.value).toBe(false)
    })

    test('becomes true when isSubmitAttempted(iri) returns true', () => {
      const formData = makeFormData({ errors: ['Required'], valid: false })
      mockGetForm.mockReturnValue(computed(() => formData))
      mockIsSubmitAttempted.mockReturnValue(true)
      const { displayErrors } = useCwaFormInput(iri, 'contact_form[name]')
      expect(displayErrors.value).toBe(true)
    })
  })

  describe('onInput and validate', () => {
    test('validate is exported as a function', () => {
      const formData = makeFormData()
      mockGetForm.mockReturnValue(computed(() => formData))
      const { validate } = useCwaFormInput(iri, 'contact_form[name]')
      expect(typeof validate).toBe('function')
    })

    test('onInput is exported as a function', () => {
      const formData = makeFormData()
      mockGetForm.mockReturnValue(computed(() => formData))
      const { onInput } = useCwaFormInput(iri, 'contact_form[name]')
      expect(typeof onInput).toBe('function')
    })

    test('onInput calls validate after 300ms debounce', async () => {
      vi.useFakeTimers()
      const formData = makeFormData()
      mockGetForm.mockReturnValue(computed(() => formData))
      const result = useCwaFormInput(iri, 'contact_form[name]')
      const validateSpy = vi.fn()
      result.validate = validateSpy

      result.onInput()
      expect(validateSpy).not.toHaveBeenCalled()
      vi.advanceTimersByTime(299)
      expect(validateSpy).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1)
      expect(validateSpy).toHaveBeenCalledTimes(1)
      vi.useRealTimers()
    })

    test('rapid onInput calls are debounced to a single validate call', async () => {
      vi.useFakeTimers()
      const formData = makeFormData()
      mockGetForm.mockReturnValue(computed(() => formData))
      const result = useCwaFormInput(iri, 'contact_form[name]')
      const validateSpy = vi.fn()
      result.validate = validateSpy

      result.onInput()
      vi.advanceTimersByTime(100)
      result.onInput()
      vi.advanceTimersByTime(100)
      result.onInput()
      vi.advanceTimersByTime(300)
      expect(validateSpy).toHaveBeenCalledTimes(1)
      vi.useRealTimers()
    })

    test('validate calls forms.validateField with action and {[fullName]: value} for PATCH forms', async () => {
      const formData = makeFormData({ value: 'Alice' }, 'PATCH')
      mockGetForm.mockReturnValue(computed(() => formData))
      const { validate } = useCwaFormInput(iri, 'contact_form[name]')
      await validate()
      expect(mockValidateField).toHaveBeenCalledWith('/_/contact_requests', { 'contact_form[name]': 'Alice' })
    })

    test('validate merges extraData into the body', async () => {
      const formData = makeFormData({ value: 'abc' }, 'PATCH')
      mockGetForm.mockReturnValue(computed(() => formData))
      const { validate } = useCwaFormInput(iri, 'contact_form[name]')
      await validate({ 'contact_form[confirm]': 'abc' })
      expect(mockValidateField).toHaveBeenCalledWith('/_/contact_requests', {
        'contact_form[name]': 'abc',
        'contact_form[confirm]': 'abc',
      })
    })

    test('validate is a no-op for POST forms', async () => {
      const formData = makeFormData({ value: 'Alice' }, 'POST')
      mockGetForm.mockReturnValue(computed(() => formData))
      const { validate } = useCwaFormInput(iri, 'contact_form[name]')
      await validate()
      expect(mockValidateField).not.toHaveBeenCalled()
    })

    test('validate is a no-op when iri is undefined', async () => {
      iri.value = undefined
      mockGetForm.mockReturnValue(computed(() => undefined))
      const { validate } = useCwaFormInput(iri, 'contact_form[name]')
      await validate()
      expect(mockValidateField).not.toHaveBeenCalled()
    })
  })

  describe('fieldValues sync', () => {
    test('registers initial value with setFieldValue on creation', () => {
      const formData = makeFormData({ value: 'Alice' })
      mockGetForm.mockReturnValue(computed(() => formData))
      useCwaFormInput(iri, 'contact_form[name]')
      expect(mockSetFieldValue).toHaveBeenCalledWith('/_/form_components/123', 'contact_form[name]', 'Alice')
    })

    test('calls setFieldValue when value is updated', async () => {
      const formData = makeFormData({ value: 'Alice' })
      mockGetForm.mockReturnValue(computed(() => formData))
      const { value } = useCwaFormInput(iri, 'contact_form[name]')
      mockSetFieldValue.mockClear()
      value.value = 'Bob'
      await new Promise(r => setTimeout(r, 0))
      expect(mockSetFieldValue).toHaveBeenCalledWith('/_/form_components/123', 'contact_form[name]', 'Bob')
    })

    test('calls clearFieldValue for old iri and setFieldValue for new iri when iri changes', async () => {
      const formData = makeFormData({ value: 'Alice' })
      mockGetForm.mockReturnValue(computed(() => formData))
      useCwaFormInput(iri, 'contact_form[name]')
      mockSetFieldValue.mockClear()
      iri.value = '/_/form_components/456'
      await new Promise(r => setTimeout(r, 0))
      expect(mockClearFieldValue).toHaveBeenCalledWith('/_/form_components/123', 'contact_form[name]')
      expect(mockSetFieldValue).toHaveBeenCalledWith('/_/form_components/456', 'contact_form[name]', expect.anything())
    })
  })
})
