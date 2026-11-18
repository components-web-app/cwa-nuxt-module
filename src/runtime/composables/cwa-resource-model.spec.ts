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

async function microtasks() {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve()
  }
}

function recordedSaves() {
  const answers: ((outcome: { resource?: unknown, error?: unknown }) => void)[] = []
  mockUpdateResource.mockImplementation((event: { endpoint: string, onRequest?: (iri: string, done: Promise<unknown>) => void }) => new Promise((resolve) => {
    let settle!: (outcome: unknown) => void
    const done = new Promise((answered) => {
      settle = answered
    })
    event.onRequest?.(event.endpoint.split('?')[0]!, done)
    answers.push((outcome) => {
      settle(outcome)
      resolve(outcome.resource)
    })
  }))
  return answers
}

describe('useCwaResourceModel', () => {
  test('carries the resource and root field it edits, following the IRI, so an in-page editor and the bar\'s handoff find each other (#461)', () => {
    mockGetResource.mockReturnValue({ value: undefined })
    const iri = ref<string | undefined>('/component/1')
    const { editorKey } = useCwaResourceModel(iri, 'seo.title')

    expect(editorKey.field).toBe('seo')
    expect(editorKey.iri()).toBe('/component/1')
    iri.value = '/component/1-draft'
    expect(editorKey.iri()).toBe('/component/1-draft')
  })

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

  describe('one request in flight per model, with the newest value queued (#458)', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    function deferredSaves() {
      const answers: ((resource?: unknown) => void)[] = []
      mockUpdateResource.mockImplementation(() => new Promise((resolve) => {
        answers.push(resolve)
      }))
      return answers
    }

    async function type(model: { value: unknown }, value: string) {
      model.value = value
      await nextTick()
      vi.runAllTimers()
      await nextTick()
    }

    test('a change whose debounce runs while a save is in flight waits for it, and only the newest value is sent next', async () => {
      mockGetResource.mockReturnValue(ref({ data: { title: 'Store' } }))
      const answers = deferredSaves()
      const { model, states } = useCwaResourceModel(iri, 'title')

      await type(model, 'A')
      await type(model, 'AB')
      await type(model, 'ABC')
      expect(mockUpdateResource).toHaveBeenCalledOnce()
      expect(states.pendingSubmit.value).toBe(true)

      answers[0]!(undefined)
      await microtasks()
      expect(mockUpdateResource).toHaveBeenCalledTimes(2)
      expect(mockUpdateResource.mock.calls.map(([event]) => event.data)).toStrictEqual([{ title: 'A' }, { title: 'ABC' }])
      expect(states.pendingSubmit.value).toBe(false)
      expect(states.submitting.value).toBe(true)

      answers[1]!(undefined)
      await microtasks()
      expect(states.submitting.value).toBe(false)
      expect(mockUpdateResource).toHaveBeenCalledTimes(2)
    })

    test('the follow-up is sent to the draft the previous save returned', async () => {
      const resources: Record<string, unknown> = {
        '/my/resource': { data: { '@id': '/my/resource', 'title': 'Live' } },
        '/my/draft': { data: { '@id': '/my/draft', 'title': 'A' } },
      }
      mockGetResource.mockImplementation((at: string) => ref(resources[at]))
      mockEndpoint.value = '/my/resource?published=false'
      const answers = deferredSaves()
      const { model } = useCwaResourceModel(iri, 'title')

      await type(model, 'A')
      await type(model, 'AB')
      answers[0]!({ '@id': '/my/draft', 'title': 'A' })
      await microtasks()
      expect(mockUpdateResource).toHaveBeenCalledTimes(2)

      expect(mockUpdateResource.mock.calls.map(([event]) => [event.endpoint, event.data])).toStrictEqual([
        ['/my/resource?published=false', { title: 'A' }],
        ['/my/draft', { title: 'AB' }],
      ])
      answers[1]!(undefined)
    })

    test('a queued value the previous save already stored is not sent again', async () => {
      const stored = ref({ data: { title: 'Store' } })
      mockGetResource.mockReturnValue(stored)
      const answers = deferredSaves()
      const { model, states } = useCwaResourceModel(iri, 'title')

      await type(model, 'A')
      await type(model, 'AB')
      await type(model, 'A')
      stored.value = { data: { title: 'A' } }
      answers[0]!({ '@id': '/my/resource', 'title': 'A' })
      await microtasks()
      expect(states.submitting.value).toBe(false)

      expect(mockUpdateResource).toHaveBeenCalledOnce()
      expect(states.pendingSubmit.value).toBe(false)
    })

    test('a publish flushing the waiting saves resolves only once the queued follow-up has settled (#394)', async () => {
      mockGetResource.mockReturnValue(ref({ data: { title: 'Store' } }))
      const answers = deferredSaves()
      const { model } = useCwaResourceModel(iri, 'title')

      await type(model, 'A')
      await type(model, 'AB')
      expect(pendingUpdates.has('/my/resource')).toBe(true)
      let flushed = false
      const flush = Promise.resolve(pendingUpdates.get('/my/resource')!()).then(() => {
        flushed = true
      })

      answers[0]!(undefined)
      await microtasks()
      expect(mockUpdateResource).toHaveBeenCalledTimes(2)
      await Promise.resolve()
      expect(flushed).toBe(false)

      answers[1]!(undefined)
      await flush
      expect(flushed).toBe(true)
    })

    test('the queued value keeps its publish registration until it is sent', async () => {
      mockGetResource.mockReturnValue(ref({ data: { title: 'Store' } }))
      const answers = deferredSaves()
      const { model } = useCwaResourceModel(iri, 'title')

      await type(model, 'A')
      expect(pendingUpdates.has('/my/resource')).toBe(false)
      await type(model, 'AB')
      expect(pendingUpdates.has('/my/resource')).toBe(true)

      answers[0]!(undefined)
      await microtasks()
      expect(mockUpdateResource).toHaveBeenCalledTimes(2)
      expect(pendingUpdates.has('/my/resource')).toBe(false)
      answers[1]!(undefined)
    })

    test('submit() sends at once while a save is in flight, even with the same value, and drops the queued one', async () => {
      mockGetResource.mockReturnValue(ref({ data: { title: 'Store' } }))
      const answers = deferredSaves()
      const { model } = useCwaResourceModel(iri, 'title')
      const editor = registeredEditors.at(-1) as ModelEditor

      await type(model, 'A')
      await type(model, 'AB')
      model.value = 'A'
      await nextTick()
      const submitted = editor.submit()
      expect(mockUpdateResource).toHaveBeenCalledTimes(2)
      expect(mockUpdateResource).toHaveBeenLastCalledWith(expect.objectContaining({ data: { title: 'A' } }))

      answers[0]!(undefined)
      answers[1]!(undefined)
      await submitted
      await microtasks()
      expect(pendingUpdates.size).toBe(0)
      vi.runAllTimers()
      await nextTick()
      expect(mockUpdateResource).toHaveBeenCalledTimes(2)
    })

    test('a queued value is held while a conflict is shown, and Keep mine sends it', async () => {
      mockGetResource.mockReturnValue(ref({ data: { title: 'Store' } }))
      const answers = deferredSaves()
      const { model } = useCwaResourceModel(iri, 'title')
      const editor = registeredEditors.at(-1) as ModelEditor

      await type(model, 'A')
      await type(model, 'AB')
      editor.conflict({ iri: '/my/resource', change: { name: 'Mia', value: 'Theirs', accept: vi.fn(), keep: vi.fn() } })
      answers[0]!(undefined)
      await microtasks()
      expect(editor.hasUnsentChange()).toBe(true)
      expect(pendingUpdates.has('/my/resource')).toBe(true)
      await nextTick()
      expect(mockUpdateResource).toHaveBeenCalledOnce()

      editor.conflict(undefined)
      const kept = editor.submit()
      answers[1]!(undefined)
      await kept
      expect(mockUpdateResource).toHaveBeenLastCalledWith(expect.objectContaining({ data: { title: 'AB' } }))
    })
  })

  describe('typed mapping, validation and extra fields for the bar controls (#460)', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    test('a typed mapping shows the stored value through get and stores what is set through set', async () => {
      mockGetResource.mockReturnValue(ref({ data: { price: 1250 } }))
      const { model } = useCwaResourceModel<number, number>(iri, 'price', { get: pence => pence === null || pence === undefined ? pence : pence / 100, set: pounds => pounds === null || pounds === undefined ? pounds : Math.round(pounds * 100) })

      expect(model.value).toBe(12.5)
      model.value = 13
      await nextTick()
      vi.runAllTimers()
      await microtasks()

      expect(mockUpdateResource).toHaveBeenCalledWith(expect.objectContaining({ data: { price: 1300 } }))
    })

    test('a typed mapping shows the held remote value mapped too', async () => {
      mockGetResource.mockReturnValue(ref({ data: { price: 1250 } }))
      const { remoteChange } = useCwaResourceModel<number, number>(iri, 'price', { get: pence => (pence ?? 0) / 100 })
      const editor = registeredEditors.at(-1) as ModelEditor

      editor.conflict({ iri: '/my/resource', change: { name: 'Mia', value: 900, accept: vi.fn(), keep: vi.fn() } })

      expect(remoteChange.value?.value).toBe(9)
    })

    test('a value that is not valid waits silently: nothing is sent and the field holds no state', async () => {
      const resource = ref<any>({ data: { rawPath: null } })
      mockGetResource.mockReturnValue(resource)
      const { model, state } = useCwaResourceModel<string>(iri, 'rawPath', { valid: value => !!value?.startsWith('/') })

      model.value = 'about us'
      await nextTick()
      vi.runAllTimers()
      await microtasks()

      expect(mockUpdateResource).not.toHaveBeenCalled()
      expect(state.value.status).toBe('idle')
      expect(model.value).toBe('about us')
      expect(pendingUpdates.size).toBe(0)

      model.value = '/about'
      await nextTick()
      vi.runAllTimers()
      await microtasks()

      expect(mockUpdateResource).toHaveBeenCalledWith(expect.objectContaining({ data: { rawPath: '/about' } }))
    })

    test('extra fields are sent in the same request, read when it is sent', async () => {
      const resource = ref<any>({ data: { rawPath: null, route: '/_/routes/a' } })
      mockGetResource.mockReturnValue(resource)
      const alsoSend = vi.fn(() => ({ route: null }))
      const { model } = useCwaResourceModel<string>(iri, 'rawPath', { alsoSend })

      model.value = '/about'
      await nextTick()
      expect(alsoSend).not.toHaveBeenCalled()
      vi.runAllTimers()
      await microtasks()

      expect(mockUpdateResource).toHaveBeenCalledTimes(1)
      expect(alsoSend).toHaveBeenCalledWith('/about', '/my/resource')
      expect(mockUpdateResource).toHaveBeenCalledWith(expect.objectContaining({ data: { rawPath: '/about', route: null } }))
    })

    test('a value equal to the stored one is still sent when it carries extra fields', async () => {
      mockGetResource.mockReturnValue(ref<any>({ data: { route: '/_/routes/a', rawPath: '/old' } }))
      const { model } = useCwaResourceModel<string>(iri, 'route', { alsoSend: () => ({ rawPath: null }) })

      model.value = '/_/routes/a'
      await nextTick()
      vi.runAllTimers()
      await microtasks()

      expect(mockUpdateResource).toHaveBeenCalledWith(expect.objectContaining({ data: { route: '/_/routes/a', rawPath: null } }))
    })

    test('a value equal to the stored one with no extra fields is not sent', async () => {
      mockGetResource.mockReturnValue(ref<any>({ data: { route: '/_/routes/a' } }))
      const { model } = useCwaResourceModel<string>(iri, 'route', { alsoSend: () => undefined })

      model.value = '/_/routes/a'
      await nextTick()
      vi.runAllTimers()
      await microtasks()

      expect(mockUpdateResource).not.toHaveBeenCalled()
    })

    describe('a value that is not valid is never sent, whichever path sends it', () => {
      const validUrl = (value: string | null | undefined) => value === null || !!value?.startsWith('/')

      test('Keep mine, and a newer remote change clearing a conflict, send through the editor\'s submit: an invalid value stays unsent', async () => {
        mockGetResource.mockReturnValue(ref<any>({ data: { rawPath: null } }))
        const { model } = useCwaResourceModel<string>(iri, 'rawPath', { valid: validUrl })
        const editor = registeredEditors.at(-1) as ModelEditor
        model.value = 'about us'
        await nextTick()
        vi.runAllTimers()
        await microtasks()

        await editor.submit()
        await microtasks()

        expect(mockUpdateResource).not.toHaveBeenCalled()
        expect(model.value).toBe('about us')
      })

      test('Retry after the value became invalid sends nothing', async () => {
        mockGetResource.mockReturnValue(ref<any>({ data: { rawPath: null } }))
        const answers = recordedSaves()
        const { model, retry } = useCwaResourceModel<string>(iri, 'rawPath', { valid: validUrl })
        model.value = '/about'
        await nextTick()
        vi.runAllTimers()
        await microtasks()
        answers[0]!({ error: { statusCode: 500 } })
        await microtasks()
        expect(mockUpdateResource).toHaveBeenCalledTimes(1)

        model.value = 'about us'
        await nextTick()
        vi.runAllTimers()
        await microtasks()
        await retry()
        await microtasks()

        expect(mockUpdateResource).toHaveBeenCalledTimes(1)
      })

      test('a publish flushing the waiting save sends nothing for an invalid value', async () => {
        mockGetResource.mockReturnValue(ref<any>({ data: { rawPath: null } }))
        const { model } = useCwaResourceModel<string>(iri, 'rawPath', { valid: validUrl, debounceTime: 1000 })
        model.value = 'about us'
        await nextTick()

        await pendingUpdates.get('/my/resource')?.()
        await microtasks()

        expect(mockUpdateResource).not.toHaveBeenCalled()
      })
    })

    test('saved runs once the request succeeds, and never for a failed one', async () => {
      mockGetResource.mockReturnValue(ref<any>({ data: { rawPath: null } }))
      const answers = recordedSaves()
      const saved = vi.fn()
      const { model } = useCwaResourceModel<string>(iri, 'rawPath', { saved })

      model.value = '/about'
      await nextTick()
      vi.runAllTimers()
      await microtasks()
      expect(saved).not.toHaveBeenCalled()
      answers[0]!({ error: { statusCode: 500 } })
      await microtasks()
      expect(saved).not.toHaveBeenCalled()

      model.value = '/about-us'
      await nextTick()
      vi.runAllTimers()
      await microtasks()
      answers[1]!({ resource: { '@id': '/my/resource', 'rawPath': '/about-us' } })
      await microtasks()
      expect(saved).toHaveBeenCalledTimes(1)
    })
  })

  describe('state, retry and reset (#458)', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    test('state is idle until the store holds a state for the field', () => {
      mockGetResource.mockReturnValue(ref({ data: { title: 'Store' } }))
      const { state } = useCwaResourceModel(iri, 'title')

      expect(state.value).toStrictEqual({ status: 'idle', waiting: false, slow: false })
    })

    test('state is the store\'s state for the model\'s IRI and root field', () => {
      const saved = { status: 'saved', waiting: false, slow: false, savedAt: 1 }
      mockGetResource.mockReturnValue(ref({ data: { meta: { a: 1 } }, fieldStates: { meta: saved, title: { status: 'error' } } }))
      const { state } = useCwaResourceModel(iri, 'meta.a')

      expect(state.value).toStrictEqual(saved)
    })

    test('a change marks the field pending and waiting in the store', async () => {
      const resource = ref<any>({ data: { title: 'Store' } })
      mockGetResource.mockReturnValue(resource)
      const { model, state } = useCwaResourceModel(iri, 'title', { debounceTime: 60_000 })

      model.value = 'Mine'
      await nextTick()

      await vi.waitFor(() => expect(state.value).toStrictEqual({ status: 'pending', waiting: true, slow: false }))
      expect(resource.value.fieldStates.title.status).toBe('pending')
    })

    test('a change typed back to the stored value leaves no state', async () => {
      const resource = ref<any>({ data: { title: 'Store' } })
      mockGetResource.mockReturnValue(resource)
      const { model, state } = useCwaResourceModel(iri, 'title')

      model.value = 'Mine'
      await nextTick()
      model.value = 'Store'
      await nextTick()
      vi.runAllTimers()

      await vi.waitFor(() => expect(state.value.status).toBe('idle'))
      expect(mockUpdateResource).not.toHaveBeenCalled()
    })

    test('a conflict raised on the model is held in the store as plain data, and cleared with it', async () => {
      const resource = ref<any>({ data: { title: 'Store' } })
      mockGetResource.mockReturnValue(resource)
      const { state } = useCwaResourceModel(iri, 'title')
      const editor = registeredEditors.at(-1) as ModelEditor

      editor.conflict({ iri: '/my/resource', change: { user: { id: '/_/users/2', name: 'Mia', isSelf: false }, name: 'Mia', value: 'Theirs', accept: vi.fn(), keep: vi.fn() } })
      await vi.waitFor(() => expect(state.value.status).toBe('conflict'))
      expect(state.value.held).toStrictEqual({ user: { id: '/_/users/2', name: 'Mia' }, value: 'Theirs' })

      editor.conflict(undefined)
      await vi.waitFor(() => expect(state.value.status).toBe('idle'))
    })

    test('retry() sends the value that failed again', async () => {
      const resource = ref<any>({ data: { title: 'Store' } })
      mockGetResource.mockReturnValue(resource)
      const answers = recordedSaves()
      const { model, retry, state } = useCwaResourceModel(iri, 'title')
      model.value = 'Mine'
      await nextTick()
      vi.runAllTimers()
      await microtasks()
      expect(mockUpdateResource).toHaveBeenCalledOnce()
      answers[0]!({ error: Object.assign(new Error('Server Error'), { statusCode: 500, data: { detail: 'Boom' } }) })
      await vi.waitFor(() => expect(state.value.status).toBe('error'))
      expect(model.value).toBe('Mine')

      const retried = retry()
      await microtasks()
      expect(mockUpdateResource).toHaveBeenCalledTimes(2)
      expect(mockUpdateResource).toHaveBeenLastCalledWith(expect.objectContaining({ data: { title: 'Mine' } }))
      resource.value = { ...resource.value, data: { title: 'Mine' } }
      answers[1]!({ resource: { '@id': '/my/resource', 'title': 'Mine' } })
      await retried

      await vi.waitFor(() => expect(state.value.status).toBe('saved'))
    })

    test('retry() with nothing unsaved sends nothing', async () => {
      mockGetResource.mockReturnValue(ref({ data: { title: 'Store' } }))
      const { retry } = useCwaResourceModel(iri, 'title')

      await retry()

      expect(mockUpdateResource).not.toHaveBeenCalled()
    })

    test('reset() puts the field back to its stored value, clears its state and sends nothing', async () => {
      const resource = ref<any>({ data: { title: 'Store' }, fieldStates: { title: { status: 'error', waiting: false, slow: false, error: { kind: 'server', message: 'Boom' } } } })
      mockGetResource.mockReturnValue(resource)
      const { model, reset, state } = useCwaResourceModel(iri, 'title')
      model.value = 'Mine'
      await nextTick()

      await reset()
      vi.runAllTimers()

      expect(model.value).toBe('Store')
      await vi.waitFor(() => expect(state.value.status).toBe('idle'))
      expect(mockUpdateResource).not.toHaveBeenCalled()
      expect(pendingUpdates.has('/my/resource')).toBe(false)
    })

    test('reset() during a conflict takes the other editor\'s value', async () => {
      mockGetResource.mockReturnValue(ref({ data: { title: 'Store' } }))
      const { model, reset } = useCwaResourceModel(iri, 'title')
      const editor = registeredEditors.at(-1) as ModelEditor
      const accept = vi.fn()
      model.value = 'Mine'
      editor.conflict({ iri: '/my/resource', change: { name: 'Mia', value: 'Theirs', accept, keep: vi.fn() } })

      await reset()

      expect(accept).toHaveBeenCalledOnce()
    })

    test('the deprecated resetValue() still clears the local value', () => {
      mockGetResource.mockReturnValue(ref({ data: { title: 'Store' } }))
      const { model, resetValue } = useCwaResourceModel(iri, 'title')
      model.value = 'Mine'

      resetValue()

      expect(model.value).toBe('Store')
    })
  })

  describe('the queue after review (#466)', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    function deferredSaves() {
      const answers: ((resource?: unknown) => void)[] = []
      mockUpdateResource.mockImplementation(() => new Promise((resolve) => {
        answers.push(resolve)
      }))
      return answers
    }

    async function type(model: { value: unknown }, value: string) {
      model.value = value
      await nextTick()
      vi.runAllTimers()
      await nextTick()
    }

    function sent() {
      return mockUpdateResource.mock.calls.map(([event]) => [event.endpoint, event.data])
    }

    test('a follow-up skipped because the store already holds it keeps a newer value still being typed', async () => {
      const selected = ref<string | undefined>('/my/resource')
      const stored = ref({ data: { title: 'Store' } })
      mockGetResource.mockReturnValue(stored)
      const answers = deferredSaves()
      const { model } = useCwaResourceModel(selected, 'title')

      await type(model, 'A')
      await type(model, 'AB')
      await type(model, 'A')
      model.value = 'AX'
      await nextTick()
      stored.value = { data: { title: 'A' } }
      answers[0]!({ '@id': '/my/resource', 'title': 'A' })
      await microtasks()

      expect(model.value).toBe('AX')
      expect(mockUpdateResource).toHaveBeenCalledOnce()
      vi.runAllTimers()
      await microtasks()
      expect(sent()).toStrictEqual([['/my/resource', { title: 'A' }], ['/my/resource', { title: 'AX' }]])
      answers[1]!(undefined)
    })

    test('a follow-up for one component skipped as already stored leaves the value queued for the component now selected', async () => {
      const selected = ref<string | undefined>('/my/resource')
      const resources: Record<string, unknown> = {
        '/my/resource': { data: { title: 'X' } },
        '/my/other': { data: { title: 'Y' } },
      }
      mockGetResource.mockImplementation((at: string) => ref(resources[at]))
      const answers = deferredSaves()
      const { model } = useCwaResourceModel(selected, 'title')

      await type(model, 'A')
      await type(model, 'X')
      selected.value = '/my/other'
      mockEndpoint.value = '/my/other'
      await type(model, 'Y2')
      answers[0]!(undefined)
      await microtasks()

      expect(model.value).toBe('Y2')
      expect(sent()).toStrictEqual([['/my/resource', { title: 'A' }], ['/my/other', { title: 'Y2' }]])
      answers[1]!(undefined)
    })

    test('a follow-up is held while the model\'s conflict sits on the draft a 412 answered with, though the model still reads the live component', async () => {
      const selected = ref<string | undefined>('/my/resource')
      mockGetResource.mockReturnValue(ref({ data: { title: 'Store' } }))
      const answers = deferredSaves()
      const { model } = useCwaResourceModel(selected, 'title')
      const editor = registeredEditors.at(-1) as ModelEditor

      await type(model, 'A')
      await type(model, 'AB')
      editor.conflict({ iri: '/my/draft', change: { name: 'Mia', value: 'Theirs', accept: vi.fn(), keep: vi.fn() } })
      answers[0]!(undefined)
      await microtasks()

      expect(mockUpdateResource).toHaveBeenCalledOnce()
      expect(editor.hasUnsentChange()).toBe(true)
    })

    test('a change typed into one component is sent to it even when the selection moves on before the debounce fires', async () => {
      const selected = ref<string | undefined>('/my/resource')
      const resources: Record<string, unknown> = {
        '/my/resource': { data: { title: 'X' } },
        '/my/other': { data: { title: 'Y' } },
      }
      const resource = (at: string) => resources[at] as { fieldStates?: Record<string, { status: string }> }
      mockGetResource.mockImplementation((at: string) => ref(resources[at]))
      const answers = recordedSaves()
      const { model } = useCwaResourceModel(selected, 'title')

      model.value = 'X typed'
      await nextTick()
      selected.value = '/my/other'
      mockEndpoint.value = '/my/other'
      vi.runAllTimers()
      await microtasks()

      expect(sent()).toStrictEqual([['/my/resource', { title: 'X typed' }]])
      await vi.waitFor(() => expect(resource('/my/resource').fieldStates?.title?.status).toBe('saving'))
      expect(resource('/my/other').fieldStates).toBeUndefined()
      answers[0]!({})
    })

    test('a value queued for one component is still sent after another component is selected and edited', async () => {
      const selected = ref<string | undefined>('/my/resource')
      const resources: Record<string, unknown> = {
        '/my/resource': { data: { title: 'X' } },
        '/my/other': { data: { title: 'Y' } },
      }
      mockGetResource.mockImplementation((at: string) => ref(resources[at]))
      const answers = deferredSaves()
      const { model } = useCwaResourceModel(selected, 'title')

      await type(model, 'X1')
      await type(model, 'X2')
      selected.value = '/my/other'
      mockEndpoint.value = '/my/other'
      await type(model, 'Y1')
      answers[0]!(undefined)
      await microtasks()
      answers[1]!(undefined)
      await microtasks()

      expect(sent()).toStrictEqual([
        ['/my/resource', { title: 'X1' }],
        ['/my/resource', { title: 'X2' }],
        ['/my/other', { title: 'Y1' }],
      ])
      answers[2]!(undefined)
    })

    test('a follow-up to the live version keeps ?published=true when the selection has moved to the draft', async () => {
      const selected = ref<string | undefined>('/my/resource')
      const resources: Record<string, unknown> = {
        '/my/resource': { data: { '@id': '/my/resource', 'title': 'Live' } },
        '/my/draft': { data: { '@id': '/my/draft', 'title': 'Draft' } },
      }
      mockGetResource.mockImplementation((at: string) => ref(resources[at]))
      mockEndpoint.value = '/my/resource?published=true'
      const answers = deferredSaves()
      const { model } = useCwaResourceModel(selected, 'title')

      await type(model, 'A')
      await type(model, 'AB')
      selected.value = '/my/draft'
      mockEndpoint.value = '/my/draft'
      answers[0]!({ '@id': '/my/resource', 'title': 'A' })
      await microtasks()

      expect(sent()).toStrictEqual([
        ['/my/resource?published=true', { title: 'A' }],
        ['/my/resource?published=true', { title: 'AB' }],
      ])
      answers[1]!(undefined)
    })

    test('a change made while submit()\'s request is in flight waits behind it', async () => {
      const selected = ref<string | undefined>('/my/resource')
      mockGetResource.mockReturnValue(ref({ data: { title: 'Store' } }))
      const answers = deferredSaves()
      const { model } = useCwaResourceModel(selected, 'title')
      const editor = registeredEditors.at(-1) as ModelEditor

      model.value = 'A'
      await nextTick()
      const submitted = editor.submit()
      await microtasks()
      expect(mockUpdateResource).toHaveBeenCalledOnce()

      await type(model, 'AB')
      expect(mockUpdateResource).toHaveBeenCalledOnce()

      answers[0]!(undefined)
      await microtasks()
      expect(sent()).toStrictEqual([['/my/resource', { title: 'A' }], ['/my/resource', { title: 'AB' }]])
      answers[1]!(undefined)
      await submitted
    })

    test('a change made after submit() overtook a save in flight waits for submit()\'s request, not the overtaken one', async () => {
      const selected = ref<string | undefined>('/my/resource')
      mockGetResource.mockReturnValue(ref({ data: { title: 'Store' } }))
      const answers = deferredSaves()
      const { model } = useCwaResourceModel(selected, 'title')
      const editor = registeredEditors.at(-1) as ModelEditor

      await type(model, 'A')
      model.value = 'AB'
      await nextTick()
      const submitted = editor.submit()
      await microtasks()
      await type(model, 'ABC')
      expect(mockUpdateResource).toHaveBeenCalledTimes(2)

      answers[0]!(undefined)
      await microtasks()
      expect(mockUpdateResource).toHaveBeenCalledTimes(2)

      answers[1]!(undefined)
      await microtasks()
      expect(sent().map(([, data]) => data)).toStrictEqual([{ title: 'A' }, { title: 'AB' }, { title: 'ABC' }])
      answers[2]!(undefined)
      await submitted
    })

    test('Keep mine taken before the refused request settles leaves the field saved once the resend lands, not in conflict', async () => {
      const selected = ref<string | undefined>('/my/resource')
      const resource = ref<any>({ data: { title: 'Store' } })
      mockGetResource.mockReturnValue(resource)
      const answers = recordedSaves()
      const { model, state } = useCwaResourceModel(selected, 'title')
      const editor = registeredEditors.at(-1) as ModelEditor

      await type(model, 'Mine')
      await microtasks()
      editor.conflict({ iri: '/my/resource', change: { name: 'Mia', value: 'Theirs', accept: vi.fn(), keep: vi.fn() } })
      editor.conflict(undefined)
      const kept = editor.submit()
      await microtasks()
      expect(mockUpdateResource).toHaveBeenCalledTimes(2)

      answers[0]!({ error: Object.assign(new Error('Precondition Failed'), { statusCode: 412, data: { '@id': '/my/resource', 'title': 'Theirs' } }) })
      await microtasks()
      resource.value = { ...resource.value, data: { title: 'Mine' } }
      answers[1]!({ resource: { '@id': '/my/resource', 'title': 'Mine' } })
      await kept

      await vi.waitFor(() => expect(state.value.status).toBe('saved'))
      expect(state.value.held).toBeUndefined()
    })

    test('Use theirs after more was typed during the conflict leaves no state behind', async () => {
      const selected = ref<string | undefined>('/my/resource')
      const resource = ref<any>({ data: { title: 'Store' } })
      mockGetResource.mockReturnValue(resource)
      const { model, state } = useCwaResourceModel(selected, 'title')
      const editor = registeredEditors.at(-1) as ModelEditor

      editor.conflict({ iri: '/my/resource', change: { name: 'Mia', value: 'Theirs', accept: vi.fn(), keep: vi.fn() } })
      await vi.waitFor(() => expect(state.value.status).toBe('conflict'))
      await type(model, 'More')
      await vi.waitFor(() => expect(state.value.waiting).toBe(true))

      editor.conflict(undefined)
      editor.discardLocal()

      await vi.waitFor(() => expect(state.value).toStrictEqual({ status: 'idle', waiting: false, slow: false }))
      expect(mockUpdateResource).not.toHaveBeenCalled()
    })

    test('a save records its own field state, sending, then the outcome', async () => {
      const selected = ref<string | undefined>('/my/resource')
      const resource = ref<any>({ data: { title: 'Store' } })
      mockGetResource.mockReturnValue(resource)
      const answers = recordedSaves()
      const { model, state } = useCwaResourceModel(selected, 'title')

      await type(model, 'Mine')
      await vi.waitFor(() => expect(state.value.status).toBe('saving'))
      answers[0]!({ error: Object.assign(new Error('Unprocessable'), { statusCode: 422, data: { detail: 'x', violations: [{ propertyPath: 'title', message: 'Too short.' }] } }) })

      await vi.waitFor(() => expect(state.value).toMatchObject({ status: 'error', error: { kind: 'violation', message: 'Too short.' } }))
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
