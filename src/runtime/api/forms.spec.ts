import { computed } from 'vue'
import { describe, expect, test, vi, beforeEach } from 'vitest'
import Forms from './forms'

let formsByIdStoreState = {
  current: {
    byId: {},
  },
}

function createForms(opts: { fetchFn?: ReturnType<typeof vi.fn> } = {}) {
  const mockSaveResource = vi.fn()
  const mockStore: any = {
    get current() { return formsByIdStoreState.current },
    saveResource: mockSaveResource,
  }
  const mockResourcesStore = {
    useStore() {
      return mockStore
    },
  }
  const fetchFn = opts.fetchFn ?? vi.fn()
  const mockCwaFetch: any = { fetch: fetchFn }
  // @ts-expect-error
  const forms = new Forms(mockResourcesStore, mockCwaFetch)

  return { forms, resourcesStore: mockStore, mockCwaFetch, fetchFn }
}

describe('Forms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    formsByIdStoreState = { current: { byId: {} } }
  })

  describe('submitAttempted', () => {
    test('isSubmitAttempted returns false by default', () => {
      const { forms } = createForms()
      expect(forms.isSubmitAttempted('/_/contact/1')).toBe(false)
    })

    test('isSubmitAttempted returns true after setSubmitAttempted(iri, true)', () => {
      const { forms } = createForms()
      forms.setSubmitAttempted('/_/contact/1', true)
      expect(forms.isSubmitAttempted('/_/contact/1')).toBe(true)
    })

    test('isSubmitAttempted returns false after setSubmitAttempted(iri, false)', () => {
      const { forms } = createForms()
      forms.setSubmitAttempted('/_/contact/1', true)
      forms.setSubmitAttempted('/_/contact/1', false)
      expect(forms.isSubmitAttempted('/_/contact/1')).toBe(false)
    })

    test('isSubmitAttempted is reactive inside computed', () => {
      const { forms } = createForms()
      const isAttempted = computed(() => forms.isSubmitAttempted('/_/contact/1'))
      expect(isAttempted.value).toBe(false)
      forms.setSubmitAttempted('/_/contact/1', true)
      expect(isAttempted.value).toBe(true)
    })
  })

  describe('fieldValues', () => {
    test('getFieldValues returns empty object for unknown iri', () => {
      const { forms } = createForms()
      expect(forms.getFieldValues('/_/contact/1')).toEqual({})
    })

    test('setFieldValue stores a value keyed by fullName', () => {
      const { forms } = createForms()
      forms.setFieldValue('/_/contact/1', 'contact_form[name]', 'Alice')
      expect(forms.getFieldValues('/_/contact/1')).toEqual({ 'contact_form[name]': 'Alice' })
    })

    test('clearFieldValue removes a stored value', () => {
      const { forms } = createForms()
      forms.setFieldValue('/_/contact/1', 'contact_form[name]', 'Alice')
      forms.clearFieldValue('/_/contact/1', 'contact_form[name]')
      expect(forms.getFieldValues('/_/contact/1')).toEqual({})
    })

    test('getFieldValues is reactive inside computed', () => {
      const { forms } = createForms()
      const values = computed(() => forms.getFieldValues('/_/contact/1'))
      expect(values.value).toEqual({})
      forms.setFieldValue('/_/contact/1', 'contact_form[name]', 'Alice')
      expect(values.value).toEqual({ 'contact_form[name]': 'Alice' })
    })

    test('stores values for multiple iris independently', () => {
      const { forms } = createForms()
      forms.setFieldValue('/_/contact/1', 'contact_form[name]', 'Alice')
      forms.setFieldValue('/_/contact/2', 'contact_form[name]', 'Bob')
      expect(forms.getFieldValues('/_/contact/1')).toEqual({ 'contact_form[name]': 'Alice' })
      expect(forms.getFieldValues('/_/contact/2')).toEqual({ 'contact_form[name]': 'Bob' })
    })
  })

  describe('validateField', () => {
    test('PATCHes the endpoint with the given body', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ '@id': '/_/contact/1' })
      const { forms } = createForms({ fetchFn })
      await forms.validateField('/_/contact/1', { 'contact_form[name]': 'Alice' })
      expect(fetchFn).toHaveBeenCalledWith('/_/contact/1', expect.objectContaining({
        method: 'PATCH',
        body: { 'contact_form[name]': 'Alice' },
      }))
    })

    test('saves successful response to store', async () => {
      const resource = { '@id': '/_/contact/1', 'formView': {} }
      const fetchFn = vi.fn().mockResolvedValue(resource)
      const { forms, resourcesStore } = createForms({ fetchFn })
      await forms.validateField('/_/contact/1', {})
      expect(resourcesStore.saveResource).toHaveBeenCalledWith({ resource })
    })

    test('saves error response data to store on fetch failure', async () => {
      const errorData = { '@id': '/_/contact/1', 'formView': { vars: { errors: ['Invalid'] } } }
      const fetchFn = vi.fn().mockRejectedValue({ data: errorData })
      const { forms, resourcesStore } = createForms({ fetchFn })
      await forms.validateField('/_/contact/1', {})
      expect(resourcesStore.saveResource).toHaveBeenCalledWith({ resource: errorData })
    })

    test('swallows errors that have no response data', async () => {
      const fetchFn = vi.fn().mockRejectedValue(new Error('Network error'))
      const { forms, resourcesStore } = createForms({ fetchFn })
      await expect(forms.validateField('/_/contact/1', {})).resolves.toBeUndefined()
      expect(resourcesStore.saveResource).not.toHaveBeenCalled()
    })
  })

  describe('submitForm', () => {
    test('sends the correct method and body', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ '@id': '/_/contact_requests/1' })
      const { forms } = createForms({ fetchFn })
      await forms.submitForm('/_/contact_requests', { 'contact_form[name]': 'Alice' }, 'POST')
      expect(fetchFn).toHaveBeenCalledWith('/_/contact_requests', expect.objectContaining({
        method: 'POST',
        body: { 'contact_form[name]': 'Alice' },
      }))
    })

    test('uses merge-patch content-type for PATCH method', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ '@id': '/_/contact_requests/1' })
      const { forms } = createForms({ fetchFn })
      await forms.submitForm('/_/contact_requests/1', {}, 'PATCH')
      expect(fetchFn).toHaveBeenCalledWith('/_/contact_requests/1', expect.objectContaining({
        headers: expect.objectContaining({ 'content-type': 'application/merge-patch+json' }),
      }))
    })

    test('returns { success: true } and saves resource on success', async () => {
      const resource = { '@id': '/_/contact_requests/1' }
      const fetchFn = vi.fn().mockResolvedValue(resource)
      const { forms, resourcesStore } = createForms({ fetchFn })
      const result = await forms.submitForm('/_/contact_requests', {}, 'POST')
      expect(result).toEqual({ success: true })
      expect(resourcesStore.saveResource).toHaveBeenCalledWith({ resource })
    })

    test('returns { success: false, formErrors } and saves error response on 422', async () => {
      const errorData = { '@id': '/_/contact_requests', 'formView': { vars: { errors: ['Fix this'] } } }
      const fetchFn = vi.fn().mockRejectedValue({ data: errorData })
      const { forms, resourcesStore } = createForms({ fetchFn })
      const result = await forms.submitForm('/_/contact_requests', {}, 'POST')
      expect(result).toEqual({ success: false, formErrors: ['Fix this'] })
      expect(resourcesStore.saveResource).toHaveBeenCalledWith({ resource: errorData })
    })

    test('returns empty formErrors when 422 has no root errors', async () => {
      const errorData = { '@id': '/_/contact_requests', 'formView': {} }
      const fetchFn = vi.fn().mockRejectedValue({ data: errorData })
      const { forms } = createForms({ fetchFn })
      const result = await forms.submitForm('/_/contact_requests', {}, 'POST')
      expect(result).toEqual({ success: false, formErrors: [] })
    })

    test('returns { success: false } on non-API error', async () => {
      const fetchFn = vi.fn().mockRejectedValue(new Error('Network error'))
      const { forms, resourcesStore } = createForms({ fetchFn })
      const result = await forms.submitForm('/_/contact_requests', {}, 'POST')
      expect(result).toEqual({ success: false })
      expect(resourcesStore.saveResource).not.toHaveBeenCalled()
    })
  })

  describe('get form', () => {
    test('should return nothing IF requested resource does not exist', () => {
      const iri = 'i do not exist'
      const { forms } = createForms()

      expect(forms.getForm(iri).value).toBeUndefined()
    })

    test('should return nothing IF requested resource is NOT of type Form', () => {
      const iri = 'mockIri'

      formsByIdStoreState = {
        current: {
          byId: {
            [iri]: {
              data: {
                '@type': 'Component',
              },
            },
          },
        },
      }

      const { forms } = createForms()

      expect(forms.getForm(iri).value).toBeUndefined()
    })

    test('should return formatted form data IF requested resource is found AND is of type form', () => {
      const iri = 'mockIri'

      formsByIdStoreState = {
        current: {
          byId: {
            [iri]: {
              data: {
                '@type': 'Form',
                'formView': {
                  vars: {
                    full_name: 'form full name',
                    depth: 0,
                  },
                  children: [
                    {
                      vars: {
                        full_name: 'child full name',
                        depth: 1,
                      },
                      children: [{
                        vars: {
                          full_name: 'grandchild full name',
                          depth: 2,
                        },
                      }],
                    },
                    {
                      vars: {
                        full_name: 'second child full name',
                        depth: 1,
                      },
                      children: [],
                    },
                  ],
                },
              },
            },
          },
        },
      }

      const { forms } = createForms()

      expect(forms.getForm(iri).value).toEqual({
        'form full name': {
          vars: {
            full_name: 'form full name',
            depth: 0,
          },
        },
        'child full name': {
          vars: {
            full_name: 'child full name',
            depth: 1,
          },
        },
        'grandchild full name': {
          vars: {
            full_name: 'grandchild full name',
            depth: 2,
          },
        },
        'second child full name': {
          vars: {
            full_name: 'second child full name',
            depth: 1,
          },
        },
      })
    })
  })

  describe('get form view errors', () => {
    test('should return errors BASED on form data AND field', () => {
      const iri = 'mockIri'
      const mockErrors = ['oops', ':(']

      formsByIdStoreState = {
        current: {
          byId: {
            [iri]: {
              data: {
                '@type': 'Form',
                'formView': {
                  vars: {
                    full_name: 'test_form',
                    errors: mockErrors,
                  },
                },
              },
            },
          },
        },
      }

      const { forms } = createForms()

      expect(forms.getFormViewErrors(iri, 'test_form').value).toEqual(mockErrors)
    })

    test('should return nothing IF no there are no errors present', () => {
      const iri = 'mockIri'

      formsByIdStoreState = {
        current: {
          byId: {
            [iri]: {
              data: {
                '@type': 'Form',
                'formView': {
                  vars: {
                    full_name: 'test_form',
                  },
                },
              },
            },
          },
        },
      }

      const { forms } = createForms()

      expect(forms.getFormViewErrors(iri, 'test_form').value).toBeUndefined()
    })
  })
})
