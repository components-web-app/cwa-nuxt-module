// @vitest-environment happy-dom

import { describe, expect, test, vi, beforeEach } from 'vitest'
import { ref, computed } from 'vue'
import * as cwaImageModule from '#cwa/composables/cwa-image'
import { withImage } from '#cwa/composables/cwa-image-plugin'

vi.mock('vue', async () => {
  const mod = await vi.importActual<typeof import('vue')>('vue')
  return { ...mod, useTemplateRef: vi.fn(() => ref(null)) }
})

vi.mock('#cwa/composables/cwa-image', () => ({
  useCwaImage: vi.fn(() => ({
    contentUrl: computed(() => '/mock.jpg'),
    displayMedia: computed(() => undefined),
    handleLoad: vi.fn(),
    loaded: ref(false),
  })),
}))

describe('withImage', () => {
  function makeCtx(resourceValue: any = undefined) {
    return {
      iri: ref('/image/1'),
      resource: ref(resourceValue),
      $cwa: {} as any,
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(cwaImageModule.useCwaImage).mockReturnValue({
      contentUrl: computed(() => '/mock.jpg'),
      displayMedia: computed(() => undefined),
      handleLoad: vi.fn(),
      loaded: ref(false),
    })
  })

  test('returns empty object mediaObjects when resource has no data', () => {
    const { mediaObjects } = withImage()(makeCtx())
    expect(mediaObjects.value).toEqual({})
  })

  test('computes mediaObjects from resource._metadata', () => {
    const mediaObjects = { file: [{ contentUrl: '/img.jpg', fileSize: 100, mimeType: 'image/jpeg', formattedFileSize: '100B' }] }
    const { mediaObjects: result } = withImage()(makeCtx({ data: { _metadata: { mediaObjects } } }))
    expect(result.value).toEqual(mediaObjects)
  })

  test('delegates contentUrl from useCwaImage', () => {
    const { contentUrl } = withImage()(makeCtx())
    expect(contentUrl.value).toBe('/mock.jpg')
  })

  test('passes iri and imageOps through to useCwaImage', () => {
    const imageRef = ref(null) as any
    withImage({ imagineFilterName: 'thumbnail', imageRef })(makeCtx())
    expect(cwaImageModule.useCwaImage).toHaveBeenCalledWith(
      expect.objectContaining({ value: '/image/1' }),
      expect.objectContaining({ imagineFilterName: 'thumbnail', imageRef }),
    )
  })

  test('uses default imageRef from useTemplateRef when none provided', () => {
    withImage()(makeCtx())
    expect(cwaImageModule.useCwaImage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ imageRef: expect.objectContaining({ value: null }) }),
    )
  })
})
