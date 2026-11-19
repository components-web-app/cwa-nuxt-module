// @vitest-environment happy-dom
import { describe, expect, test, vi, beforeEach } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { useCwaResourceUpload } from '#cwa/composables/cwa-resource-upload'
import { heldUpload, holdUpload } from '#cwa/admin/held-uploads'
import type Cwa from '#cwa/cwa'

const mockUpdateResource = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const mockGetResource = vi.hoisted(() => vi.fn())
const mockEndpointUpload = vi.hoisted(() => ({ value: '/resources/1/upload' }))
const mockEndpointDelete = vi.hoisted(() => ({ value: '/resources/1' }))
const mockModuleUploadConfig = vi.hoisted(() => ({ value: undefined as undefined | { image?: Record<string, unknown> } }))
const mockDownscaleImageFile = vi.hoisted(() => vi.fn(async (file: File) => file))
const mockBrowserDeps = vi.hoisted(() => ({ decode: () => undefined }))

vi.mock('#app/nuxt', async importOriginal => ({
  ...await importOriginal<typeof import('#app/nuxt')>(),
  useNuxtApp: () => ({ vueApp: {} }),
}))
const mockCwa = vi.hoisted(() => ({
  resources: { getResource: (iri: string) => mockGetResource(iri) },
  resourcesManager: { updateResource: (...args: unknown[]) => mockUpdateResource(...args) },
  get uploadConfig() {
    return mockModuleUploadConfig.value
  },
}))
vi.mock('#cwa/composables/cwa', () => ({
  useCwa: () => mockCwa,
}))

vi.mock('#cwa/files/image-downscale', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#cwa/files/image-downscale')>()
  return {
    ...actual,
    downscaleImageFile: mockDownscaleImageFile,
    createBrowserImageDownscaleDeps: () => mockBrowserDeps,
  }
})

let endpointCallCount = 0
vi.mock('#cwa/composables/cwa-resource-endpoint', () => ({
  useCwaResourceEndpoint: () => {
    endpointCallCount++
    return { endpoint: endpointCallCount % 2 === 1 ? mockEndpointUpload : mockEndpointDelete }
  },
}))

vi.mock('vuejs-confirm-dialog', () => ({
  install: vi.fn(),
  createConfirmDialog: vi.fn(() => ({
    reveal: vi.fn().mockResolvedValue({ isCanceled: false }),
  })),
}))

const stateWrites = vi.hoisted(() => ({
  started: vi.fn(),
  settled: vi.fn(),
  cleared: vi.fn(),
  retryWrite: vi.fn(),
}))
vi.mock('#cwa/resources/field-state-writer', () => ({
  writeFieldStates: (write: (states: typeof stateWrites) => void) => write(stateWrites),
}))

vi.mock('#cwa/templates/components/core/ui/Confirm.vue', () => ({
  default: {},
}))

