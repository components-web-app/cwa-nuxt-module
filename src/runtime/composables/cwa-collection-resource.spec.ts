// @vitest-environment happy-dom
import { describe, expect, test, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useCwaCollectionResource } from '#cwa/composables/cwa-collection-resource'

const mockGetResource = vi.hoisted(() => vi.fn())
const mockFetch = vi.hoisted(() => vi.fn())
const mockGetResourceRoute = vi.hoisted(() => vi.fn())

// var hoisted to module scope; assigned reactively inside vi.mock factory
// eslint-disable-next-line no-var
var mockRoute: { query: Record<string, any> }

vi.mock('vue-router', async () => {
  const { reactive } = await import('vue')
  mockRoute = reactive({ query: {} as Record<string, any> })
  const mod = await vi.importActual<typeof import('vue-router')>('vue-router')
  return {
    ...mod,
    useRoute: () => mockRoute,
    useRouter: () => ({ replace: vi.fn() }),
  }
})

vi.mock('#cwa/composables/cwa-resource', () => ({
  useCwaResource: vi.fn(() => ({
    getResource: mockGetResource,
    exposeMeta: {},
  })),
}))

vi.mock('#cwa/composables/useCwaResourceRoute', () => ({
  useCwaResourceRoute: vi.fn(() => ({ getResourceRoute: mockGetResourceRoute })),
}))

vi.mock('#cwa/composables/cwa', () => ({
  useCwa: vi.fn(() => ({
    fetch: mockFetch,
  })),
}))

vi.mock('#cwa/composables/cwa-query-bound-model', () => ({
  useQueryBoundModel: vi.fn((_key: string, opts: { defaultValue: any }) => ({
    model: ref(opts?.defaultValue ?? null),
  })),
}))

