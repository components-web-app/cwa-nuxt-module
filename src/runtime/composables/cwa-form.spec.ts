// @vitest-environment happy-dom
import { describe, expect, test, vi, beforeEach } from 'vitest'
import { computed, reactive, ref } from 'vue'
import { useCwaForm } from '#cwa/composables/cwa-form'

const mockGetForm = vi.hoisted(() => vi.fn())
const mockGetFieldValues = vi.hoisted(() => vi.fn().mockReturnValue({}))
const mockSubmitForm = vi.hoisted(() => vi.fn())
const mockSetSubmitAttempted = vi.hoisted(() => vi.fn())

vi.mock('#cwa/composables/cwa', () => ({
  useCwa: () => ({
    forms: {
      getForm: mockGetForm,
      getFieldValues: mockGetFieldValues,
      submitForm: mockSubmitForm,
      setSubmitAttempted: mockSetSubmitAttempted,
    },
  }),
}))

function makeFormStore(method = 'POST') {
  return reactive({
    'contact_form': {
      vars: {
        full_name: 'contact_form',
        action: '/_/contact_requests',
        method,
        errors: [] as string[],
      },
    },
    'contact_form[name]': {
      vars: { full_name: 'contact_form[name]', value: 'Alice', errors: [] as string[] },
    },
    'contact_form[email]': {
      vars: { full_name: 'contact_form[email]', value: '', errors: [] as string[] },
    },
  })
}

