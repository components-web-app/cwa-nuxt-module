// @vitest-environment happy-dom
import { describe, expect, test, vi } from 'vitest'
import { ref, computed } from 'vue'
import { useCwaImageResource } from '#cwa/composables/cwa-image-resource'

vi.mock('vue', async () => {
  const mod = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...mod,
    onMounted: vi.fn(fn => fn()),
    useTemplateRef: vi.fn(() => ref(null)),
  }
})

const mockGetResource = vi.hoisted(() => vi.fn())
vi.mock('#cwa/composables/cwa-resource', () => ({
  useCwaResource: vi.fn(() => ({
    getResource: mockGetResource,
    exposeMeta: {},
  })),
}))

vi.mock('#cwa/composables/cwa-image', () => ({
  useCwaImage: vi.fn(() => ({
    contentUrl: computed(() => '/mock.jpg'),
    displayMedia: computed(() => undefined),
    handleLoad: vi.fn(),
    loaded: ref(false),
  })),
}))

vi.mock('#cwa/composables/cwa-resource-endpoint', () => ({
  useCwaResourceEndpoint: vi.fn(() => ({
    endpoint: ref('/my/resource'),
    query: ref(''),
  })),
}))

describe('useCwaImageResource', () => {
  const iri = ref('/image/1')

  test('returns resource from useCwaResource', () => {
    const mockResource = ref({ data: { _metadata: { mediaObjects: {} } } })
    mockGetResource.mockReturnValue(mockResource)
    const { resource } = useCwaImageResource(iri)
    expect(resource).toBe(mockResource)
  })

  test('returns mediaObjects computed from resource data', () => {
    const mediaObjects = { file: [{ contentUrl: '/img.jpg', fileSize: 100, mimeType: 'image/jpeg', formattedFileSize: '100B' }] }
    mockGetResource.mockReturnValue(ref({
      data: { _metadata: { mediaObjects } },
    }))
    const { mediaObjects: result } = useCwaImageResource(iri)
    expect(result.value).toEqual(mediaObjects)
  })

  test('returns undefined mediaObjects when resource has no data', () => {
    mockGetResource.mockReturnValue(ref(undefined))
    const { mediaObjects } = useCwaImageResource(iri)
    expect(mediaObjects.value).toBeUndefined()
  })

  test('delegates contentUrl from useCwaImage', () => {
    mockGetResource.mockReturnValue(ref({ data: { _metadata: { mediaObjects: {} } } }))
    const { contentUrl } = useCwaImageResource(iri)
    expect(contentUrl.value).toBe('/mock.jpg')
  })
})
