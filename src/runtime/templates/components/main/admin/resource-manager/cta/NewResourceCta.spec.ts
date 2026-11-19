// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, reactive } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import NewResourceCta from './NewResourceCta.vue'
import Button from '#cwa/templates/components/ui/Button.vue'
import * as cwaComposable from '#cwa/composables/cwa'
import { heldFields, heldUpload, holdUpload } from '#cwa/admin/held-uploads'
import type Cwa from '#cwa/cwa'

const toast = vi.hoisted(() => ({ show: vi.fn(), dismiss: vi.fn() }))
vi.mock('#cwa/composables/cwa-toast', () => ({ useCwaToast: () => toast }))
vi.mock('#cwa/resources/field-state-writer', () => ({ writeFieldStates: () => undefined }))

enableAutoUnmount(afterEach)

const CREATED = '/component/images/created'
const adding = { endpoint: '/component/images', isPublishable: true }

function setup(opts: { isPublishable?: boolean, uploads?: (boolean | undefined)[] } = {}) {
  const meta = { ...adding, isPublishable: opts.isPublishable ?? true }
  const store = reactive<Record<string, any>>({ __new__: { data: { '@id': '__new__', '_metadata': { persisted: false, adding: meta } } } })
  const answers = [...(opts.uploads ?? [])]
  const $cwa = {
    resources: { getResource: (iri: string) => computed(() => store[iri]) },
    resourcesManager: {
      addResourceAction: vi.fn(async () => ({ '@id': CREATED })),
      updateResource: vi.fn(async (event: { data: unknown }) => {
        if (event.data instanceof FormData) {
          return answers.shift() === false ? undefined : { '@id': CREATED }
        }
        return { '@id': CREATED }
      }),
      confirmDiscardAddingResource: vi.fn(async () => true),
    },
    admin: { emptyStack: vi.fn() },
  }
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => $cwa as unknown as Cwa)
  const wrapper = mount(NewResourceCta, { props: { currentIri: '__new__', resource: store.__new__.data } })
  const hold = (field: string, name = `${field}.jpg`) => holdUpload($cwa as unknown as Cwa, '__new__', field, new File(['1'], name, { type: 'image/jpeg' }))
  const sent = () => $cwa.resourcesManager.updateResource.mock.calls.map(([event]) => event as { iri?: string, endpoint: string, data: unknown })
  return { wrapper, $cwa, hold, sent, button: () => wrapper.findComponent(Button) }
}

describe('NewResourceCta: a component not added yet, with files held for it (#461)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:held'), revokeObjectURL: vi.fn() }))
  })

  test('with no files held, Add only creates it, as before', async () => {
    const { $cwa, button } = setup()

    await button().vm.$emit('click')
    await flushPromises()

    expect($cwa.resourcesManager.addResourceAction).toHaveBeenCalledWith(false, expect.any(Function))
    expect($cwa.resourcesManager.updateResource).not.toHaveBeenCalled()
    expect($cwa.admin.emptyStack).toHaveBeenCalled()
  })

  test('Add creates it without its files, then uploads each held file to it, one at a time', async () => {
    const { $cwa, hold, sent, button } = setup()
    hold('image')
    hold('preview')

    await button().vm.$emit('click')
    await flushPromises()

    expect($cwa.resourcesManager.addResourceAction).toHaveBeenCalledWith(false, expect.any(Function))
    expect(sent().map(event => [event.iri, event.endpoint, [...(event.data as FormData).entries()][0]])).toEqual([
      [CREATED, `${CREATED}/upload`, ['image', expect.objectContaining({ name: 'image.jpg' })]],
      [CREATED, `${CREATED}/upload`, ['preview', expect.objectContaining({ name: 'preview.jpg' })]],
    ])
    expect(heldFields($cwa as unknown as Cwa, CREATED)).toEqual([])
    expect(toast.show).not.toHaveBeenCalled()
  })

  test('Add and publish creates a draft, uploads its files and only then publishes it', async () => {
    const { $cwa, hold, sent, button } = setup()
    hold('image')

    await button().vm.$emit('select', { value: 'add-publish' })
    await flushPromises()

    expect($cwa.resourcesManager.addResourceAction).toHaveBeenCalledWith(false, expect.any(Function))
    expect(sent().map(event => event.data instanceof FormData ? 'upload' : event)).toEqual(['upload', { endpoint: CREATED, data: { publishedAt: 'now' } }])
  })

  test('a component that is not publishable is created as before and then given its files', async () => {
    const { $cwa, hold, sent, button } = setup({ isPublishable: false })
    hold('image')

    await button().vm.$emit('click')
    await flushPromises()

    expect($cwa.resourcesManager.addResourceAction).toHaveBeenCalledWith(true, expect.any(Function))
    expect(sent()).toHaveLength(1)
  })

  test('a failed upload leaves it a draft, keeps the file held for it, and says so with a Retry that sends it and then publishes', async () => {
    const { $cwa, hold, sent, button } = setup({ uploads: [false] })
    hold('image')

    await button().vm.$emit('select', { value: 'add-publish' })
    await flushPromises()

    expect(sent()).toHaveLength(1)
    expect(heldUpload($cwa as unknown as Cwa, CREATED, 'image')?.file.name).toBe('image.jpg')
    expect(toast.show).toHaveBeenCalledWith(expect.objectContaining({
      tone: 'error',
      title: 'Added as a draft, without its file',
      description: 'The file couldn\'t be uploaded. Retry here, or select the component and use Retry on the file.',
    }))

    toast.show.mock.calls[0]![0].actions[0].onClick()
    await flushPromises()

    expect(sent().map(event => event.data instanceof FormData ? 'upload' : event)).toEqual(['upload', 'upload', { endpoint: CREATED, data: { publishedAt: 'now' } }])
    expect(heldFields($cwa as unknown as Cwa, CREATED)).toEqual([])
  })

  test('a create that fails sends no file and keeps them held for another try', async () => {
    const { $cwa, hold, button } = setup()
    $cwa.resourcesManager.addResourceAction.mockResolvedValueOnce(undefined as never)
    hold('image')

    await button().vm.$emit('click')
    await flushPromises()

    expect($cwa.resourcesManager.updateResource).not.toHaveBeenCalled()
    expect(heldFields($cwa as unknown as Cwa, '__new__')).toEqual(['image'])
  })

  test('a refused Add keeps the component selected, so the bar can show the refusal on its fields, and hands over a retry that adds it the same way (#461)', async () => {
    const { $cwa, button } = setup()
    $cwa.resourcesManager.addResourceAction.mockResolvedValueOnce(undefined as never)

    await button().vm.$emit('select', { label: 'Add and publish', value: 'add-publish' })
    await flushPromises()

    expect($cwa.admin.emptyStack).not.toHaveBeenCalled()
    expect(button().props('loading')).toBe(false)
    const retry = ($cwa.resourcesManager.addResourceAction.mock.calls[0] as unknown as [boolean, () => Promise<void>])[1]
    await retry()
    expect($cwa.resourcesManager.addResourceAction).toHaveBeenLastCalledWith(true, expect.any(Function))
    expect($cwa.admin.emptyStack).toHaveBeenCalledOnce()
  })
})
