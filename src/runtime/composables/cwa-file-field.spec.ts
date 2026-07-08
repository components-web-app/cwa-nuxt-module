// @vitest-environment happy-dom

import { describe, expect, test, vi, beforeEach } from 'vitest'
import { ref, computed } from 'vue'
import * as cwaFileModule from '#cwa/composables/cwa-file'
import { useCwaFileField } from '#cwa/composables/cwa-file-field'

vi.mock('vue', async () => {
  const mod = await vi.importActual<typeof import('vue')>('vue')
  return { ...mod, useTemplateRef: vi.fn((name: string) => ref({ __ref: name })) }
})

const mockResource = vi.hoisted(() => ({ value: undefined as any }))

vi.mock('#cwa/composables/cwa', () => ({
  useCwa: vi.fn(() => ({
    resources: {
      getResource: vi.fn(() => ({ value: mockResource.value })),
    },
  })),
}))

vi.mock('#cwa/composables/cwa-file', () => ({
  useCwaFile: vi.fn(() => ({
    contentUrl: computed(() => '/mock.jpg'),
    displayMedia: computed(() => undefined),
    handleLoad: vi.fn(),
    loaded: ref(false),
  })),
}))

describe('useCwaFileField', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResource.value = undefined
    vi.mocked(cwaFileModule.useCwaFile).mockReturnValue({
      contentUrl: computed(() => '/mock.jpg'),
      displayMedia: computed(() => undefined),
      handleLoad: vi.fn(),
      loaded: ref(false),
    })
  })

  test('returns the flat file refs from useCwaFile', () => {
    const { contentUrl } = useCwaFileField({ iri: '/resources/1' })
    expect(contentUrl.value).toBe('/mock.jpg')
  })

  test('passes mediaObjects computed from the resolved resource metadata', () => {
    const mediaObjects = { heroImage: [{ contentUrl: '/hero.jpg', fileSize: 1, mimeType: 'image/jpeg', formattedFileSize: '1B' }] }
    mockResource.value = { data: { _metadata: { mediaObjects } } }
    useCwaFileField({ iri: '/resources/1' }, { fileProp: 'heroImage' })
    const passed = vi.mocked(cwaFileModule.useCwaFile).mock.calls[0]![1]
    expect(passed.mediaObjects.value).toEqual(mediaObjects)
  })

  test('empty mediaObjects when the resource is not resolved', () => {
    useCwaFileField({ iri: '/resources/1' })
    const passed = vi.mocked(cwaFileModule.useCwaFile).mock.calls[0]![1]
    expect(passed.mediaObjects.value).toEqual({})
  })

  test('defaults the template ref name to the fileProp', () => {
    useCwaFileField({ iri: '/resources/1' }, { fileProp: 'thumbnail' })
    const passed = vi.mocked(cwaFileModule.useCwaFile).mock.calls[0]![1]
    expect(passed.imageRef.value).toEqual({ __ref: 'thumbnail' })
  })

  test('passes imagineFilterName through', () => {
    useCwaFileField({ iri: '/resources/1' }, { imagineFilterName: 'square' })
    const passed = vi.mocked(cwaFileModule.useCwaFile).mock.calls[0]![1]
    expect(passed.imagineFilterName).toBe('square')
  })
})
