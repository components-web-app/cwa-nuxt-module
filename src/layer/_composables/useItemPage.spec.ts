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

function setup(stored: Record<string, any>, ops: { excludeFields?: string[] } = {}) {
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
        resourceType: 'Layout',
        defaultResource: {},
        endpoint: ref(layoutIri),
        excludeFields: ops.excludeFields,
      })
      return () => null
    },
  }))
  itemPage.resetResource()
  return { itemPage, updateResource, createResource, emit }
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