describe('useCwaResourceUpload', () => {
  const iri = computed(() => '/resources/1')

  beforeEach(() => {
    endpointCallCount = 0
    vi.clearAllMocks()
    mockGetResource.mockReturnValue(ref(undefined))
    mockModuleUploadConfig.value = undefined
    mockDownscaleImageFile.mockImplementation(async (file: File) => file)
  })

  describe('initial state', () => {
    test('updating is false initially', () => {
      const { updating } = useCwaResourceUpload(iri)
      expect(updating.value).toBe(false)
    })

    test('fileExists is false when no file data in store', () => {
      const { fileExists } = useCwaResourceUpload(iri)
      expect(fileExists.value).toBe(false)
    })

    test('fileExists is true when resource has file data', () => {
      mockGetResource.mockReturnValue(ref({
        data: { _metadata: { mediaObjects: { file: [{ formattedFileSize: '1.2 MB' }] } } },
      }))
      const { fileExists } = useCwaResourceUpload(iri)
      expect(fileExists.value).toBe(true)
    })

    test('file updates reactively when file data changes', async () => {
      const resourceRef = ref<any>(undefined)
      mockGetResource.mockReturnValue(resourceRef)
      const { file } = useCwaResourceUpload(iri)
      expect(file.value).toBeUndefined()
      resourceRef.value = { data: { _metadata: { mediaObjects: { file: [{ formattedFileSize: '2.4 MB' }] } } } }
      await nextTick()
      expect(file.value?.size).toBe('2.4 MB')
    })

    test('the upload no longer returns the old file field\'s bindings', () => {
      const upload = useCwaResourceUpload(iri) as Record<string, unknown>
      expect(upload.bind).toBeUndefined()
      expect(upload.filenameInputModel).toBeUndefined()
    })
  })

  describe('handleInputChangeFile', () => {
    test('does nothing when no file provided', async () => {
      const { handleInputChangeFile } = useCwaResourceUpload(iri)
      await handleInputChangeFile(undefined)
      expect(mockUpdateResource).not.toHaveBeenCalled()
    })

    test('calls updateResource with FormData when file and iri provided', async () => {
      const { handleInputChangeFile } = useCwaResourceUpload(iri)
      const file = new File(['content'], 'test.png', { type: 'image/png' })
      await handleInputChangeFile(file)
      expect(mockUpdateResource).toHaveBeenCalledWith(
        expect.objectContaining({
          iri: '/resources/1',
          data: expect.any(FormData),
          headers: { accept: '*/*' },
        }),
      )
    })

    test('sets updating to false after completion', async () => {
      const { handleInputChangeFile, updating } = useCwaResourceUpload(iri)
      const file = new File([''], 'test.png')
      await handleInputChangeFile(file)
      expect(updating.value).toBe(false)
    })
  })

  describe('image downscaling (#335)', () => {
    const uploadedFile = async (upload: ReturnType<typeof useCwaResourceUpload>, file: File) => {
      await upload.handleInputChangeFile(file)
      return (mockUpdateResource.mock.calls[0]![0].data as FormData).get('file')
    }

    test('the downscaled file is uploaded in place of the one the admin picked', async () => {
      const picked = new File(['x'.repeat(5000)], 'photo.jpg', { type: 'image/jpeg' })
      const downscaled = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
      mockDownscaleImageFile.mockResolvedValue(downscaled)
      expect(await uploadedFile(useCwaResourceUpload(iri), picked)).toBe(downscaled)
      expect(mockDownscaleImageFile).toHaveBeenCalledWith(picked, expect.anything(), mockBrowserDeps)
    })

    test('the downscaler is given the built-in defaults when nothing is configured', async () => {
      await useCwaResourceUpload(iri).handleInputChangeFile(new File([''], 'photo.jpg', { type: 'image/jpeg' }))
      expect(mockDownscaleImageFile).toHaveBeenCalledWith(expect.anything(), {
        enabled: true,
        thresholdEdge: 2560,
        thresholdPixels: 20000000,
        maxEdge: 2560,
        maxPixels: 20000000,
        quality: 0.85,
      }, mockBrowserDeps)
    })

    test('the module default is applied to every field', async () => {
      mockModuleUploadConfig.value = { image: { maxEdge: 1920 } }
      await useCwaResourceUpload(iri).handleInputChangeFile(new File([''], 'photo.jpg', { type: 'image/jpeg' }))
      expect(mockDownscaleImageFile.mock.calls[0]![1]).toMatchObject({ maxEdge: 1920, thresholdEdge: 2560 })
    })

    test('the module default switches it off for every field', async () => {
      mockModuleUploadConfig.value = { image: { enabled: false } }
      await useCwaResourceUpload(iri).handleInputChangeFile(new File([''], 'photo.jpg', { type: 'image/jpeg' }))
      expect(mockDownscaleImageFile.mock.calls[0]![1]).toMatchObject({ enabled: false })
    })

    test('a per-call option overrides the module default for one field', async () => {
      mockModuleUploadConfig.value = { image: { maxEdge: 1920 } }
      const upload = useCwaResourceUpload(iri, 'file', 'Image', { imageDownscale: { maxEdge: 4096 } })
      await upload.handleInputChangeFile(new File([''], 'photo.jpg', { type: 'image/jpeg' }))
      expect(mockDownscaleImageFile.mock.calls[0]![1]).toMatchObject({ maxEdge: 4096 })
    })

    test('a field that must keep originals can switch it off on its own', async () => {
      const upload = useCwaResourceUpload(iri, 'download', 'File', { imageDownscale: { enabled: false } })
      await upload.handleInputChangeFile(new File([''], 'photo.jpg', { type: 'image/jpeg' }))
      expect(mockDownscaleImageFile.mock.calls[0]![1]).toMatchObject({ enabled: false })
    })
  })

  describe('handleInputDeleteFile', () => {
    test('does nothing when fileExists is false', async () => {
      const { handleInputDeleteFile } = useCwaResourceUpload(iri)
      await handleInputDeleteFile()
      expect(mockUpdateResource).not.toHaveBeenCalled()
    })

    test('calls updateResource with null filename on confirm', async () => {
      mockGetResource.mockReturnValue(ref({
        data: { _metadata: { mediaObjects: { file: [{ formattedFileSize: '1.2 MB' }] } } },
      }))
      const { handleInputDeleteFile } = useCwaResourceUpload(iri)
      await handleInputDeleteFile()
      expect(mockUpdateResource).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { file: null },
        }),
      )
    })

    test('fileExists reflects store state after delete', async () => {
      const resourceRef = ref<any>({
        data: { _metadata: { mediaObjects: { file: [{ formattedFileSize: '1.2 MB' }] } } },
      })
      mockGetResource.mockReturnValue(resourceRef)
      mockUpdateResource.mockImplementation(async () => {
        resourceRef.value = { data: { _metadata: { mediaObjects: {} } } }
      })
      const { handleInputDeleteFile, fileExists } = useCwaResourceUpload(iri)
      expect(fileExists.value).toBe(true)
      await handleInputDeleteFile()
      expect(fileExists.value).toBe(false)
    })

    test('asks in the kit confirm, naming the file\'s display type', async () => {
      mockGetResource.mockReturnValue(ref({
        data: { _metadata: { mediaObjects: { file: [{ formattedFileSize: '1.2 MB' }] } } },
      }))
      const reveal = vi.fn().mockResolvedValue({ isCanceled: true })
      const { createConfirmDialog } = await import('vuejs-confirm-dialog')
      vi.mocked(createConfirmDialog).mockReturnValue({ reveal } as any)
      const { handleInputDeleteFile } = useCwaResourceUpload(iri, 'file', 'Image')
      await handleInputDeleteFile()
      expect(reveal).toHaveBeenCalledWith({ title: 'Delete this image?', description: 'This can\'t be undone.', keep: 'Don\'t delete', go: 'Delete' })
    })

    test('does not call updateResource when dialog is cancelled', async () => {
      const { createConfirmDialog } = await import('vuejs-confirm-dialog')
      vi.mocked(createConfirmDialog).mockReturnValue({
        reveal: vi.fn().mockResolvedValue({ isCanceled: true }),
      } as any)
      const { handleInputDeleteFile } = useCwaResourceUpload(iri)
      await handleInputDeleteFile()
      expect(mockUpdateResource).not.toHaveBeenCalled()
    })
  })

  describe('two-field independence (file + preview on one resource)', () => {
    const withBoth = () => ref<any>({
      data: { _metadata: { mediaObjects: {
        file: [{ formattedFileSize: '1 MB' }],
        preview: [{ formattedFileSize: '2 MB' }],
      } } },
    })

    test('each field reads its own mediaObjects key', () => {
      mockGetResource.mockReturnValue(withBoth())
      const file = useCwaResourceUpload(iri, 'file')
      const preview = useCwaResourceUpload(iri, 'preview')
      expect(file.file.value?.size).toBe('1 MB')
      expect(preview.file.value?.size).toBe('2 MB')
    })

    test('a full-resource update keeping both keys leaves the other field intact', async () => {
      const resourceRef = withBoth()
      mockGetResource.mockReturnValue(resourceRef)
      const file = useCwaResourceUpload(iri, 'file')
      const preview = useCwaResourceUpload(iri, 'preview')
      resourceRef.value = {
        data: { _metadata: { mediaObjects: {
          file: [{ formattedFileSize: '9 MB' }],
          preview: [{ formattedFileSize: '2 MB' }],
        } } },
      }
      await nextTick()
      expect(file.file.value?.size).toBe('9 MB')
      expect(preview.file.value?.size).toBe('2 MB')
    })
  })

  describe('the file field\'s own save state (#460)', () => {
    function answering(outcome: { resource?: unknown, error?: unknown }) {
      mockUpdateResource.mockImplementation(async (event: { iri?: string, onRequest?: (iri: string, done: Promise<unknown>) => void }) => {
        event.onRequest?.('/resources/1', Promise.resolve(outcome))
        return outcome.resource
      })
    }

    test('an upload writes saving and then its outcome to the field state of its own field', async () => {
      const entry = { data: { '@id': '/resources/1', '_metadata': {} }, fieldStates: { image: { status: 'saved', waiting: false, slow: false } } }
      mockGetResource.mockReturnValue(ref(entry))
      answering({ resource: { '@id': '/resources/1' } })
      const upload = useCwaResourceUpload(iri, 'image')

      await upload.handleInputChangeFile(new File(['x'], 'a.png', { type: 'image/png' }))
      await Promise.resolve()

      expect(stateWrites.started).toHaveBeenCalledWith(entry, ['image'])
      expect(stateWrites.settled).toHaveBeenCalledWith(entry, ['image'], { '@id': '/resources/1' }, undefined, expect.any(Function))
      expect(upload.state.value.status).toBe('saved')
    })

    test('Retry sends the same downscaled file again, without downscaling it twice', async () => {
      mockGetResource.mockReturnValue(ref({ data: { '@id': '/resources/1', '_metadata': {} } }))
      answering({ error: { statusCode: 500 } })
      const upload = useCwaResourceUpload(iri)
      await upload.handleInputChangeFile(new File(['x'], 'a.png', { type: 'image/png' }))

      await upload.retry()

      expect(mockDownscaleImageFile).toHaveBeenCalledTimes(1)
      expect(mockUpdateResource).toHaveBeenCalledTimes(2)
      const [first, second] = mockUpdateResource.mock.calls.map(([event]) => (event.data as FormData).get('file'))
      expect(second).toBe(first)
    })

    test('Reset clears the field state and sends nothing', async () => {
      const entry = { data: { '@id': '/resources/1', '_metadata': {} } }
      mockGetResource.mockReturnValue(ref(entry))
      const upload = useCwaResourceUpload(iri)

      await upload.reset()
      await upload.retry()

      expect(stateWrites.cleared).toHaveBeenCalledWith(entry, 'file')
      expect(mockUpdateResource).not.toHaveBeenCalled()
    })

    test('names the stored file from its URL with its size', () => {
      mockGetResource.mockReturnValue(ref({ data: { _metadata: { mediaObjects: { file: [{ contentUrl: '/files/workshop%20bench.jpg?x=1', formattedFileSize: '240 KB', mimeType: 'image/jpeg' }] } } } }))
      const upload = useCwaResourceUpload(iri)

      expect(upload.file.value).toEqual({ name: 'workshop bench.jpg', size: '240 KB', url: '/files/workshop%20bench.jpg?x=1', mimeType: 'image/jpeg' })
    })
  })
  describe('a component not added yet holds its file until it is added (#461)', () => {
    const NEW = computed(() => '__new__')
    const adding = { endpoint: '/component/images', isPublishable: true }

    beforeEach(() => {
      vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:held'), revokeObjectURL: vi.fn() }))
      mockGetResource.mockReturnValue(ref({ data: { '@id': '__new__', '_metadata': { persisted: false, adding } } }))
    })

    test('a chosen file is held, not sent, and shown with a preview from the browser\'s copy', async () => {
      const upload = useCwaResourceUpload(NEW, 'image', 'Image')

      await upload.handleInputChangeFile(new File(['12345'], 'bench.jpg', { type: 'image/jpeg' }))

      expect(mockUpdateResource).not.toHaveBeenCalled()
      expect(upload.fileExists.value).toBe(true)
      expect(upload.file.value).toEqual({ name: 'bench.jpg', size: '5 B', url: 'blob:held', mimeType: 'image/jpeg' })
      expect(heldUpload(mockCwa as unknown as Cwa, '__new__', 'image')?.file.name).toBe('bench.jpg')
    })

    test('the held file is the downscaled one', async () => {
      const smaller = new File(['1'], 'bench.jpg', { type: 'image/jpeg' })
      mockDownscaleImageFile.mockResolvedValueOnce(smaller)
      const upload = useCwaResourceUpload(NEW, 'image')

      await upload.handleInputChangeFile(new File(['12345'], 'bench.jpg', { type: 'image/jpeg' }))

      expect(heldUpload(mockCwa as unknown as Cwa, '__new__', 'image')?.file).toBe(smaller)
    })

    test('removing a held file asks nothing, sends nothing and frees its preview', async () => {
      const upload = useCwaResourceUpload(NEW, 'image')
      await upload.handleInputChangeFile(new File(['1'], 'bench.jpg', { type: 'image/jpeg' }))

      await upload.handleInputDeleteFile()

      expect(mockUpdateResource).not.toHaveBeenCalled()
      expect(upload.fileExists.value).toBe(false)
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:held')
    })

    test('a file held for an earlier unadded component is not shown on the next one', async () => {
      const upload = useCwaResourceUpload(NEW, 'image')
      await upload.handleInputChangeFile(new File(['1'], 'bench.jpg', { type: 'image/jpeg' }))

      mockGetResource.mockReturnValue(ref({ data: { '@id': '__new__', '_metadata': { persisted: false, adding: { ...adding } } } }))

      expect(useCwaResourceUpload(NEW, 'image').fileExists.value).toBe(false)
    })

    test('Retry on an added component whose held upload failed sends the held file to it', async () => {
      mockGetResource.mockReturnValue(ref({ data: { '@id': '/resources/1', '_metadata': {} } }))
      const held = new File(['1'], 'bench.jpg', { type: 'image/jpeg' })
      holdUpload(mockCwa as unknown as Cwa, '/resources/1', 'image', held)
      const upload = useCwaResourceUpload(iri, 'image')

      expect(upload.file.value?.name).toBe('bench.jpg')
      await upload.retry()

      expect(mockUpdateResource).toHaveBeenCalledOnce()
      expect(mockUpdateResource.mock.calls[0]![0]).toMatchObject({ iri: '/resources/1', endpoint: '/resources/1/upload' })
      expect((mockUpdateResource.mock.calls[0]![0].data as FormData).get('image')).toBe(held)
    })

    test('choosing a file for a component not added yet clears the error a refused Add put on its field (#461)', async () => {
      const entry = { data: { '@id': '__new__', '_metadata': { persisted: false, adding } } }
      mockGetResource.mockReturnValue(ref(entry))
      const upload = useCwaResourceUpload(NEW, 'image')

      await upload.handleInputChangeFile(new File(['1'], 'bench.jpg', { type: 'image/jpeg' }))

      expect(stateWrites.cleared).toHaveBeenCalledExactlyOnceWith(entry, 'image')
    })

    test('Retry with no file to send runs again the write the API refused for this field (#461)', async () => {
      const entry = { data: { '@id': '/resources/1', '_metadata': {} } }
      mockGetResource.mockReturnValue(ref(entry))
      const upload = useCwaResourceUpload(iri, 'poster')

      await upload.retry()

      expect(stateWrites.retryWrite).toHaveBeenCalledExactlyOnceWith(entry, 'poster')
      expect(mockUpdateResource).not.toHaveBeenCalled()
    })
  })
})
