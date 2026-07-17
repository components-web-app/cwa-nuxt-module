// @vitest-environment happy-dom

import { describe, expect, test, vi, beforeEach } from 'vitest'
import { ref, computed, useTemplateRef } from 'vue'
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

  // #267: the template ref used to be auto-registered from the `fileProp`, so two calls sharing a
  // `fileProp` collided on the same key — a warning in dev but `TypeError: Cannot redefine
  // property` in a production build. Registration is now the caller's job.
  test('never registers a template ref implicitly', () => {
    useCwaFileField({ iri: '/resources/1' }, { fileProp: 'thumbnail' })
    expect(vi.mocked(useTemplateRef)).not.toHaveBeenCalled()
    const passed = vi.mocked(cwaFileModule.useCwaFile).mock.calls[0]![1]
    expect(passed.imageRef).toBeUndefined()
  })

  test('passes an explicitly supplied imageRef through', () => {
    const imageRef = ref(null)
    useCwaFileField({ iri: '/resources/1' }, { fileProp: 'thumbnail', imageRef })
    const passed = vi.mocked(cwaFileModule.useCwaFile).mock.calls[0]![1]
    expect(passed.imageRef).toBe(imageRef)
    expect(vi.mocked(useTemplateRef)).not.toHaveBeenCalled()
  })

  test('passes imagineFilterName through', () => {
    useCwaFileField({ iri: '/resources/1' }, { imagineFilterName: 'square' })
    const passed = vi.mocked(cwaFileModule.useCwaFile).mock.calls[0]![1]
    expect(passed.imagineFilterName).toBe('square')
  })
})
