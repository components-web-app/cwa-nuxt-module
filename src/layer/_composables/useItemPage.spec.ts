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

function setup(stored: Record<string, any>, ops: { excludeFields?: string[], resourceType?: string | null, dismissStoredErrors?: boolean } = {}) {
  const store = reactive<Record<string, any>>({
    [layoutIri]: { data: stored, apiState: { status: 'SUCCESS' } },
  })
  const updateResource = vi.fn().mockResolvedValue({ ...stored, '@id': layoutIri })
  const createResource = vi.fn()
  const deleteResource = vi.fn()
  const errors = reactive<any[]>([])
  const removeError = vi.fn((timestamp: number) => {
    const index = errors.findIndex(error => error.timestamp === timestamp)
    index > -1 && errors.splice(index, 1)
  })
  const storeResource = vi.fn(({ resource }: { resource: Record<string, any> }) => {
    store[resource['@id']] = { data: resource, apiState: { status: 'SUCCESS' } }
  })
  // @ts-expect-error
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    resources: { getResource: vi.fn((iri: string) => computed(() => store[iri])) },
    resourcesManager: { createResource, updateResource, deleteResource, addError: vi.fn(), errors, removeError, storeResource },
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
        dismissStoredErrors: ops.dismissStoredErrors,
      })
      return () => null
    },
  }))
  itemPage.resetResource()
  const refetch = (data: Record<string, any>) => {
    store[layoutIri] = { data, apiState: { status: 'SUCCESS' } }
  }
  function failWith(statusCode: number | undefined, data?: Record<string, any>) {
    updateResource.mockImplementationOnce(async (event: any) => {
      const error = Object.assign(new Error('failed'), { statusCode, data })
      errors.push({ timestamp: 1, event, detail: 'failed', violations: [] })
      event.onRequest?.(layoutIri, Promise.resolve({ error }))
      return undefined
    })
  }
  return { itemPage, updateResource, createResource, deleteResource, emit, refetch, failWith, errors, removeError, storeResource }
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
    expect(updateResource.mock.calls[0]![0]).toEqual({ endpoint: layoutIri, data: { reference: 'Renamed' }, onRequest: expect.any(Function) })
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

