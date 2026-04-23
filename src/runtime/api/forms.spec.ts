import { describe, expect, test } from 'vitest'
import Forms from './forms'

let formsByIdStoreState = {
  current: {
    byId: {},
  },
}

function createForms() {
  const mockResourcesStore = {
    useStore() {
      return formsByIdStoreState
    },
  }
  // @ts-expect-error
  const forms = new Forms(mockResourcesStore)

  return { forms, resourcesStore: mockResourcesStore }
}

describe('Forms', () => {
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
