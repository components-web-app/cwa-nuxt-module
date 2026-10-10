// @vitest-environment happy-dom
import { describe, expect, test, vi, beforeEach } from 'vitest'
import { ref, computed, reactive, type Ref } from 'vue'
import { useCwaFile } from '#cwa/composables/cwa-file'
import type { FileOpsType, MediaFile } from '#cwa/composables/cwa-file'

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

  describe('srcset', () => {
    async function useWithQuery(query: Ref<string>, file: MediaFile[]) {
      const { useCwaResourceEndpoint } = await import('#cwa/composables/cwa-resource-endpoint')
      vi.mocked(useCwaResourceEndpoint).mockReturnValueOnce({ endpoint: ref('/my/resource'), query } as any)
      const media = reactive<Record<string, MediaFile[]>>({ file })
      return useCwaFile(iri, makeOps({ mediaObjects: computed(() => media) }))
    }

    function variant(contentUrl: string, width: number | null, fileSize = 1000, imagineFilter?: string): MediaFile {
      return { contentUrl, width: width as number, height: width as number, fileSize, mimeType: 'image/jpeg', formattedFileSize: '', imagineFilter }
    }

    test('carries the endpoint query on every url and leaves the stored media objects unchanged', async () => {
      const original = variant('/orig.jpg', 2400)
      const general = variant('/general.jpg', 1200, 500, 'general')
      const { srcset } = await useWithQuery(ref('?published=true'), [original, general])
      expect(srcset.value).toBe('/general.jpg?published=true 1200w, /orig.jpg?published=true 2400w')
      expect(original.contentUrl).toBe('/orig.jpg')
      expect(general.contentUrl).toBe('/general.jpg')
    })

    test('follows a change of the endpoint query', async () => {
      const query = ref('?published=true')
      const { srcset } = await useWithQuery(query, [variant('/orig.jpg', 2400), variant('/general.jpg', 1200, 500, 'general')])
      expect(srcset.value).toBe('/general.jpg?published=true 1200w, /orig.jpg?published=true 2400w')
      query.value = '?published=false'
      expect(srcset.value).toBe('/general.jpg?published=false 1200w, /orig.jpg?published=false 2400w')
    })

    test('is undefined before the resource has media metadata', () => {
      const { srcset } = useCwaFile(iri, makeOps({ mediaObjects: computed(() => ({})) }))
      expect(srcset.value).toBeUndefined()
    })

    test('lists variants by ascending width and skips those without a known width', async () => {
      const { srcset } = await useWithQuery(ref(''), [
        variant('/orig.jpg', 2400),
        variant('/general.jpg', 1200, 500, 'general'),
        variant('/thumb.jpg', 500, 100, 'thumbnail'),
        variant('/no-info.jpg', -1, -1, 'hero'),
        variant('/no-width.jpg', null, 100, 'other'),
      ])
      expect(srcset.value).toBe('/thumb.jpg 500w, /general.jpg 1200w, /orig.jpg 2400w')
    })

    test('keeps the smaller file when two variants share a width', async () => {
      const { srcset } = await useWithQuery(ref(''), [
        variant('/orig.jpg', 400, 900000),
        variant('/thumb.jpg', 400, 60000, 'thumbnail'),
        variant('/tiny.jpg', 100, 5000, 'tiny'),
      ])
      expect(srcset.value).toBe('/tiny.jpg 100w, /thumb.jpg 400w')
    })

    test('is undefined when only one variant has a known width', async () => {
      const { srcset } = await useWithQuery(ref(''), [variant('/orig.jpg', 2400), variant('/no-info.jpg', -1, -1, 'general')])
      expect(srcset.value).toBeUndefined()
    })

    test('is undefined for an SVG', async () => {
      const svg = { ...variant('/logo.svg', 300), mimeType: 'image/svg+xml' }
      const { srcset } = await useWithQuery(ref(''), [svg])
      expect(srcset.value).toBeUndefined()
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

    describe('when the ref is not a bare img element', () => {
      test('resolves a component instance to its root element and respects its load state', () => {
        const component = { $el: { complete: false, naturalHeight: 0 } }
        const ops = makeOps({ imageRef: ref(component as any) })
        const { loaded } = useCwaFile(iri, ops)
        expect(loaded.value).toBe(false)
      })

      test('a component instance whose image is already loaded still auto-loads', () => {
        const component = { $el: { complete: true, naturalHeight: 100 } }
        const ops = makeOps({ imageRef: ref(component as any) })
        const { loaded } = useCwaFile(iri, ops)
        expect(loaded.value).toBe(true)
      })

      test('does not auto-load when the ref is missing (e.g. ref name does not match fileProp)', () => {
        const ops = makeOps({ imageRef: ref(null) as any })
        const { loaded } = useCwaFile(iri, ops)
        expect(loaded.value).toBe(false)
      })

      test('does not auto-load when the ref is a non-image element', () => {
        const ops = makeOps({ imageRef: ref({ tagName: 'DIV' } as any) })
        const { loaded } = useCwaFile(iri, ops)
        expect(loaded.value).toBe(false)
      })
    })

    describe('when no imageRef is supplied', () => {
      test('skips the mount check without throwing and waits for @load', () => {
        const ops: FileOpsType = { mediaObjects: computed(() => ({})) }
        let loaded: ReturnType<typeof useCwaFile>['loaded']
        expect(() => ({ loaded } = useCwaFile(iri, ops))).not.toThrow()
        expect(loaded!.value).toBe(false)
      })

      test('handleLoad still marks it loaded', () => {
        const ops: FileOpsType = { mediaObjects: computed(() => ({})) }
        const { handleLoad, loaded } = useCwaFile(iri, ops)
        handleLoad()
        expect(loaded.value).toBe(true)
      })
    })
  })
})
