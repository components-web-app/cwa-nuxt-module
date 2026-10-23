// @vitest-environment happy-dom
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick, onBeforeUnmount, shallowRef } from 'vue'
import { useCwaResourceModel } from '#cwa/composables/cwa-resource-model'
import type { ModelEditor } from '#cwa/resources/model-editors'

vi.mock('vue', async () => {
  const mod = await vi.importActual<typeof import('vue')>('vue')
  return { ...mod, onBeforeUnmount: vi.fn(), getCurrentInstance: vi.fn().mockReturnValue(null) }
})

const mockGetResource = vi.hoisted(() => vi.fn())
const mockGetWaitForRequestPromise = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const mockUpdateResource = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const pendingUpdates = vi.hoisted(() => new Map<string, (keepConflict?: boolean) => unknown>())
const mockRegisterPendingUpdate = vi.hoisted(() => vi.fn((iri: string, flush: (keepConflict?: boolean) => unknown) => {
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

const realtime = vi.hoisted(() => ({
  view: { value: undefined as unknown },
  load: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('#cwa/resources/realtime-view', () => ({ realtimeView: () => realtime }))

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

    test.each([
      ['its debounce', async () => {
        vi.runAllTimers()
      }],
      ['a publish asking for it (#394)', async () => {
        await pendingUpdates.get('/my/resource')!()
      }],
    ])('a change typed on one IRI and sent, by %s, after another window\'s save moved the field to its draft, is never sent again when the field moves back', async (_by, send) => {
      mockGetResource.mockReturnValue(ref({ data: { title: 'Store' } }))
      const shown = ref('/my/resource')
      const { model, localValueWithIri } = useCwaResourceModel(shown, 'title')
      model.value = 'Typed on live'
      await nextTick()
      shown.value = '/my/resource-draft'
      await nextTick()

      await send()
      await flushDebounceAndAsync()
      expect(mockUpdateResource).toHaveBeenCalledOnce()
      shown.value = '/my/resource'
      await flushDebounceAndAsync()

      expect(mockUpdateResource).toHaveBeenCalledOnce()
      expect(localValueWithIri.value['/my/resource']).toBeUndefined()
    })

    test('a second keystroke before the save goes out keeps showing what was typed, and only that is sent', async () => {
      mockGetResource.mockReturnValue(ref({ data: { title: 'Store' } }))
      const shown = ref('/my/resource')
      const { model } = useCwaResourceModel(shown, 'title')
      model.value = 'T'
      await nextTick()
      model.value = 'Ty'
      await nextTick()

      expect(model.value).toBe('Ty')
      await flushDebounceAndAsync()
      expect(mockUpdateResource).toHaveBeenCalledOnce()
      expect(mockUpdateResource).toHaveBeenCalledWith(expect.objectContaining({ data: { title: 'Ty' } }))
    })

    test('a change typed on one IRI and overtaken by typing after another window\'s save moved the field to its draft is never sent when the field moves back', async () => {
      mockGetResource.mockReturnValue(ref({ data: { title: 'Store' } }))
      const shown = ref('/my/resource')
      const { model, localValueWithIri } = useCwaResourceModel(shown, 'title')
      model.value = 'Typed on live'
      await nextTick()
      shown.value = '/my/resource-draft'
      await nextTick()
      model.value = 'Typed on the draft'
      await flushDebounceAndAsync()
      expect(mockUpdateResource).toHaveBeenCalledOnce()

      shown.value = '/my/resource'
      await flushDebounceAndAsync()

      expect(mockUpdateResource).toHaveBeenCalledOnce()
      expect(mockUpdateResource).toHaveBeenCalledWith(expect.objectContaining({ data: { title: 'Typed on the draft' } }))
      expect(localValueWithIri.value['/my/resource']).toBeUndefined()
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

    test('Keep mine chosen while the refused save is still settling sends the local value again, and the model keeps showing it', async () => {
      const { editor, model } = createModel()
      let refuse!: () => void
      mockUpdateResource.mockReturnValueOnce(new Promise((resolve) => {
        refuse = () => resolve(undefined)
      }))
      model.value = 'Mine'
      await flushDebounceAndAsync()
      expect(mockUpdateResource).toHaveBeenCalledOnce()

      editor.conflict({ iri: '/my/resource', change: { value: 'Theirs', accept: vi.fn(), keep: vi.fn() } })
      editor.conflict(undefined)
      const resent = editor.submit()
      refuse()
      await resent

      expect(mockUpdateResource).toHaveBeenCalledTimes(2)
      expect(mockUpdateResource).toHaveBeenLastCalledWith(expect.objectContaining({ data: { title: 'Mine' } }))
      expect(model.value).toBe('Mine')
    })

    test('a save held by a conflict stays unsent after its debounce has run, so the conflict clearing can send it', async () => {
      const { editor, model } = createModel()
      model.value = 'Mine'
      editor.conflict({ iri: '/my/resource', change: { value: 'Theirs', accept: vi.fn(), keep: vi.fn() } })
      await flushDebounceAndAsync()

      editor.conflict(undefined)
      expect(editor.hasUnsentChange()).toBe(true)
      await editor.submit()

      expect(mockUpdateResource).toHaveBeenCalledOnce()
      expect(mockUpdateResource).toHaveBeenCalledWith(expect.objectContaining({ data: { title: 'Mine' } }))
    })

    test('a change is unsent until its save goes out, and again once typed over while that save is in flight', async () => {
      const { editor, model } = createModel()
      let finishSave!: () => void
      mockUpdateResource.mockReturnValueOnce(new Promise((resolve) => {
        finishSave = () => resolve(undefined)
      }))

      model.value = 'Mine'
      expect(editor.hasUnsentChange()).toBe(true)
      await flushDebounceAndAsync()
      expect(mockUpdateResource).toHaveBeenCalledOnce()
      expect(editor.hasUnsentChange()).toBe(false)
      expect(editor.hasLocalChange()).toBe(true)

      model.value = 'Mine again'
      await nextTick()
      expect(editor.hasUnsentChange()).toBe(true)
      finishSave()
    })

    test('adopt() replaces the local value and saves it like a keystroke', async () => {
      const { editor, model } = createModel()

      editor.adopt('Theirs')
      expect(model.value).toBe('Theirs')
      await flushDebounceAndAsync()

      expect(mockUpdateResource).toHaveBeenCalledOnce()
      expect(mockUpdateResource).toHaveBeenCalledWith(expect.objectContaining({ data: { title: 'Theirs' } }))
    })

    test('a publish flushing the held save while a conflict is shown keeps the local value', async () => {
      const { editor, model } = createModel()
      model.value = 'Mine'
      await nextTick()
      const keep = vi.fn().mockResolvedValue(undefined)
      editor.conflict({ iri: '/my/resource', change: { value: 'Theirs', accept: vi.fn(), keep } })

      await pendingUpdates.get('/my/resource')!()

      expect(keep).toHaveBeenCalledOnce()
    })

    test('a flush that does not keep conflicts, as a presence page link sends, leaves a held conflict for the editor to choose and saves nothing (#429)', async () => {
      const { editor, model } = createModel()
      model.value = 'Mine'
      await nextTick()
      const keep = vi.fn().mockResolvedValue(undefined)
      editor.conflict({ iri: '/my/resource', change: { value: 'Theirs', accept: vi.fn(), keep } })

      await pendingUpdates.get('/my/resource')!(false)
      await flushDebounceAndAsync()

      expect(keep).not.toHaveBeenCalled()
      expect(mockUpdateResource).not.toHaveBeenCalled()
    })

    test('a flush that does not keep conflicts still sends a waiting save with no conflict (#429)', async () => {
      const { model } = createModel()
      model.value = 'Mine'
      await nextTick()

      await pendingUpdates.get('/my/resource')!(false)

      expect(mockUpdateResource).toHaveBeenCalledOnce()
      expect(mockUpdateResource).toHaveBeenCalledWith(expect.objectContaining({ data: { title: 'Mine' } }))
    })

    test('a conflict left on an earlier IRI does not hold the saves of the IRI the model shows now', async () => {
      const { editor, model } = createModel()
      editor.conflict({ iri: '/my/resource', change: { value: 'Theirs', accept: vi.fn(), keep: vi.fn() } })

      iri.value = '/other'
      model.value = 'Other edit'
      await flushDebounceAndAsync()

      expect(mockUpdateResource).toHaveBeenCalledOnce()
      expect(mockUpdateResource).toHaveBeenCalledWith(expect.objectContaining({ data: { title: 'Other edit' } }))
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

  describe('field focus for co-editing presence (#429)', () => {
    const SAM = { user: { id: '/users/sam', name: 'Sam' }, colour: '#c084fc' }

    function presenceView() {
      return { focus: vi.fn(), blur: vi.fn(), focusedBy: vi.fn((on: string, field: string) => on === '/my/resource' && field === 'meta' ? [SAM] : []) }
    }

    beforeEach(() => {
      realtime.view = shallowRef()
      realtime.load.mockResolvedValue(undefined)
    })

    test('focus() reports the model\'s IRI and root field to the real-time view, and blur() clears that same focus', async () => {
      const presence = presenceView()
      realtime.load.mockResolvedValue(presence)
      const { focus, blur } = useCwaResourceModel(iri, 'meta.a')

      focus()
      await vi.waitFor(() => expect(presence.focus).toHaveBeenCalledOnce())
      const [owner, focusedIri, field] = presence.focus.mock.calls[0]!
      expect([focusedIri, field]).toStrictEqual(['/my/resource', 'meta'])

      blur()
      await vi.waitFor(() => expect(presence.blur).toHaveBeenCalledExactlyOnceWith(owner))
    })

    test('each model reports focus as its own owner', async () => {
      const presence = presenceView()
      realtime.load.mockResolvedValue(presence)
      useCwaResourceModel(iri, 'title').focus()
      useCwaResourceModel(iri, 'title').focus()

      await vi.waitFor(() => expect(presence.focus).toHaveBeenCalledTimes(2))
      expect(presence.focus.mock.calls[0]![0]).not.toBe(presence.focus.mock.calls[1]![0])
    })

    test('focus() with no IRI reports nothing', async () => {
      const presence = presenceView()
      realtime.load.mockResolvedValue(presence)
      iri.value = undefined
      useCwaResourceModel(iri, 'title').focus()
      await nextTick()
      await Promise.resolve()

      expect(presence.focus).not.toHaveBeenCalled()
    })

    test('unmounting blurs the field', async () => {
      const presence = presenceView()
      realtime.load.mockResolvedValue(presence)
      useCwaResourceModel(iri, 'title')

      vi.mocked(onBeforeUnmount).mock.calls.at(-1)![0]()

      await vi.waitFor(() => expect(presence.blur).toHaveBeenCalledOnce())
    })

    describe('focusListeners, bound on the root of the field\'s editor', () => {
      function editorRoot() {
        const root = document.createElement('div')
        const inner = document.createElement('button')
        const outside = document.createElement('button')
        root.append(inner)
        document.body.append(root, outside)
        return { root, inner, outside }
      }

      function bind(root: HTMLElement, listeners: Record<string, (event: any) => void>) {
        root.addEventListener('focusin', listeners.onFocusin!)
        root.addEventListener('focusout', listeners.onFocusout!)
        root.addEventListener('pointerdown', listeners.onPointerdown!)
      }

      const pointerdown = (on: Element) => on.dispatchEvent(new Event('pointerdown', { bubbles: true }))
      const focusout = (from: Element, to: Element | null) => from.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: to }))
      const settled = () => new Promise(resolve => setTimeout(resolve))

      afterEach(() => {
        document.body.innerHTML = ''
      })

      test('focus moving in reports focus, moving within the editor keeps it, and leaving it blurs', async () => {
        const presence = presenceView()
        realtime.load.mockResolvedValue(presence)
        const { root, inner, outside } = editorRoot()
        bind(root, useCwaResourceModel(iri, 'title').focusListeners)

        inner.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
        focusout(inner, root)
        await settled()
        expect(presence.focus).toHaveBeenCalledOnce()
        expect(presence.blur).not.toHaveBeenCalled()

        focusout(inner, outside)
        await settled()
        expect(presence.blur).toHaveBeenCalledOnce()
      })

      test('a button that takes no focus on click (Safari) reports focus on pointerdown and blurs on the next pointerdown outside, once', async () => {
        const presence = presenceView()
        realtime.load.mockResolvedValue(presence)
        const { root, inner, outside } = editorRoot()
        bind(root, useCwaResourceModel(iri, 'title').focusListeners)

        pointerdown(inner)
        pointerdown(inner)
        await settled()
        expect(presence.focus).toHaveBeenCalledWith(expect.anything(), '/my/resource', 'title')
        expect(presence.blur).not.toHaveBeenCalled()

        pointerdown(outside)
        await settled()
        expect(presence.blur).toHaveBeenCalledOnce()

        pointerdown(outside)
        await settled()
        expect(presence.blur).toHaveBeenCalledOnce()
      })

      test('a pointerdown outside that leaves focus in the editor, as on its own menu rendered elsewhere, keeps the focus until focus leaves', async () => {
        const presence = presenceView()
        realtime.load.mockResolvedValue(presence)
        const { root, inner, outside } = editorRoot()
        bind(root, useCwaResourceModel(iri, 'title').focusListeners)

        pointerdown(inner)
        inner.focus()
        pointerdown(outside)
        await settled()
        expect(document.activeElement).toBe(inner)
        expect(presence.blur).not.toHaveBeenCalled()

        outside.focus()
        await settled()
        expect(presence.blur).toHaveBeenCalledOnce()
      })

      test('after focus leaves by keyboard, a later pointerdown outside does not blur again', async () => {
        const presence = presenceView()
        realtime.load.mockResolvedValue(presence)
        const { root, inner, outside } = editorRoot()
        bind(root, useCwaResourceModel(iri, 'title').focusListeners)

        pointerdown(inner)
        focusout(inner, outside)
        pointerdown(outside)
        await settled()

        expect(presence.blur).toHaveBeenCalledOnce()
      })

      test('unmounting stops watching for a pointerdown outside', async () => {
        const presence = presenceView()
        realtime.load.mockResolvedValue(presence)
        const { root, inner, outside } = editorRoot()
        bind(root, useCwaResourceModel(iri, 'title').focusListeners)

        pointerdown(inner)
        vi.mocked(onBeforeUnmount).mock.calls.at(-1)![0]()
        pointerdown(outside)
        await settled()

        expect(presence.blur).toHaveBeenCalledOnce()
      })
    })

    test('focusedBy is empty until the real-time view has loaded, then lists who has this field of this IRI focused', () => {
      const { focusedBy } = useCwaResourceModel(iri, 'meta.a')
      expect(focusedBy.value).toStrictEqual([])

      realtime.view.value = presenceView()
      expect(focusedBy.value).toStrictEqual([SAM])

      iri.value = '/my/other'
      expect(focusedBy.value).toStrictEqual([])
    })
  })
})
