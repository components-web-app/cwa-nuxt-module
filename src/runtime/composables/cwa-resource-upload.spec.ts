// @vitest-environment happy-dom
import { describe, expect, test, vi, beforeEach } from 'vitest'
import { computed, ref } from 'vue'
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

    test('fileExists is true initially', () => {
      const { fileExists } = useCwaResourceUpload(iri)
      expect(fileExists.value).toBe(true)
    })

    test('filenameInputModel is empty when no file data', () => {
      const { filenameInputModel } = useCwaResourceUpload(iri)
      expect(filenameInputModel.value).toBe('')
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
      const { handleInputDeleteFile, fileExists } = useCwaResourceUpload(iri)
      fileExists.value = false
      await handleInputDeleteFile()
      expect(mockUpdateResource).not.toHaveBeenCalled()
    })

    test('calls updateResource with null filename on confirm', async () => {
      const { handleInputDeleteFile } = useCwaResourceUpload(iri)
      await handleInputDeleteFile()
      expect(mockUpdateResource).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { file: null },
        }),
      )
    })

    test('sets fileExists to false after delete', async () => {
      const { handleInputDeleteFile, fileExists } = useCwaResourceUpload(iri)
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