describe('useItemPage delete (#461)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('says whether the delete went through, so a caller can tell a refused one', async () => {
    const { itemPage, deleteResource, emit } = setup({ ...layout })
    await flushPromises()
    deleteResource.mockImplementationOnce(async (event: { saveCompleteFn: () => void }) => {
      event.saveCompleteFn()
    })
    deleteResource.mockResolvedValueOnce(undefined)

    expect(await itemPage.deleteResource(undefined, undefined, true)).toBe(true)
    expect(emit).toHaveBeenCalledWith('close')
    emit.mockClear()
    expect(await itemPage.deleteResource(undefined, undefined, true)).toBe(false)
    expect(emit).not.toHaveBeenCalledWith('close')
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

describe('useItemPage Save model (#461)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('lists the fields changed in the local copy, which Save counts, and nothing for an untouched copy', async () => {
    const { itemPage } = setup({ ...layout }, { excludeFields: ['settings'] })
    await flushPromises()
    expect(itemPage.form.unsavedFields).toEqual([])

    itemPage.localResourceData.value!.reference = 'Renamed'
    itemPage.form.model('uiComponent').model.value = 'CwaLayoutSecondary'
    itemPage.localResourceData.value!.settings = { theme: 'light' }

    expect(itemPage.form.unsavedFields).toEqual(['reference', 'uiComponent'])
    itemPage.localResourceData.value!.reference = 'Main'
    expect(itemPage.form.unsavedFields).toEqual(['uiComponent'])
  })

  test('a field model reads and writes the local copy, never the store, and names its field', async () => {
    const { itemPage, updateResource } = setup({ ...layout })
    await flushPromises()
    const reference = itemPage.form.model<string>('reference')

    expect(reference.field).toBe('reference')
    expect(reference.model.value).toBe('Main')
    reference.model.value = 'Renamed'

    expect(itemPage.localResourceData.value?.reference).toBe('Renamed')
    expect(itemPage.resource.value?.reference).toBe('Main')
    expect(updateResource).not.toHaveBeenCalled()
    expect(itemPage.form.model('reference')).toBe(reference)
  })

  test('a 422 puts each violation on its field, keeps the edits unsaved, and shows no request-error toast in a dialog that shows the form errors', async () => {
    const { itemPage, failWith, errors, removeError } = setup({ ...layout }, { dismissStoredErrors: true })
    await flushPromises()
    itemPage.localResourceData.value!.reference = ''
    itemPage.localResourceData.value!.uiComponent = 'Nope'
    failWith(422, { violations: [
      { propertyPath: 'reference', message: 'Add a reference.' },
      { propertyPath: 'reference', message: 'A second message is not shown.' },
      { propertyPath: 'uiComponent.name', message: 'Choose a page UI.' },
      { propertyPath: 'somethingElse', message: 'Something else is wrong.' },
    ] })

    expect(await itemPage.saveResource()).toBeUndefined()

    expect(itemPage.form.fieldErrors).toEqual({ reference: 'Add a reference.', uiComponent: 'Choose a page UI.' })
    expect(itemPage.form.formError).toBe('Something else is wrong.')
    expect(itemPage.form.model('reference').state!.value).toMatchObject({ status: 'error', error: { kind: 'violation', message: 'Add a reference.' } })
    expect(itemPage.form.unsavedFields).toEqual(['reference', 'uiComponent'])
    expect(itemPage.form.failures).toBe(1)
    expect(removeError).toHaveBeenCalledWith(1)
    expect(errors).toEqual([])
  })

  test('a failed save keeps its stored error for a page that shows the store\'s errors itself', async () => {
    const { itemPage, failWith, errors, removeError } = setup({ ...layout })
    await flushPromises()
    itemPage.localResourceData.value!.reference = ''
    failWith(422, { violations: [{ propertyPath: 'reference', message: 'Add a reference.' }] })
    await itemPage.saveResource()

    failWith(500, { detail: 'Boom' })
    await itemPage.saveResource()

    expect(removeError).not.toHaveBeenCalled()
    expect(errors).toHaveLength(2)
    expect(itemPage.form.failures).toBe(2)
  })

  test('editing a field clears its error at once, and only its own', async () => {
    const { itemPage, failWith } = setup({ ...layout })
    await flushPromises()
    itemPage.localResourceData.value!.reference = ''
    itemPage.localResourceData.value!.uiComponent = 'Nope'
    failWith(422, { violations: [{ propertyPath: 'reference', message: 'Add a reference.' }, { propertyPath: 'uiComponent', message: 'Choose one.' }] })
    await itemPage.saveResource()

    itemPage.form.model('reference').model.value = 'Fixed'
    await flushPromises()

    expect(itemPage.form.fieldErrors).toEqual({ uiComponent: 'Choose one.' })
    expect(itemPage.form.model('reference').state!.value.status).toBe('idle')
  })

  test('a successful save clears the errors of the fields it sent and marks the save time', async () => {
    const { itemPage, failWith } = setup({ ...layout })
    await flushPromises()
    itemPage.localResourceData.value!.reference = ''
    failWith(422, { violations: [{ propertyPath: 'reference', message: 'Add a reference.' }] })
    await itemPage.saveResource()
    expect(itemPage.form.savedAt).toBeUndefined()

    await itemPage.saveResource()

    expect(itemPage.form.fieldErrors).toEqual({})
    expect(itemPage.form.savedAt).toEqual(expect.any(Number))
  })

  test('a 412 marks each sent field another editor changed as a conflict, stores their newer version and keeps mine', async () => {
    const { itemPage, failWith, storeResource, removeError } = setup({ ...layout, _metadata: { persisted: true, version: 3 } }, { dismissStoredErrors: true })
    await flushPromises()
    itemPage.localResourceData.value!.reference = 'Mine'
    itemPage.localResourceData.value!.uiComponent = 'CwaLayoutMine'
    const theirs = { ...layout, _metadata: { persisted: true, version: 4 }, reference: 'Theirs', uiClassNames: ['c'] }
    failWith(412, theirs)

    await itemPage.saveResource()
    await flushPromises()

    expect(itemPage.form.conflicts).toEqual({ reference: { name: 'Someone else', value: 'Theirs' } })
    expect(storeResource).toHaveBeenCalledWith({ resource: theirs })
    expect(removeError).toHaveBeenCalledWith(1)
    expect(itemPage.localResourceData.value).toMatchObject({ reference: 'Mine', uiComponent: 'CwaLayoutMine', uiClassNames: ['c'] })
    expect(itemPage.form.model('reference').state!.value.status).toBe('conflict')
    expect(itemPage.form.model('reference').remoteChange.value).toMatchObject({ name: 'Someone else', value: 'Theirs' })
  })

  test('Keep mine resolves the conflict and stays an unsaved change; Use theirs takes their value, which is no longer one', async () => {
    const { itemPage, failWith } = setup({ ...layout, _metadata: { persisted: true, version: 3 } })
    await flushPromises()
    itemPage.localResourceData.value!.reference = 'Mine'
    itemPage.localResourceData.value!.uiComponent = 'CwaLayoutMine'
    failWith(412, { ...layout, _metadata: { persisted: true, version: 4 }, reference: 'Theirs', uiComponent: 'CwaLayoutTheirs' })
    await itemPage.saveResource()
    await flushPromises()

    await itemPage.form.model('reference').remoteChange.value!.keep()
    itemPage.form.model('uiComponent').remoteChange.value!.accept()

    expect(itemPage.form.conflicts).toEqual({})
    expect(itemPage.localResourceData.value).toMatchObject({ reference: 'Mine', uiComponent: 'CwaLayoutTheirs' })
    expect(itemPage.form.unsavedFields).toEqual(['reference'])
  })

  test('a 412 whose version is not newer than the stored one does not overwrite the store', async () => {
    const { itemPage, failWith, storeResource } = setup({ ...layout, _metadata: { persisted: true, version: 4 } })
    await flushPromises()
    itemPage.localResourceData.value!.reference = 'Mine'
    failWith(412, { ...layout, _metadata: { persisted: true, version: 4 }, reference: 'Theirs' })

    await itemPage.saveResource()

    expect(storeResource).not.toHaveBeenCalled()
  })

  test('a server or network failure keeps the edits and says so in the form, not in a toast, in a dialog that shows the form errors', async () => {
    const { itemPage, failWith, removeError } = setup({ ...layout }, { dismissStoredErrors: true })
    await flushPromises()
    itemPage.localResourceData.value!.reference = 'Mine'
    failWith(500, { detail: 'Boom' })
    await itemPage.saveResource()
    expect(itemPage.form.formError).toBe('The server couldn\'t save it. Nothing changed, and what you typed is still here.')

    failWith(undefined)
    await itemPage.saveResource()
    expect(itemPage.form.formError).toBe('You\'re offline. This wasn\'t saved, and what you typed is still here.')
    expect(removeError).toHaveBeenCalledTimes(2)
    expect(itemPage.form.failures).toBe(2)
    expect(itemPage.form.unsavedFields).toEqual(['reference'])
  })

  test('discard puts the local copy back to the stored resource and clears its errors and conflicts', async () => {
    const { itemPage, failWith } = setup({ ...layout })
    await flushPromises()
    itemPage.localResourceData.value!.reference = ''
    failWith(422, { violations: [{ propertyPath: 'reference', message: 'Add a reference.' }] })
    await itemPage.saveResource()

    itemPage.form.discard()

    expect(itemPage.localResourceData.value?.reference).toBe('Main')
    expect(itemPage.form.fieldErrors).toEqual({})
    expect(itemPage.form.formError).toBeUndefined()
    expect(itemPage.form.unsavedFields).toEqual([])
  })
})
