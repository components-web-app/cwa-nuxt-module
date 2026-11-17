// @vitest-environment nuxt
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { computed, defineComponent, reactive, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { useItemPage } from './useItemPage'
import * as cwaComposable from '#cwa/composables/cwa'

vi.mock('vue-router', async (importOriginal) => {
  const mod = await importOriginal<typeof import('vue-router')>()
  return {
    ...mod,
    useRoute: () => ({ name: '_cwa-layouts-iri', params: {}, query: {}, hash: '' }),
    useRouter: () => ({ push: vi.fn() }),
  }
})

const layoutIri = '/_/layouts/layout-uuid'

function setup(stored: Record<string, any>, ops: { excludeFields?: string[], resourceType?: string | null } = {}) {
  const store = reactive<Record<string, any>>({
    [layoutIri]: { data: stored, apiState: { status: 'SUCCESS' } },
  })
  const updateResource = vi.fn().mockResolvedValue({ ...stored, '@id': layoutIri })
  const createResource = vi.fn()
  // @ts-expect-error
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    resources: { getResource: vi.fn((iri: string) => computed(() => store[iri])) },
    resourcesManager: { createResource, updateResource, deleteResource: vi.fn(), addError: vi.fn() },
    fetchResource: vi.fn(),
  }))
  const emit = vi.fn()
  let itemPage!: ReturnType<typeof useItemPage>
  mount(defineComponent({
    setup() {
      itemPage = useItemPage({
        createEndpoint: '/_/layouts',
        emit,
        resourceType: ops.resourceType === null ? undefined : (ops.resourceType ?? 'Layout'),
        defaultResource: {},
        endpoint: ref(layoutIri),
        excludeFields: ops.excludeFields,
      })
      return () => null
    },
  }))
  itemPage.resetResource()
  const refetch = (data: Record<string, any>) => {
    store[layoutIri] = { data, apiState: { status: 'SUCCESS' } }
  }
  return { itemPage, updateResource, createResource, emit, refetch }
}

const layout = {
  '@id': layoutIri,
  '@type': 'Layout',
  '_metadata': { persisted: true },
  'reference': 'Main',
  'uiComponent': 'CwaLayoutPrimary',
  'uiClassNames': ['a', 'b'],
  'settings': { theme: 'dark', sizes: [1, 2] },
}

describe('useItemPage update body', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('an update sends only the fields that changed', async () => {
    const { itemPage, updateResource } = setup({ ...layout })
    await flushPromises()
    itemPage.localResourceData.value!.reference = 'Renamed'
    await itemPage.saveResource()
    expect(updateResource).toHaveBeenCalledOnce()
    expect(updateResource.mock.calls[0]![0]).toEqual({ endpoint: layoutIri, data: { reference: 'Renamed' } })
  })

  test('a field cleared to null is sent as null', async () => {
    const { itemPage, updateResource } = setup({ ...layout })
    await flushPromises()
    itemPage.localResourceData.value!.uiComponent = null
    await itemPage.saveResource()
    expect(updateResource.mock.calls[0]![0].data).toEqual({ uiComponent: null })
  })

  test('a field cleared to an empty string is sent', async () => {
    const { itemPage, updateResource } = setup({ ...layout })
    await flushPromises()
    itemPage.localResourceData.value!.reference = ''
    await itemPage.saveResource()
    expect(updateResource.mock.calls[0]![0].data).toEqual({ reference: '' })
  })

  test('an unchanged nested value replaced by an equal copy is not sent', async () => {
    const { itemPage, updateResource } = setup({ ...layout })
    await flushPromises()
    itemPage.localResourceData.value!.settings = { theme: 'dark', sizes: [1, 2] }
    itemPage.localResourceData.value!.uiClassNames = ['a', 'b']
    itemPage.localResourceData.value!.reference = 'Renamed'
    await itemPage.saveResource()
    expect(updateResource.mock.calls[0]![0].data).toEqual({ reference: 'Renamed' })
  })

  test('a changed nested value is sent', async () => {
    const { itemPage, updateResource } = setup({ ...layout })
    await flushPromises()
    itemPage.localResourceData.value!.settings = { theme: 'dark', sizes: [1, 3] }
    itemPage.localResourceData.value!.uiClassNames = ['a']
    await itemPage.saveResource()
    expect(updateResource.mock.calls[0]![0].data).toEqual({
      settings: { theme: 'dark', sizes: [1, 3] },
      uiClassNames: ['a'],
    })
  })

  test('extra data is always sent with an update', async () => {
    const { itemPage, updateResource } = setup({ ...layout })
    await flushPromises()
    itemPage.localResourceData.value!.reference = 'Renamed'
    await itemPage.saveResource(false, { reference: 'Main', cascadeChildPaths: true })
    expect(updateResource.mock.calls[0]![0].data).toEqual({ reference: 'Main', cascadeChildPaths: true })
  })

  test('excluded fields are not sent even when changed', async () => {
    const { itemPage, updateResource } = setup({ ...layout }, { excludeFields: ['uiComponent'] })
    await flushPromises()
    itemPage.localResourceData.value!.uiComponent = 'CwaLayoutSecondary'
    itemPage.localResourceData.value!.reference = 'Renamed'
    await itemPage.saveResource()
    expect(updateResource.mock.calls[0]![0].data).toEqual({ reference: 'Renamed' })
  })

  test('saving with nothing changed makes no request, returns the stored resource and still closes', async () => {
    const stored = { ...layout }
    const { itemPage, updateResource, emit } = setup(stored)
    await flushPromises()
    const result = await itemPage.saveResource(true)
    expect(updateResource).not.toHaveBeenCalled()
    expect(result).toStrictEqual(stored)
    expect(emit).toHaveBeenCalledWith('close')
    expect(itemPage.isUpdating.value).toBe(false)
  })
})

