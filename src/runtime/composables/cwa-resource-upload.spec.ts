// @vitest-environment happy-dom
import { describe, expect, test, vi, beforeEach } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { useCwaResourceUpload } from '#cwa/composables/cwa-resource-upload'

const mockUpdateResource = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const mockGetResource = vi.hoisted(() => vi.fn())
const mockEndpointUpload = vi.hoisted(() => ({ value: '/resources/1/upload' }))
const mockEndpointDelete = vi.hoisted(() => ({ value: '/resources/1' }))

vi.mock('#cwa/composables/cwa', () => ({
  useCwa: () => ({
    resources: { getResource: mockGetResource },
    resourcesManager: { updateResource: mockUpdateResource },
  }),
}))

// Two separate endpoint calls are made: one for upload, one for delete
let endpointCallCount = 0
vi.mock('#cwa/composables/cwa-resource-endpoint', () => ({
  useCwaResourceEndpoint: () => {
    endpointCallCount++
    return { endpoint: endpointCallCount % 2 === 1 ? mockEndpointUpload : mockEndpointDelete }
  },
}))

vi.mock('vuejs-confirm-dialog', () => ({
  createConfirmDialog: vi.fn(() => ({
    reveal: vi.fn().mockResolvedValue({ isCanceled: false }),
  })),
}))

vi.mock('#cwa/templates/components/core/ConfirmDialog.vue', () => ({
  default: {},
}))

describe('useCwaResourceUpload', () => {
  const iri = computed(() => '/resources/1')

  beforeEach(() => {
    endpointCallCount = 0
    vi.clearAllMocks()
    mockGetResource.mockReturnValue(ref(undefined))
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

    test('filenameInputModel updates reactively when file data changes', async () => {
      const resourceRef = ref<any>(undefined)
      mockGetResource.mockReturnValue(resourceRef)
      const { filenameInputModel } = useCwaResourceUpload(iri)
      expect(filenameInputModel.value).toBe('')
      resourceRef.value = { data: { _metadata: { mediaObjects: { file: [{ formattedFileSize: '2.4 MB' }] } } } }
      await nextTick()
      // default fileDisplayType is now 'File'
      expect(filenameInputModel.value).toBe('Existing File (2.4 MB)')
    })

    test('fileDisplayType overrides the display label', async () => {
      const resourceRef = ref<any>({ data: { _metadata: { mediaObjects: { file: [{ formattedFileSize: '1 KB' }] } } } })
      mockGetResource.mockReturnValue(resourceRef)
      const { filenameInputModel } = useCwaResourceUpload(iri, 'file', 'Image')
      expect(filenameInputModel.value).toBe('Existing Image (1 KB)')
    })

    test('filenameInputModel is empty when no file data', () => {
      const { filenameInputModel } = useCwaResourceUpload(iri)
      expect(filenameInputModel.value).toBe('')
    })
  })

  describe('bind', () => {
    test('exposes CwaUiFormFile bindings that reflect state and wire the handlers', () => {
      mockGetResource.mockReturnValue(ref({
        data: { _metadata: { mediaObjects: { file: [{ formattedFileSize: '1.2 MB' }] } } },
      }))
      const upload = useCwaResourceUpload(iri)
      const b = upload.bind.value
      expect(b.modelValue).toBe('Existing File (1.2 MB)')
      expect(b.fileExists).toBe(true)
      expect(b.disabled).toBe(false)
      expect(b.onChange).toBe(upload.handleInputChangeFile)
      expect(b.onDelete).toBe(upload.handleInputDeleteFile)
    })

    test('onUpdate:modelValue writes back to filenameInputModel', () => {
      const { bind, filenameInputModel } = useCwaResourceUpload(iri)
      bind.value['onUpdate:modelValue']('changed')
      expect(filenameInputModel.value).toBe('changed')
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
})
