// @vitest-environment happy-dom
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick, onBeforeUnmount } from 'vue'
import { useCwaResourceModel } from '#cwa/composables/cwa-resource-model'
import type { ModelEditor } from '#cwa/resources/model-editors'

vi.mock('vue', async () => {
  const mod = await vi.importActual<typeof import('vue')>('vue')
  return { ...mod, onBeforeUnmount: vi.fn(), getCurrentInstance: vi.fn().mockReturnValue(null) }
})

const mockGetResource = vi.hoisted(() => vi.fn())
const mockGetWaitForRequestPromise = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const mockUpdateResource = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const pendingUpdates = vi.hoisted(() => new Map<string, () => unknown>())
const mockRegisterPendingUpdate = vi.hoisted(() => vi.fn((iri: string, flush: () => unknown) => {
  pendingUpdates.set(iri, flush)
  return () => pendingUpdates.delete(iri)
}))

vi.mock('#cwa/composables/cwa', () => ({
  useCwa: () => ({
    resources: { getResource: mockGetResource },
    resourcesManager: {
      getWaitForRequestPromise: mockGetWaitForRequestPromise,
      updateResource: mockUpdateResource,
      registerPendingUpdate: mockRegisterPendingUpdate,
    },
  }),
}))

const registeredEditors = vi.hoisted(() => [] as unknown[])
const mockUnregisterEditor = vi.hoisted(() => vi.fn())
const mockRegisterModelEditor = vi.hoisted(() => vi.fn((_cwa: unknown, editor: unknown) => {
  registeredEditors.push(editor)
  return mockUnregisterEditor
}))
vi.mock('#cwa/resources/model-editors', () => ({
  registerModelEditor: mockRegisterModelEditor,
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
    pendingUpdates.clear()
    registeredEditors.length = 0
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
        data: { meta: { a: 99 } },
      }))
    })

    test('#298: a primitive assigned to a nested dot path PATCHes the whole root object, keeping its other fields', async () => {
      const existingAddress = { line1: '1 High Street', city: 'Leeds', postcode: 'LS1 1AA' }
      mockGetResource.mockReturnValue(ref({ data: { address: existingAddress } }))
      const { model } = useCwaResourceModel(iri, 'address.city')
      model.value = 'London' as any
      await flushDebounceAndAsync()
      expect(mockUpdateResource).toHaveBeenCalledTimes(1)
      expect(mockUpdateResource.mock.calls[0]![0].data).toEqual({
        address: { line1: '1 High Street', city: 'London', postcode: 'LS1 1AA' },
      })
      expect(existingAddress.city).toBe('Leeds')
    })

    test('an object assigned to a nested dot path is merged into the root object', async () => {
      mockGetResource.mockReturnValue(ref({ data: { meta: { existing: 'val' } } }))
      const { model } = useCwaResourceModel(iri, 'meta.extra')
      model.value = { key: 'value' } as any
      await flushDebounceAndAsync()
      expect(mockUpdateResource).toHaveBeenCalledWith(expect.objectContaining({
        data: { meta: { existing: 'val', extra: { key: 'value' } } },
      }))
    })

    test('a top-level property submits the new value alone without waiting on other requests', async () => {
      mockGetResource.mockReturnValue(ref({ data: { title: 'Store', address: { city: 'Leeds' } } }))
      const { model } = useCwaResourceModel(iri, 'title')
      model.value = 'NewValue'
      await flushDebounceAndAsync()
      expect(mockGetWaitForRequestPromise).not.toHaveBeenCalled()
      expect(mockUpdateResource).toHaveBeenCalledWith(expect.objectContaining({
        data: { title: 'NewValue' },
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

    test('a waiting save is sent at once when a publish asks for it, and only once (#394)', async () => {
      mockGetResource.mockReturnValue(ref({ data: { title: 'Store' } }))
      const { model } = useCwaResourceModel(iri, 'title')
      model.value = 'Last keystroke'
      await nextTick()
      expect(mockRegisterPendingUpdate).toHaveBeenCalledWith('/my/resource', expect.any(Function))
      await pendingUpdates.get('/my/resource')!()
      expect(mockUpdateResource).toHaveBeenCalledOnce()
      expect(mockUpdateResource).toHaveBeenCalledWith(expect.objectContaining({ data: { title: 'Last keystroke' } }))
      expect(pendingUpdates.has('/my/resource')).toBe(false)
      await flushDebounceAndAsync()
      expect(mockUpdateResource).toHaveBeenCalledOnce()
    })

    test('sets isLongWait after longWaitThreshold when busy', async () => {
      mockGetResource.mockReturnValue(ref({ data: { title: 'Store' } }))
      mockUpdateResource.mockImplementation(() => new Promise(() => {}))
      const { model, states } = useCwaResourceModel(iri, 'title', { longWaitThreshold: 100 })
      model.value = 'New'
      await nextTick()
      vi.runAllTimers()
      await nextTick()
      expect(states.isLongWait.value).toBe(true)
    })
  })

  describe('co-editing: the model is an editor the real-time layer can read and hold (#429)', () => {
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

    function createModel(property: string | string[] = 'title', data: Record<string, unknown> = { title: 'Store' }) {
      mockGetResource.mockReturnValue(ref({ data }))
      const model = useCwaResourceModel<any>(iri, property)
      expect(mockRegisterModelEditor).toHaveBeenCalledOnce()
      return { ...model, editor: registeredEditors.at(-1) as ModelEditor }
    }

    test('registers an editor for the root field of its IRI, and unregisters it on unmount', () => {
      const { editor } = createModel('meta.a', { meta: { a: 1 } })

      expect(editor.iri()).toBe('/my/resource')
      expect(editor.field()).toBe('meta')
      expect(editor.value({ '@id': '/my/resource', '@type': 'T', 'meta': { a: 7 } })).toBe(7)

      const unmount = vi.mocked(onBeforeUnmount).mock.calls.at(-1)![0]
      unmount()
      expect(mockUnregisterEditor).toHaveBeenCalledOnce()
    })

    test('focus() and blur() are reported to the editor', () => {
      const { editor, focus, blur } = createModel()

      expect(editor.focused()).toBe(false)
      focus()
      expect(editor.focused()).toBe(true)
      blur()
      expect(editor.focused()).toBe(false)
    })

    test('the editor has a local change from the first keystroke until the value is reset', () => {
      const { editor, model, resetValue } = createModel()

      expect(editor.hasLocalChange()).toBe(false)
      model.value = 'Mine'
      expect(editor.hasLocalChange()).toBe(true)
      resetValue()
      expect(editor.hasLocalChange()).toBe(false)
    })

    test('a conflict is exposed as remoteChange only while the model shows the IRI it was raised for', () => {
      const { editor, remoteChange } = createModel()
      const change = { value: 'Theirs', accept: vi.fn(), keep: vi.fn() }

      editor.conflict({ iri: '/my/resource', change })
      expect(remoteChange.value).toBe(change)

      iri.value = '/other'
      expect(remoteChange.value).toBeUndefined()

      iri.value = '/my/resource'
      editor.conflict(undefined)
      expect(remoteChange.value).toBeUndefined()
    })

    test('the save is held while a conflict is shown, and submit() sends the local value', async () => {
      const { editor, model } = createModel()
      model.value = 'Mine'
      editor.conflict({ iri: '/my/resource', change: { value: 'Theirs', accept: vi.fn(), keep: vi.fn() } })

      await flushDebounceAndAsync()
      expect(mockUpdateResource).not.toHaveBeenCalled()

      editor.conflict(undefined)
      await editor.submit()
      expect(mockUpdateResource).toHaveBeenCalledOnce()
      expect(mockUpdateResource).toHaveBeenCalledWith(expect.objectContaining({ data: { title: 'Mine' } }))
    })

    test('discardLocal() cancels the waiting save and its pending registration, and shows the store value', async () => {
      const { editor, model } = createModel()
      model.value = 'Mine'
      await nextTick()
      expect(pendingUpdates.has('/my/resource')).toBe(true)

      editor.discardLocal()

      expect(pendingUpdates.has('/my/resource')).toBe(false)
      expect(model.value).toBe('Store')
      await flushDebounceAndAsync()
      expect(mockUpdateResource).not.toHaveBeenCalled()
    })

    test('localPatch() is the root value a save would send, merging a nested property into its root', () => {
      const { editor, model } = createModel('address.city', { address: { line1: '1 High Street', city: 'Leeds' } })
      model.value = 'London'

      expect(editor.localPatch()).toEqual({ line1: '1 High Street', city: 'London' })
    })
  })
})