describe('useItemPage resource type check', () => {
  test('a resource whose @type is not the expected type closes the modal', async () => {
    const { emit } = setup({ ...layout, '@type': 'Page' })
    await flushPromises()
    expect(emit).toHaveBeenCalledWith('close')
  })

  test('without an expected type, a resource of any @type stays open', async () => {
    const { emit } = setup({ ...layout, '@type': 'BlogArticleData' }, { resourceType: null })
    await flushPromises()
    expect(emit).not.toHaveBeenCalledWith('close')
  })
})

describe('useItemPage keeps local edits through a re-fetch (#458)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('a re-fetch brings in the fields this modal has not edited and keeps the ones it has', async () => {
    const { itemPage, refetch } = setup({ ...layout })
    await flushPromises()
    itemPage.localResourceData.value!.reference = 'Renamed'

    refetch({ ...layout, reference: 'Theirs', uiComponent: 'CwaLayoutSecondary' })
    await flushPromises()

    expect(itemPage.localResourceData.value).toMatchObject({ reference: 'Renamed', uiComponent: 'CwaLayoutSecondary' })
  })

  test('a field removed by the re-fetch is removed unless it was edited', async () => {
    const { itemPage, refetch } = setup({ ...layout })
    await flushPromises()
    itemPage.localResourceData.value!.reference = 'Renamed'

    const { settings: _settings, reference: _reference, ...rest } = layout
    refetch(rest)
    await flushPromises()

    expect(itemPage.localResourceData.value).not.toHaveProperty('settings')
    expect(itemPage.localResourceData.value?.reference).toBe('Renamed')
  })

  test('a re-fetch of a different resource replaces the local copy', async () => {
    const { itemPage, refetch } = setup({ ...layout })
    await flushPromises()
    itemPage.localResourceData.value!.reference = 'Renamed'

    refetch({ ...layout, '@id': '/_/layouts/other', 'reference': 'Other' })
    await flushPromises()

    expect(itemPage.localResourceData.value?.reference).toBe('Other')
  })

  test('once saved, a field takes the value the server stored, and later re-fetches update it', async () => {
    const { itemPage, updateResource, refetch } = setup({ ...layout })
    await flushPromises()
    itemPage.localResourceData.value!.reference = ' Renamed '
    updateResource.mockImplementationOnce(async () => {
      refetch({ ...layout, reference: 'Renamed' })
      return { ...layout, reference: 'Renamed' }
    })

    await itemPage.saveResource()
    await flushPromises()
    expect(itemPage.localResourceData.value?.reference).toBe('Renamed')

    refetch({ ...layout, reference: 'Later' })
    await flushPromises()
    expect(itemPage.localResourceData.value?.reference).toBe('Later')
  })

  test('a field the server does not return, such as a password, is cleared once saved and not sent again', async () => {
    const { itemPage, updateResource, refetch } = setup({ ...layout })
    await flushPromises()
    Object.assign(itemPage.localResourceData.value!, { plainPassword: 'secret', repeatPassword: 'secret' })
    updateResource.mockImplementationOnce(async () => {
      refetch({ ...layout })
      return { ...layout }
    })

    await itemPage.saveResource()
    await flushPromises()
    expect(itemPage.localResourceData.value).not.toHaveProperty('plainPassword')
    expect(itemPage.localResourceData.value).not.toHaveProperty('repeatPassword')

    itemPage.localResourceData.value!.reference = 'Renamed'
    await itemPage.saveResource()
    expect(updateResource.mock.calls[1]![0].data).toStrictEqual({ reference: 'Renamed' })
  })

  test('a field saved as null that the server leaves out of its answer is not sent again', async () => {
    const { itemPage, updateResource, refetch } = setup({ ...layout })
    await flushPromises()
    itemPage.localResourceData.value!.uiComponent = null
    const { uiComponent: _uiComponent, ...saved } = layout
    updateResource.mockImplementationOnce(async () => {
      refetch(saved)
      return saved
    })

    await itemPage.saveResource()
    await flushPromises()
    itemPage.localResourceData.value!.reference = 'Renamed'
    await itemPage.saveResource()

    expect(updateResource.mock.calls[1]![0].data).toStrictEqual({ reference: 'Renamed' })
  })

  test('a failed save keeps the edits, so a re-fetch after a conflict still shows them', async () => {
    const { itemPage, updateResource, refetch } = setup({ ...layout })
    await flushPromises()
    itemPage.localResourceData.value!.reference = 'Mine'
    updateResource.mockResolvedValueOnce(undefined)

    await itemPage.saveResource()
    refetch({ ...layout, reference: 'Theirs', uiComponent: 'CwaLayoutSecondary' })
    await flushPromises()

    expect(itemPage.localResourceData.value).toMatchObject({ reference: 'Mine', uiComponent: 'CwaLayoutSecondary' })
  })

  test('resetResource() discards the edits', async () => {
    const { itemPage } = setup({ ...layout })
    await flushPromises()
    itemPage.localResourceData.value!.reference = 'Renamed'

    itemPage.resetResource()

    expect(itemPage.localResourceData.value?.reference).toBe('Main')
  })
})
