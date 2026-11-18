// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { nextTick, reactive, ref } from 'vue'
import { useCwaResourceFieldGroup } from '#cwa/composables/cwa-resource-field-group'

vi.mock('vue', async () => {
  const mod = await vi.importActual<typeof import('vue')>('vue')
  return { ...mod, onBeforeUnmount: vi.fn(), getCurrentInstance: vi.fn().mockReturnValue(null) }
})

const store = vi.hoisted(() => ({ entry: undefined as any }))
const mockUpdateResource = vi.hoisted(() => vi.fn())

vi.mock('#cwa/composables/cwa', () => ({
  useCwa: () => ({
    resources: { getResource: () => ({ get value() {
      return store.entry
    } }) },
    resourcesManager: {
      getWaitForRequestPromise: vi.fn().mockResolvedValue(undefined),
      updateResource: mockUpdateResource,
      registerPendingUpdate: vi.fn(() => () => {}),
    },
  }),
}))
vi.mock('#cwa/resources/model-editors', () => ({ registerModelEditor: vi.fn(() => () => {}) }))
vi.mock('#cwa/resources/realtime-view', () => ({ realtimeView: () => ({ view: { value: undefined }, load: vi.fn().mockResolvedValue(undefined) }) }))
vi.mock('#cwa/composables/cwa-resource-endpoint', () => ({ useCwaResourceEndpoint: () => ({ endpoint: { value: '/component/links/1' } }) }))

async function settle() {
  await nextTick()
  vi.runAllTimers()
  for (let i = 0; i < 20; i++) {
    await Promise.resolve()
  }
}

function link(data: Record<string, unknown>) {
  store.entry = reactive({ data: { '@id': '/component/links/1', ...data }, apiState: {} })
  return useCwaResourceFieldGroup(ref('/component/links/1'), ['route', 'rawPath'], {
    debounceTime: { route: 0 },
    valid: { rawPath: (value: unknown) => value === null || (typeof value === 'string' && value.startsWith('/')) },
  })
}

describe('useCwaResourceFieldGroup (#460)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockUpdateResource.mockReset()
    mockUpdateResource.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      Object.assign(store.entry.data, data)
      return store.entry.data
    })
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
})