describe('useCwaCollectionResource', () => {
  const iri = ref('/collection/1')

  beforeEach(() => {
    iri.value = '/collection/1'
    mockRoute.query = {}
    vi.clearAllMocks()
    mockGetResource.mockReturnValue(ref(undefined))
    mockFetch.mockReturnValue({ response: Promise.resolve({ _data: undefined }) })
  })

  describe('collectionItems', () => {
    test('returns undefined when resource has no collection data', () => {
      mockGetResource.mockReturnValue(ref(undefined))
      const { collectionItems } = useCwaCollectionResource(iri)
      expect(collectionItems.value).toBeUndefined()
    })

    test('returns member from resource.data.collection', () => {
      const members = [{ '@id': '/item/1' }]
      mockGetResource.mockReturnValue(ref({ data: { collection: { member: members } } }))
      const { collectionItems } = useCwaCollectionResource(iri)
      expect(collectionItems.value).toEqual(members)
    })
  })

  describe('populateCollectionData', () => {
    test('sets totalPages to 1 when view has no last', () => {
      mockGetResource.mockReturnValue(ref({
        data: { collection: { member: [], view: {} } },
      }))
      const { totalPages } = useCwaCollectionResource(iri)
      expect(totalPages.value).toBe(1)
    })

    test('sets totalPages from last page URL param', () => {
      mockGetResource.mockReturnValue(ref({
        data: { collection: { member: [], view: { last: '/collection?page=5' } } },
      }))
      const { totalPages } = useCwaCollectionResource(iri)
      expect(totalPages.value).toBe(5)
    })

    test('sets totalPages to 1 when last URL has no page param', () => {
      mockGetResource.mockReturnValue(ref({
        data: { collection: { member: [], view: { last: '/collection?other=x' } } },
      }))
      const { totalPages } = useCwaCollectionResource(iri)
      expect(totalPages.value).toBe(1)
    })
  })

  describe('goToNextPage', () => {
    test('increments pageModel when below total pages', () => {
      mockGetResource.mockReturnValue(ref({
        data: { collection: { member: [], view: { last: '/collection?page=5' } } },
      }))
      const { goToNextPage, pageModel } = useCwaCollectionResource(iri)
      pageModel.value = 2
      goToNextPage()
      expect(pageModel.value).toBe(3)
    })

    test('does nothing when already on last page', () => {
      mockGetResource.mockReturnValue(ref({
        data: { collection: { member: [], view: { last: '/collection?page=3' } } },
      }))
      const { goToNextPage, pageModel } = useCwaCollectionResource(iri)
      pageModel.value = 3
      goToNextPage()
      expect(pageModel.value).toBe(3)
    })
  })

  describe('goToPreviousPage', () => {
    test('decrements pageModel when above page 1', () => {
      const { goToPreviousPage, pageModel } = useCwaCollectionResource(iri)
      pageModel.value = 3
      goToPreviousPage()
      expect(pageModel.value).toBe(2)
    })

    test('does nothing when on first page', () => {
      const { goToPreviousPage, pageModel } = useCwaCollectionResource(iri)
      pageModel.value = 1
      goToPreviousPage()
      expect(pageModel.value).toBe(1)
    })

    test('does nothing when pageModel is 0', () => {
      const { goToPreviousPage, pageModel } = useCwaCollectionResource(iri)
      pageModel.value = 0
      goToPreviousPage()
      expect(pageModel.value).toBe(0)
    })
  })

  describe('changePage', () => {
    test('sets pageModel and calls window.scrollTo', () => {
      const scrollToMock = vi.fn()
      window.scrollTo = scrollToMock
      const { changePage, pageModel } = useCwaCollectionResource(iri)
      changePage(4)
      expect(pageModel.value).toBe(4)
      expect(scrollToMock).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'smooth' })
    })
  })

  describe('route query watcher', () => {
    test('calls fetch when non-pagination query keys change', async () => {
      mockGetResource.mockReturnValue(ref({ data: { resourceIri: '/data/1' } }))
      mockFetch.mockReturnValue({ response: Promise.resolve({ _data: undefined }) })
      useCwaCollectionResource(iri)
      mockRoute.query = { search: 'hello' }
      await nextTick()
      await nextTick()
      expect(mockFetch).toHaveBeenCalled()
    })

    test('resets page to 1 and fetches when non-pagination query changes', async () => {
      mockGetResource.mockReturnValue(ref({ data: { resourceIri: '/data/1' } }))
      mockFetch.mockReturnValue({ response: Promise.resolve({ _data: undefined }) })
      const { pageModel } = useCwaCollectionResource(iri)
      pageModel.value = 3
      mockRoute.query = { filter: 'active' }
      await nextTick()
      await nextTick()
      expect(pageModel.value).toBe(1)
    })

    test('does not reset page when only pagination params change', async () => {
      mockGetResource.mockReturnValue(ref({ data: { resourceIri: '/data/1' } }))
      mockFetch.mockReturnValue({ response: Promise.resolve({ _data: undefined }) })
      const { pageModel } = useCwaCollectionResource(iri)
      pageModel.value = 3
      mockRoute.query = { page: '2' }
      await nextTick()
      await nextTick()
      expect(pageModel.value).toBe(3)
    })
  })

  describe('resource data watcher', () => {
    test('updates collectionItems when resource data changes', async () => {
      const resource = ref<any>(undefined)
      mockGetResource.mockReturnValue(resource)
      const { collectionItems } = useCwaCollectionResource(iri)
      expect(collectionItems.value).toBeUndefined()

      resource.value = {
        data: { collection: { member: [{ '@id': '/new' }], view: {} } },
      }
      await nextTick()
      expect(collectionItems.value).toEqual([{ '@id': '/new' }])
    })
  })

  describe('resolveResourceLink', () => {
    test('returns getResourceRoute from useCwaResourceRoute', () => {
      const { resolveResourceLink } = useCwaCollectionResource(iri)
      expect(resolveResourceLink).toBe(mockGetResourceRoute)
    })
  })
})
