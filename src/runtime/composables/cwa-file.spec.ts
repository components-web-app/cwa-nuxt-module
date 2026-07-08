// @vitest-environment happy-dom
import { describe, expect, test, vi, beforeEach } from 'vitest'
import { ref, computed } from 'vue'
import { useCwaFile } from '#cwa/composables/cwa-file'
import type { FileOpsType } from '#cwa/composables/cwa-file'

const mockQuery = vi.hoisted(() => ({ value: '' }))

vi.mock('#cwa/composables/cwa-resource-endpoint', () => ({
  useCwaResourceEndpoint: vi.fn(() => ({
    endpoint: ref('/my/resource'),
    query: ref(mockQuery.value),
  })),
}))

vi.mock('vue', async () => {
  const mod = await vi.importActual<typeof import('vue')>('vue')
  return { ...mod, onMounted: vi.fn(fn => fn()) }
})

function makeOps(overrides: Partial<FileOpsType> = {}): FileOpsType {
  return {
    // explicit complete:false + naturalHeight:0 avoids the onMounted auto-load path
    imageRef: ref({ complete: false, naturalHeight: 0 } as any),
    mediaObjects: computed(() => ({})),
    ...overrides,
  }
}

describe('useCwaFile', () => {
  const iri = ref('/resources/1')

  beforeEach(() => {
    mockQuery.value = ''
    vi.clearAllMocks()
  })

  describe('handleLoad', () => {
    test('sets loaded to true', () => {
      const { handleLoad, loaded } = useCwaFile(iri, makeOps())
      expect(loaded.value).toBe(false)
      handleLoad()
      expect(loaded.value).toBe(true)
    })
  })

  describe('displayMedia', () => {
    test('returns undefined when mediaObjects is empty', () => {
      const ops = makeOps({ mediaObjects: computed(() => ({})) })
      const { displayMedia } = useCwaFile(iri, ops)
      expect(displayMedia.value).toBeUndefined()
    })

    test('returns undefined when fileProperty has no media items', () => {
      const ops = makeOps({ mediaObjects: computed(() => ({ file: [] })) })
      const { displayMedia } = useCwaFile(iri, ops)
      expect(displayMedia.value).toBeUndefined()
    })

    test('returns matching imagineFilter item', () => {
      const thumbnail = { contentUrl: '/thumb.jpg', fileSize: 100, mimeType: 'image/jpeg', formattedFileSize: '100B', imagineFilter: 'thumb' }
      const original = { contentUrl: '/orig.jpg', fileSize: 1000, mimeType: 'image/jpeg', formattedFileSize: '1KB' }
      const ops = makeOps({
        imagineFilterName: 'thumb',
        mediaObjects: computed(() => ({ file: [original, thumbnail] })),
      })
      const { displayMedia } = useCwaFile(iri, ops)
      expect(displayMedia.value).toEqual(thumbnail)
    })

    test('falls back to first item when no imagineFilter match', () => {
      const first = { contentUrl: '/first.jpg', fileSize: 100, mimeType: 'image/jpeg', formattedFileSize: '100B' }
      const ops = makeOps({
        imagineFilterName: 'thumb',
        mediaObjects: computed(() => ({ file: [first] })),
      })
      const { displayMedia } = useCwaFile(iri, ops)
      expect(displayMedia.value).toEqual(first)
    })

    test('uses custom fileProp when set', () => {
      const media = { contentUrl: '/avatar.jpg', fileSize: 100, mimeType: 'image/jpeg', formattedFileSize: '100B' }
      const ops = makeOps({
        fileProp: 'avatar',
        mediaObjects: computed(() => ({ avatar: [media] })),
      })
      const { displayMedia } = useCwaFile(iri, ops)
      expect(displayMedia.value).toEqual(media)
    })
  })

  describe('contentUrl', () => {
    test('returns undefined when no displayMedia', () => {
      const ops = makeOps({ mediaObjects: computed(() => ({})) })
      const { contentUrl } = useCwaFile(iri, ops)
      expect(contentUrl.value).toBeUndefined()
    })

    test('returns contentUrl without query when query is empty', async () => {
      const media = { contentUrl: '/image.jpg', fileSize: 100, mimeType: 'image/jpeg', formattedFileSize: '100B' }
      const { useCwaResourceEndpoint } = await import('#cwa/composables/cwa-resource-endpoint')
      vi.mocked(useCwaResourceEndpoint).mockReturnValueOnce({ endpoint: ref('/my/resource'), query: ref('') } as any)
      const ops = makeOps({ mediaObjects: computed(() => ({ file: [media] })) })
      const { contentUrl } = useCwaFile(iri, ops)
      expect(contentUrl.value).toBe('/image.jpg')
    })

    test('appends query string to contentUrl', async () => {
      const media = { contentUrl: '/image.jpg', fileSize: 100, mimeType: 'image/jpeg', formattedFileSize: '100B' }
      const queryRef = ref('?size=large')
      const { useCwaResourceEndpoint } = await import('#cwa/composables/cwa-resource-endpoint')
      vi.mocked(useCwaResourceEndpoint).mockReturnValueOnce({ endpoint: ref('/my/resource'), query: queryRef } as any)
      const ops = makeOps({ mediaObjects: computed(() => ({ file: [media] })) })
      const { contentUrl } = useCwaFile(iri, ops)
      expect(contentUrl.value).toBe('/image.jpg?size=large')
    })
  })

  describe('onMounted', () => {
    test('calls handleLoad if imageRef is complete', () => {
      const imageEl = { complete: true, naturalHeight: 0 }
      const ops = makeOps({ imageRef: ref(imageEl as any) })
      const { loaded } = useCwaFile(iri, ops)
      expect(loaded.value).toBe(true)
    })

    test('calls handleLoad if naturalHeight is non-zero', () => {
      const imageEl = { complete: false, naturalHeight: 100 }
      const ops = makeOps({ imageRef: ref(imageEl as any) })
      const { loaded } = useCwaFile(iri, ops)
      expect(loaded.value).toBe(true)
    })

    test('does not call handleLoad if image is not loaded', () => {
      const imageEl = { complete: false, naturalHeight: 0 }
      const ops = makeOps({ imageRef: ref(imageEl as any) })
      const { loaded } = useCwaFile(iri, ops)
      expect(loaded.value).toBe(false)
    })
  })
})