describe('useCwaForm', () => {
  const iri = ref<string | undefined>('/_/form_components/123')

  beforeEach(() => {
    iri.value = '/_/form_components/123'
    vi.clearAllMocks()
    mockSubmitForm.mockResolvedValue({ success: true })
    mockGetFieldValues.mockReturnValue({ 'contact_form[name]': 'Alice' })
  })

  describe('submit', () => {
    test('calls submitForm with action, fieldValues, and method from root form vars', async () => {
      const formStore = makeFormStore('POST')
      mockGetForm.mockReturnValue(computed(() => formStore))
      const { submit } = useCwaForm(iri)
      await submit()
      expect(mockSubmitForm).toHaveBeenCalledWith(
        '/_/contact_requests',
        { 'contact_form[name]': 'Alice' },
        'POST',
      )
    })

    test('uses PATCH method when root form vars.method is PATCH', async () => {
      const formStore = makeFormStore('PATCH')
      mockGetForm.mockReturnValue(computed(() => formStore))
      const { submit } = useCwaForm(iri)
      await submit()
      expect(mockSubmitForm).toHaveBeenCalledWith(
        '/_/contact_requests',
        expect.any(Object),
        'PATCH',
      )
    })

    test('is a no-op when iri is undefined', async () => {
      iri.value = undefined
      const { submit } = useCwaForm(iri)
      await submit()
      expect(mockSubmitForm).not.toHaveBeenCalled()
    })

    test('is a no-op when form has no root vars', async () => {
      mockGetForm.mockReturnValue(computed(() => undefined))
      const { submit } = useCwaForm(iri)
      await submit()
      expect(mockSubmitForm).not.toHaveBeenCalled()
    })

    test('sets submitting to true while awaiting and false after', async () => {
      const formStore = makeFormStore()
      mockGetForm.mockReturnValue(computed(() => formStore))
      let submittingDuring = false
      mockSubmitForm.mockImplementation(async () => {
        submittingDuring = true
        return { success: true }
      })
      const { submit, submitting } = useCwaForm(iri)
      const promise = submit()
      expect(submitting.value).toBe(true)
      await promise
      expect(submitting.value).toBe(false)
      expect(submittingDuring).toBe(true)
    })

    test('sets success to true on successful submit', async () => {
      const formStore = makeFormStore()
      mockGetForm.mockReturnValue(computed(() => formStore))
      mockSubmitForm.mockResolvedValue({ success: true })
      const { submit, success } = useCwaForm(iri)
      await submit()
      expect(success.value).toBe(true)
    })

    test('clears submitAttempted on successful submit', async () => {
      const formStore = makeFormStore()
      mockGetForm.mockReturnValue(computed(() => formStore))
      mockSubmitForm.mockResolvedValue({ success: true })
      const { submit } = useCwaForm(iri)
      await submit()
      expect(mockSetSubmitAttempted).toHaveBeenCalledWith('/_/form_components/123', false)
    })

    test('sets submitAttempted on failed submit', async () => {
      const formStore = makeFormStore()
      mockGetForm.mockReturnValue(computed(() => formStore))
      mockSubmitForm.mockResolvedValue({ success: false, formErrors: ['Error'] })
      const { submit } = useCwaForm(iri)
      await submit()
      expect(mockSetSubmitAttempted).toHaveBeenCalledWith('/_/form_components/123', true)
    })

    test('does not set success on failed submit', async () => {
      const formStore = makeFormStore()
      mockGetForm.mockReturnValue(computed(() => formStore))
      mockSubmitForm.mockResolvedValue({ success: false })
      const { submit, success } = useCwaForm(iri)
      await submit()
      expect(success.value).toBe(false)
    })
  })

  describe('formErrors', () => {
    test('returns empty array initially', () => {
      const formStore = makeFormStore()
      mockGetForm.mockReturnValue(computed(() => formStore))
      const { formErrors } = useCwaForm(iri)
      expect(formErrors.value).toEqual([])
    })

    test('returns root form vars.errors reactively from store', () => {
      const formStore = makeFormStore()
      mockGetForm.mockReturnValue(computed(() => formStore))
      const { formErrors } = useCwaForm(iri)
      expect(formErrors.value).toEqual([])
      formStore.contact_form.vars.errors = ['Form error']
      expect(formErrors.value).toEqual(['Form error'])
    })

    test('returns empty array when iri is undefined', () => {
      iri.value = undefined
      mockGetForm.mockReturnValue(computed(() => undefined))
      const { formErrors } = useCwaForm(iri)
      expect(formErrors.value).toEqual([])
    })
  })

  describe('unregisteredFieldErrors', () => {
    test('returns empty array when all field errors belong to registered fields', () => {
      const formStore = makeFormStore()
      mockGetForm.mockReturnValue(computed(() => formStore))
      // name is registered, email is registered
      mockGetFieldValues.mockReturnValue({ 'contact_form[name]': 'Alice', 'contact_form[email]': '' })
      const { unregisteredFieldErrors } = useCwaForm(iri)
      formStore['contact_form[name]'].vars.errors = ['Name error']
      expect(unregisteredFieldErrors.value).toEqual([])
    })

    test('returns errors for fields in formView that are not registered', () => {
      const formStore = makeFormStore()
      mockGetForm.mockReturnValue(computed(() => formStore))
      // Only name is registered; email is NOT registered
      mockGetFieldValues.mockReturnValue({ 'contact_form[name]': 'Alice' })
      formStore['contact_form[email]'].vars.errors = ['Email is required']
      const { unregisteredFieldErrors } = useCwaForm(iri)
      expect(unregisteredFieldErrors.value).toEqual(['Email is required'])
    })

    test('does not include root form errors (those belong to formErrors)', () => {
      const formStore = makeFormStore()
      mockGetForm.mockReturnValue(computed(() => formStore))
      mockGetFieldValues.mockReturnValue({})
      formStore['contact_form'].vars.errors = ['Root error']
      const { unregisteredFieldErrors } = useCwaForm(iri)
      expect(unregisteredFieldErrors.value).toEqual([])
    })

    test('updates reactively when store errors change', () => {
      const formStore = makeFormStore()
      mockGetForm.mockReturnValue(computed(() => formStore))
      mockGetFieldValues.mockReturnValue({})
      const { unregisteredFieldErrors } = useCwaForm(iri)
      expect(unregisteredFieldErrors.value).toEqual([])
      formStore['contact_form[email]'].vars.errors = ['Email is required']
      expect(unregisteredFieldErrors.value).toEqual(['Email is required'])
    })

    test('returns empty array when iri is undefined', () => {
      iri.value = undefined
      mockGetForm.mockReturnValue(computed(() => undefined))
      const { unregisteredFieldErrors } = useCwaForm(iri)
      expect(unregisteredFieldErrors.value).toEqual([])
    })
  })

  describe('submitting', () => {
    test('starts as false', () => {
      const formStore = makeFormStore()
      mockGetForm.mockReturnValue(computed(() => formStore))
      const { submitting } = useCwaForm(iri)
      expect(submitting.value).toBe(false)
    })
  })

  describe('success', () => {
    test('starts as false', () => {
      const formStore = makeFormStore()
      mockGetForm.mockReturnValue(computed(() => formStore))
      const { success } = useCwaForm(iri)
      expect(success.value).toBe(false)
    })
  })
})
