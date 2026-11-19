// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, nextTick, reactive, ref } from 'vue'
import type { Ref } from 'vue'
import { useCwaResourceFieldGroup } from '#cwa/composables/cwa-resource-field-group'
import type { ModelEditor } from '#cwa/resources/model-editors'

vi.mock('vue', async () => {
  const mod = await vi.importActual<typeof import('vue')>('vue')
  return { ...mod, onBeforeUnmount: vi.fn(), getCurrentInstance: vi.fn().mockReturnValue(null) }
})

const store = vi.hoisted(() => ({ byId: {} as Record<string, any>, published: {} as Record<string, string> }))
const mockUpdateResource = vi.hoisted(() => vi.fn())
const editors = vi.hoisted(() => [] as ModelEditor[])

vi.mock('#cwa/composables/cwa', async () => {
  const { computed } = await vi.importActual<typeof import('vue')>('vue')
  return {
    useCwa: () => ({
      resources: {
        getResource: (iri: string) => computed(() => store.byId[iri]),
        findPublishedComponentIri: (iri: string) => computed(() => store.published[iri]),
      },
      resourcesManager: {
        getWaitForRequestPromise: vi.fn().mockResolvedValue(undefined),
        updateResource: mockUpdateResource,
        registerPendingUpdate: vi.fn(() => () => {}),
      },
    }),
  }
})
vi.mock('#cwa/resources/model-editors', () => ({
  registerModelEditor: vi.fn((_cwa: unknown, editor: ModelEditor) => {
    editors.push(editor)
    return () => {}
  }),
}))
vi.mock('#cwa/resources/realtime-view', () => ({ realtimeView: () => ({ view: { value: undefined }, load: vi.fn().mockResolvedValue(undefined) }) }))
vi.mock('#cwa/composables/cwa-resource-endpoint', () => ({ useCwaResourceEndpoint: (iri: Ref<string | undefined>) => ({ endpoint: computed(() => iri.value) }) }))

const LIVE = '/component/links/1'
const DRAFT = '/component/links/draft-1'

async function settle() {
  await nextTick()
  vi.runAllTimers()
  for (let i = 0; i < 20; i++) {
    await Promise.resolve()
  }
}

function put(iri: string, data: Record<string, unknown>) {
  store.byId[iri] = reactive({ data: { '@id': iri, ...data }, apiState: {} })
}

function link(data: Record<string, unknown>, iri = ref<string | undefined>(LIVE), debounceTime: Record<string, number> = { route: 0 }) {
  put(iri.value!, data)
  return Object.assign(useCwaResourceFieldGroup(iri, ['route', 'rawPath'], {
    debounceTime,
    valid: { rawPath: (value: unknown) => value === null || (typeof value === 'string' && value.startsWith('/')) },
  }), { iri })
}

function editorOf(field: string) {
  return editors.find(editor => editor.field() === field)!
}

function answering(answer: (event: any) => Promise<any> | any) {
  mockUpdateResource.mockImplementation((event: any) => {
    let settled!: (outcome: unknown) => void
    const done = new Promise((resolve) => {
      settled = resolve
    })
    event.onRequest?.(event.endpoint, done)
    return Promise.resolve(answer(event)).then((outcome: { resource?: any, error?: unknown }) => {
      settled(outcome)
      return outcome.resource
    })
  })
}

function saveInPlace(event: { endpoint: string, data: Record<string, unknown> }) {
  Object.assign(store.byId[event.endpoint].data, event.data)
  return { resource: store.byId[event.endpoint].data }
}

