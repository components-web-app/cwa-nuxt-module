// @vitest-environment happy-dom
import { describe, expect, test, vi, beforeEach } from 'vitest'
import { computed, reactive, ref } from 'vue'
import { useCwaFormCollection } from '#cwa/composables/cwa-form-collection'

const mockGetForm = vi.hoisted(() => vi.fn())

vi.mock('#cwa/composables/cwa', () => ({
  useCwa: () => ({
    forms: { getForm: mockGetForm },
  }),
}))

function makeCollectionFormData(prototypeVarsOverrides: Record<string, any> = {}) {
  return reactive({
    'contact_form[tags]': {
      vars: {
        full_name: 'contact_form[tags]',
        allow_add: true,
        allow_delete: true,
        errors: [] as string[],
      },
      prototype: {
        vars: { full_name: 'contact_form[tags][__name__]', label: 'Tag', value: '', ...prototypeVarsOverrides },
        children: [],
      },
    },
  })
}

describe('useCwaFormCollection', () => {
  const iri = ref<string | undefined>('/_/form_components/123')

  beforeEach(() => {
    iri.value = '/_/form_components/123'
    vi.clearAllMocks()
  })

  describe('vars', () => {
    test('returns collection-level ViewVars', () => {
      const formData = makeCollectionFormData()
      mockGetForm.mockReturnValue(computed(() => formData))
      const { vars } = useCwaFormCollection(iri, 'contact_form[tags]')
      expect(vars.value?.full_name).toBe('contact_form[tags]')
      expect(vars.value?.allow_add).toBe(true)
    })

    test('returns undefined when iri is undefined', () => {
      iri.value = undefined
      mockGetForm.mockReturnValue(computed(() => undefined))
      const { vars } = useCwaFormCollection(iri, 'contact_form[tags]')
      expect(vars.value).toBeUndefined()
    })

    test('updates reactively when store data changes', () => {
      const formData = makeCollectionFormData()
      mockGetForm.mockReturnValue(computed(() => formData))
      const { vars } = useCwaFormCollection(iri, 'contact_form[tags]')
      expect(vars.value?.allow_add).toBe(true)
      formData['contact_form[tags]'].vars.allow_add = false
      expect(vars.value?.allow_add).toBe(false)
    })
  })

  describe('entries', () => {
    test('is empty initially', () => {
      const formData = makeCollectionFormData()
      mockGetForm.mockReturnValue(computed(() => formData))
      const { entries } = useCwaFormCollection(iri, 'contact_form[tags]')
      expect(entries.value).toEqual([])
    })

    test('is reactive — changes when addEntry is called', () => {
      const formData = makeCollectionFormData()
      mockGetForm.mockReturnValue(computed(() => formData))
      const { entries, addEntry } = useCwaFormCollection(iri, 'contact_form[tags]')
      expect(entries.value).toEqual([])
      addEntry()
      expect(entries.value).toHaveLength(1)
    })
  })

  describe('addEntry', () => {
    test('clones the prototype and pushes the root full_name with index 0', () => {
      const formData = makeCollectionFormData()
      mockGetForm.mockReturnValue(computed(() => formData))
      const { entries, addEntry } = useCwaFormCollection(iri, 'contact_form[tags]')
      addEntry()
      expect(entries.value).toEqual(['contact_form[tags][0]'])
    })

    test('second call uses index 1', () => {
      const formData = makeCollectionFormData()
      mockGetForm.mockReturnValue(computed(() => formData))
      const { entries, addEntry } = useCwaFormCollection(iri, 'contact_form[tags]')
      addEntry()
      addEntry()
      expect(entries.value).toEqual(['contact_form[tags][0]', 'contact_form[tags][1]'])
    })

    test('does not reuse indices after removeEntry', () => {
      const formData = makeCollectionFormData()
      mockGetForm.mockReturnValue(computed(() => formData))
      const { entries, addEntry, removeEntry } = useCwaFormCollection(iri, 'contact_form[tags]')
      addEntry()
      removeEntry('contact_form[tags][0]')
      addEntry()
      expect(entries.value).toEqual(['contact_form[tags][1]'])
    })

    test('is a no-op when prototype is absent from the form entry', () => {
      const formData = reactive({
        'contact_form[tags]': {
          vars: { full_name: 'contact_form[tags]', errors: [] as string[] },
          // no prototype property
        },
      })
      mockGetForm.mockReturnValue(computed(() => formData))
      const { entries, addEntry } = useCwaFormCollection(iri, 'contact_form[tags]')
      addEntry()
      expect(entries.value).toEqual([])
    })

    test('is a no-op when the form entry is undefined', () => {
      mockGetForm.mockReturnValue(computed(() => undefined))
      const { entries, addEntry } = useCwaFormCollection(iri, 'contact_form[tags]')
      addEntry()
      expect(entries.value).toEqual([])
    })

    test('replaces __name__ in nested children full_names', () => {
      const compoundPrototype = {
        vars: { full_name: 'form[items][__name__]', label: 'Item', value: '' },
        children: [
          { vars: { full_name: 'form[items][__name__][name]', label: 'Name', value: '' }, children: [] },
          { vars: { full_name: 'form[items][__name__][email]', label: 'Email', value: '' }, children: [] },
        ],
      }
      const formData = reactive({
        'form[items]': {
          vars: { full_name: 'form[items]', errors: [] as string[] },
          prototype: compoundPrototype,
        },
      })
      mockGetForm.mockReturnValue(computed(() => formData))
      const { entries, addEntry } = useCwaFormCollection(iri, 'form[items]')
      addEntry()
      expect(entries.value[0]).toBe('form[items][0]')
      addEntry()
      expect(entries.value[1]).toBe('form[items][1]')
    })

    test('does not mutate the original prototype', () => {
      const formData = makeCollectionFormData()
      mockGetForm.mockReturnValue(computed(() => formData))
      const { addEntry } = useCwaFormCollection(iri, 'contact_form[tags]')
      addEntry()
      expect(formData['contact_form[tags]'].prototype.vars.full_name).toBe('contact_form[tags][__name__]')
    })
  })

  describe('removeEntry', () => {
    test('removes the entry with the given fullName', () => {
      const formData = makeCollectionFormData()
      mockGetForm.mockReturnValue(computed(() => formData))
      const { entries, addEntry, removeEntry } = useCwaFormCollection(iri, 'contact_form[tags]')
      addEntry()
      addEntry()
      expect(entries.value).toHaveLength(2)
      removeEntry('contact_form[tags][0]')
      expect(entries.value).toEqual(['contact_form[tags][1]'])
    })

    test('is a no-op for an unknown fullName', () => {
      const formData = makeCollectionFormData()
      mockGetForm.mockReturnValue(computed(() => formData))
      const { entries, addEntry, removeEntry } = useCwaFormCollection(iri, 'contact_form[tags]')
      addEntry()
      removeEntry('contact_form[tags][99]')
      expect(entries.value).toHaveLength(1)
    })
  })
})
