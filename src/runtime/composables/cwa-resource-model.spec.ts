// @vitest-environment happy-dom
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useCwaResourceModel } from '#cwa/composables/cwa-resource-model'

vi.mock('vue', async () => {
  const mod = await vi.importActual<typeof import('vue')>('vue')
  return { ...mod, onBeforeUnmount: vi.fn(), getCurrentInstance: vi.fn().mockReturnValue(null) }
})

const mockGetResource = vi.hoisted(() => vi.fn())
const mockGetWaitForRequestPromise = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const mockUpdateResource = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

vi.mock('#cwa/composables/cwa', () => ({
  useCwa: () => ({
    resources: { getResource: mockGetResource },
    resourcesManager: {
      getWaitForRequestPromise: mockGetWaitForRequestPromise,
      updateResource: mockUpdateResource,
    },
  }),
}))

// vi.hoisted runs before imports — use a plain object with .value instead of Vue ref
const mockEndpoint = vi.hoisted(() => ({ value: '/my/resource' }))

vi.mock('#cwa/composables/cwa-resource-endpoint', () => ({
  useCwaResourceEndpoint: () => ({ endpoint: mockEndpoint }),
}))

describe('useCwaResourceModel', () => {
  const iri = ref<string | undefined>('/my/resource')

  beforeEach(() => {
    iri.value = '/my/resource'
    mockEndpoint.value = '/my/resource'
    vi.clearAllMocks()
    mockGetResource.mockReturnValue(ref(undefined))
    mockUpdateResource.mockResolvedValue(undefined)
  })

  describe('model getter', () => {
    test('returns null when resource is undefined (deleted)', () => {
      mockGetResource.mockReturnValue(ref(undefined))
      const { model } = useCwaResourceModel(iri, 'title')
      expect(model.value).toBeNull()
    })

    test('returns storeValue from resource data', () => {
      mockGetResource.mockReturnValue(ref({ data: { title: 'Hello' } }))
      const { model } = useCwaResourceModel(iri, 'title')
      expect(model.value).toBe('Hello')
    })

    test('returns null when storeValue is undefined', () => {
      mockGetResource.mockReturnValue(ref({ data: {} }))
      const { model } = useCwaResourceModel(iri, 'title')
      expect(model.value).toBeNull()
    })

    test('returns localValue over storeValue when localValue is set', () => {
      mockGetResource.mockReturnValue(ref({ data: { title: 'Store' } }))
      const { model } = useCwaResourceModel(iri, 'title')
      model.value = 'Local'
      expect(model.value).toBe('Local')
    })

    test('returns null (not undefined) for localValue set to null', () => {
      mockGetResource.mockReturnValue(ref({ data: { title: 'Hello' } }))
      const { model } = useCwaResourceModel(iri, 'title')
      model.value = null
      expect(model.value).toBeNull()
    })
  })

  describe('model setter and pending state', () => {
    test('sets pendingSubmit to true when model is changed', async () => {
      mockGetResource.mockReturnValue(ref({ data: { title: 'Store' } }))
      const { model, states } = useCwaResourceModel(iri, 'title')
      model.value = 'New'
      await nextTick()
      expect(states.pendingSubmit.value).toBe(true)
    })

    test('isBusy reflects pendingSubmit', async () => {
      mockGetResource.mockReturnValue(ref({ data: { title: 'Store' } }))
      const { model, states } = useCwaResourceModel(iri, 'title')
      model.value = 'New'
      await nextTick()
      expect(states.isBusy.value).toBe(true)
    })
  })

  describe('resetValue', () => {
    test('clears localValueWithIri for current iri', () => {
      mockGetResource.mockReturnValue(ref({ data: { title: 'Store' } }))
      const { model, resetValue, localValueWithIri } = useCwaResourceModel(iri, 'title')
      model.value = 'Local'
      expect(localValueWithIri.value['/my/resource']).toBe('Local')
      resetValue()
      expect(localValueWithIri.value['/my/resource']).toBeUndefined()
    })

    test('clears localValueWithIri for a specific iri', () => {
      mockGetResource.mockReturnValue(ref({ data: { title: 'Store' } }))
      const { model, resetValue, localValueWithIri } = useCwaResourceModel(iri, 'title')
      model.value = 'Local'
      resetValue('/my/resource')
      expect(localValueWithIri.value['/my/resource']).toBeUndefined()
    })

    test('does nothing when iri is undefined', () => {
      iri.value = undefined
      const { resetValue } = useCwaResourceModel(iri, 'title')
      expect(() => resetValue()).not.toThrow()
    })
  })

  describe('rootProperty', () => {
    test('extracts root property from dot-notation string', () => {
      mockGetResource.mockReturnValue(ref({ data: { address: { street: '123 Main' } } }))
      const { model } = useCwaResourceModel(iri, 'address.street')
      expect(model.value).toBe('123 Main')
    })

    test('extracts root property from array path', () => {
      mockGetResource.mockReturnValue(ref({ data: { address: { street: '123 Main' } } }))
      const { model } = useCwaResourceModel(iri, ['address', 'street'])
      expect(model.value).toBe('123 Main')
    })
  })

  describe('iri is undefined', () => {
    test('model returns null when iri is not set', () => {
      iri.value = undefined
      const { model } = useCwaResourceModel(iri, 'title')
      expect(model.value).toBeNull()
    })
  })

  describe('rootProperty and updateResource flow', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    async function flushDebounceAndAsync() {
      await nextTick()
      vi.runAllTimers()
      await nextTick()
      await nextTick()
    }

    test('uses array[0] as root key when property is an array', async () => {
      mockGetResource.mockReturnValue(ref({ data: { meta: { a: 1 } } }))
      const { model } = useCwaResourceModel(iri, ['meta', 'a'])
      model.value = 99 as any
      await flushDebounceAndAsync()
      expect(mockUpdateResource).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ meta: expect.anything() }),
      }))
    })

    test('uses dot-notation prefix as root key', async () => {
      mockGetResource.mockReturnValue(ref({ data: { meta: { a: 1 } } }))
      const { model } = useCwaResourceModel(iri, 'meta.a')
      model.value = 99 as any
      await flushDebounceAndAsync()
      expect(mockUpdateResource).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ meta: expect.anything() }),
      }))
    })

    test('does not call updateResource when iri is undefined', async () => {
      iri.value = undefined
      mockGetResource.mockReturnValue(ref({ data: { title: 'Store' } }))
      const { model } = useCwaResourceModel(iri, 'title')
      model.value = 'New'
      await flushDebounceAndAsync()
      expect(mockUpdateResource).not.toHaveBeenCalled()
    })

    test('skips update and resets when resource is undefined', async () => {
      mockGetResource.mockReturnValue(ref<any>(undefined))
      const { model, localValueWithIri } = useCwaResourceModel(iri, 'title')
      model.value = 'New'
      await flushDebounceAndAsync()
      expect(mockUpdateResource).not.toHaveBeenCalled()
      expect(localValueWithIri.value['/my/resource']).toBeUndefined()
    })

    test('skips update when value equals store value', async () => {
      mockGetResource.mockReturnValue(ref({ data: { title: 'Store' } }))
      const { model } = useCwaResourceModel(iri, 'title')
      model.value = 'Store'
      await flushDebounceAndAsync()
      expect(mockUpdateResource).not.toHaveBeenCalled()
    })

    test('calls updateResource with scalar value', async () => {
      mockGetResource.mockReturnValue(ref({ data: { title: 'Store' } }))
      const { model } = useCwaResourceModel(iri, 'title')
      model.value = 'NewValue'
      await flushDebounceAndAsync()
      expect(mockUpdateResource).toHaveBeenCalledWith(expect.objectContaining({
        endpoint: '/my/resource',
        data: { title: 'NewValue' },
      }))
    })

    test('calls getWaitForRequestPromise for nested object property', async () => {
      mockGetResource.mockReturnValue(ref({ data: { meta: { existing: 'val' } } }))
      const { model } = useCwaResourceModel(iri, 'meta.extra')
      model.value = { key: 'value' } as any
      await flushDebounceAndAsync()
      expect(mockGetWaitForRequestPromise).toHaveBeenCalled()
      expect(mockUpdateResource).toHaveBeenCalled()
    })

    test('transfers localValue to new IRI when response returns different IRI', async () => {
      mockGetResource.mockReturnValue(ref({ data: { title: 'Old' } }))
      mockUpdateResource.mockResolvedValue({ '@id': '/my/new-resource', 'title': 'New' })
      const { model, localValueWithIri } = useCwaResourceModel(iri, 'title')
      model.value = 'New'
      await flushDebounceAndAsync()
      expect(localValueWithIri.value['/my/new-resource']).toBe('New')
    })

    test('sets isLongWait after longWaitThreshold when busy', async () => {
      mockGetResource.mockReturnValue(ref({ data: { title: 'Store' } }))
      mockUpdateResource.mockImplementation(() => new Promise(() => {})) // never resolves
      const { model, states } = useCwaResourceModel(iri, 'title', { longWaitThreshold: 100 })
      model.value = 'New'
      await nextTick()
      vi.runAllTimers() // fires debounce + longWait timer
      await nextTick()
      // after running all timers, longWait should be set
      expect(states.isLongWait.value).toBe(true)
    })
  })
})