describe('useCwaResourceFieldGroup (#460)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    store.byId = {}
    store.published = {}
    editors.length = 0
    mockUpdateResource.mockReset()
    answering(saveInPlace)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('shows the first option holding a value, and says when old data holds both', () => {
    expect(link({ route: null, rawPath: '/about' }).active.value).toBe(1)
    expect(link({ route: null, rawPath: null }).active.value).toBe(0)
    const both = link({ route: '/_/routes/a', rawPath: '/about' })
    expect(both.active.value).toBe(0)
    expect(both.bothSet.value).toBe(true)
  })

  test('switching option writes nothing', async () => {
    const group = link({ route: '/_/routes/a', rawPath: null })
    group.choose(1)
    await settle()

    expect(group.active.value).toBe(1)
    expect(mockUpdateResource).not.toHaveBeenCalled()
  })

  test('the first save after switching sends the value and clears the other option in one request', async () => {
    const group = link({ route: '/_/routes/a', rawPath: null })
    group.choose(1)
    group.models.rawPath!.model.value = '/about'
    await settle()

    expect(mockUpdateResource).toHaveBeenCalledTimes(1)
    expect(mockUpdateResource).toHaveBeenCalledWith(expect.objectContaining({ data: { rawPath: '/about', route: null } }))
    expect(group.cleared.value).toEqual({ field: 'rawPath', restore: { route: '/_/routes/a' } })
  })

  test('Undo restores the cleared field and clears the chosen one in one request, switches back and offers no second Undo', async () => {
    const group = link({ route: '/_/routes/a', rawPath: null })
    group.choose(1)
    group.models.rawPath!.model.value = '/about'
    await settle()
    mockUpdateResource.mockClear()

    group.undoClear()
    await settle()

    expect(mockUpdateResource).toHaveBeenCalledTimes(1)
    expect(mockUpdateResource).toHaveBeenCalledWith(expect.objectContaining({ data: { route: '/_/routes/a', rawPath: null } }))
    expect(group.active.value).toBe(0)
    expect(group.cleared.value).toBeUndefined()
  })

  test('Undo stays until the next edit in the group', async () => {
    const group = link({ route: '/_/routes/a', rawPath: null })
    group.choose(1)
    group.models.rawPath!.model.value = '/about'
    await settle()

    group.models.rawPath!.model.value = '/about-us'
    expect(group.cleared.value).toBeUndefined()
  })

  test('an invalid URL sends nothing and clears nothing', async () => {
    const group = link({ route: '/_/routes/a', rawPath: null })
    group.choose(1)
    group.models.rawPath!.model.value = 'about us'
    await settle()

    expect(mockUpdateResource).not.toHaveBeenCalled()
    expect(group.cleared.value).toBeUndefined()
  })

  test('emptying one option never clears the other', async () => {
    const group = link({ route: '/_/routes/a', rawPath: '/old' })
    group.models.rawPath!.model.value = null
    await settle()

    expect(mockUpdateResource).toHaveBeenCalledWith(expect.objectContaining({ data: { rawPath: null } }))
  })

  describe('an invalid URL left in the hidden option', () => {
    async function typedThenPicked() {
      const group = link({ route: null, rawPath: null })
      group.choose(1)
      group.models.rawPath!.model.value = 'about us'
      await settle()
      group.choose(0)
      group.models.route!.model.value = '/_/routes/b'
      await settle()
      return group
    }

    test('is let go once the page saves, so switching back shows the stored URL', async () => {
      const group = await typedThenPicked()

      expect(mockUpdateResource).toHaveBeenCalledTimes(1)
      expect(mockUpdateResource).toHaveBeenCalledWith(expect.objectContaining({ data: { route: '/_/routes/b' } }))
      expect(group.models.rawPath!.model.value).toBeNull()
    })

    test('is never sent by Keep mine or a newer remote change clearing a conflict', async () => {
      await typedThenPicked()
      mockUpdateResource.mockClear()

      await editorOf('rawPath').submit()
      await settle()

      expect(mockUpdateResource).not.toHaveBeenCalled()
    })
  })

  test('Undo is still offered, and works, after the clearing save turned the live link into a draft', async () => {
    answering((event) => {
      put(DRAFT, { ...store.byId[LIVE].data, ...event.data, '@id': DRAFT })
      store.published[LIVE] = LIVE
      store.published[DRAFT] = LIVE
      return { resource: store.byId[DRAFT].data }
    })
    const group = link({ route: '/_/routes/a', rawPath: null })
    store.published[LIVE] = LIVE
    group.choose(1)
    group.models.rawPath!.model.value = '/about'
    await settle()
    group.iri.value = DRAFT
    await settle()

    expect(group.cleared.value).toEqual({ field: 'rawPath', restore: { route: '/_/routes/a' } })
    answering(saveInPlace)
    mockUpdateResource.mockClear()
    group.undoClear()
    await settle()

    expect(mockUpdateResource).toHaveBeenCalledTimes(1)
    expect(mockUpdateResource).toHaveBeenCalledWith(expect.objectContaining({ endpoint: DRAFT, data: { route: '/_/routes/a', rawPath: null } }))
    expect(group.active.value).toBe(0)
  })

  test('another resource selected still resets the choice and Undo', async () => {
    const group = link({ route: '/_/routes/a', rawPath: null })
    put('/component/links/2', { route: null, rawPath: null })
    group.choose(1)
    group.models.rawPath!.model.value = '/about'
    await settle()

    group.iri.value = '/component/links/2'
    await settle()

    expect(group.cleared.value).toBeUndefined()
  })

  test('a selection change within the debounce clears the other option of the resource typed into, and offers no Undo on the one now shown', async () => {
    const iri = ref<string | undefined>(LIVE)
    const group = link({ route: '/_/routes/a', rawPath: null }, iri, { route: 0, rawPath: 250 })
    put('/component/links/2', { route: null, rawPath: null })
    group.choose(1)
    group.models.rawPath!.model.value = '/about'
    await nextTick()
    iri.value = '/component/links/2'
    await settle()

    expect(mockUpdateResource).toHaveBeenCalledTimes(1)
    expect(mockUpdateResource).toHaveBeenCalledWith(expect.objectContaining({ endpoint: LIVE, data: { rawPath: '/about', route: null } }))
    expect(group.cleared.value).toBeUndefined()
  })

  describe('old data holding both', () => {
    test('re-picking the page already shown still clears the URL', async () => {
      const group = link({ route: '/_/routes/a', rawPath: '/old' })

      group.models.route!.model.value = '/_/routes/a'
      await settle()

      expect(mockUpdateResource).toHaveBeenCalledWith(expect.objectContaining({ data: { route: '/_/routes/a', rawPath: null } }))
      expect(group.bothSet.value).toBe(false)
    })
  })

  test('Undo is offered only once the clearing save succeeds', async () => {
    let answer!: (outcome: unknown) => void
    answering(() => new Promise((resolve) => {
      answer = resolve
    }))
    const group = link({ route: '/_/routes/a', rawPath: null })
    group.choose(1)
    group.models.rawPath!.model.value = '/about'
    await settle()

    expect(mockUpdateResource).toHaveBeenCalledTimes(1)
    expect(group.cleared.value).toBeUndefined()
    answer({ error: { statusCode: 500 } })
    await settle()
    expect(group.cleared.value).toBeUndefined()
  })

  test('Undo is offered while the clearing save is answered later', async () => {
    let answer!: (outcome: unknown) => void
    answering(event => new Promise((resolve) => {
      answer = () => resolve(saveInPlace(event))
    }))
    const group = link({ route: '/_/routes/a', rawPath: null })
    group.choose(1)
    group.models.rawPath!.model.value = '/about'
    await settle()
    expect(group.cleared.value).toBeUndefined()

    answer(undefined)
    await settle()
    expect(group.cleared.value).toEqual({ field: 'rawPath', restore: { route: '/_/routes/a' } })
  })

  test('a save after an Undo whose write cleared nothing still offers Undo', async () => {
    const group = link({ route: '/_/routes/a', rawPath: null })
    group.choose(1)
    group.models.rawPath!.model.value = '/about'
    await settle()
    store.byId[LIVE].data.rawPath = null

    group.undoClear()
    await settle()
    expect(mockUpdateResource).toHaveBeenLastCalledWith(expect.objectContaining({ data: { route: '/_/routes/a' } }))

    group.choose(1)
    group.models.rawPath!.model.value = '/contact'
    await settle()

    expect(mockUpdateResource).toHaveBeenLastCalledWith(expect.objectContaining({ data: { rawPath: '/contact', route: null } }))
    expect(group.cleared.value).toEqual({ field: 'rawPath', restore: { route: '/_/routes/a' } })
  })
})
