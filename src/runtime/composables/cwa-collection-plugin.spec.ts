// @vitest-environment happy-dom

import { describe, expect, test, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { withCollection } from '#cwa/composables/cwa-collection-plugin'

const mockFetch = vi.hoisted(() => vi.fn())
const mockGetResourceRoute = vi.hoisted(() => vi.fn())

// eslint-disable-next-line no-var
var mockRoute: { query: Record<string, any> }
vi.mock('vue-router', async () => {
  const { reactive } = await import('vue')
  mockRoute = reactive({ query: {} as Record<string, any> })
  const mod = await vi.importActual<typeof import('vue-router')>('vue-router')
  return { ...mod, useRoute: () => mockRoute, useRouter: () => ({ replace: vi.fn() }) }
})

vi.mock('#cwa/composables/useCwaResourceRoute', () => ({
  useCwaResourceRoute: vi.fn(() => ({ getResourceRoute: mockGetResourceRoute })),
}))

vi.mock('#cwa/composables/cwa-query-bound-model', () => ({
  useQueryBoundModel: vi.fn((_key: string, opts: { defaultValue: any }) => ({
    model: ref(opts?.defaultValue ?? null),
  })),
}))

describe('withCollection', () => {
  function makeCtx(resourceValue: any = undefined) {
    return {
      iri: ref('/collection/1'),
      resource: ref(resourceValue),
      $cwa: { fetch: mockFetch } as any,
    }
  }

  beforeEach(() => {
    mockRoute.query = {}
    vi.clearAllMocks()
    mockFetch.mockReturnValue({ response: Promise.resolve({ _data: undefined }) })
  })

  describe('collectionItems', () => {
    test('returns undefined when resource has no collection data', () => {
      const { collectionItems } = withCollection()(makeCtx())
      expect(collectionItems.value).toBeUndefined()
    })

    test('returns member from resource.data.collection', () => {
      const members = [{ '@id': '/item/1' }]
      const { collectionItems } = withCollection()(makeCtx({ data: { collection: { member: members } } }))
      expect(collectionItems.value).toEqual(members)
    })
  })

  describe('totalPages', () => {
    test('defaults to 1 when view has no last', () => {
      const { totalPages } = withCollection()(makeCtx({ data: { collection: { member: [], view: {} } } }))
      expect(totalPages.value).toBe(1)
    })

    test('parses totalPages from last page URL', () => {
      const { totalPages } = withCollection()(makeCtx({ data: { collection: { member: [], view: { last: '/collection?page=5' } } } }))
      expect(totalPages.value).toBe(5)
    })

    test('defaults to 1 when last URL has no page param', () => {
      const { totalPages } = withCollection()(makeCtx({ data: { collection: { member: [], view: { last: '/collection?other=x' } } } }))
      expect(totalPages.value).toBe(1)
    })
  })

  describe('goToNextPage', () => {
    test('increments pageModel when below total pages', () => {
      const { goToNextPage, pageModel } = withCollection()(makeCtx({ data: { collection: { member: [], view: { last: '/collection?page=5' } } } }))
      pageModel.value = 2
      goToNextPage()
      expect(pageModel.value).toBe(3)
    })

    test('does nothing when already on last page', () => {
      const { goToNextPage, pageModel } = withCollection()(makeCtx({ data: { collection: { member: [], view: { last: '/collection?page=3' } } } }))
      pageModel.value = 3
      goToNextPage()
      expect(pageModel.value).toBe(3)
    })
  })

  describe('goToPreviousPage', () => {
    test('decrements pageModel when above page 1', () => {
      const { goToPreviousPage, pageModel } = withCollection()(makeCtx())
      pageModel.value = 3
      goToPreviousPage()
      expect(pageModel.value).toBe(2)
    })

    test('does nothing when on first page', () => {
      const { goToPreviousPage, pageModel } = withCollection()(makeCtx())
      pageModel.value = 1
      goToPreviousPage()
      expect(pageModel.value).toBe(1)
    })

    test('does nothing when pageModel is 0', () => {
      const { goToPreviousPage, pageModel } = withCollection()(makeCtx())
      pageModel.value = 0
      goToPreviousPage()
      expect(pageModel.value).toBe(0)
    })
  })

  describe('changePage', () => {
    test('sets pageModel and scrolls to top', () => {
      window.scrollTo = vi.fn()
      const { changePage, pageModel } = withCollection()(makeCtx())
      changePage(4)
      expect(pageModel.value).toBe(4)
      expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'smooth' })
    })
  })

  describe('route query watcher', () => {
    test('fetches when non-pagination query keys change', async () => {
      withCollection()(makeCtx({ data: { resourceIri: '/data/1' } }))
      mockRoute.query = { search: 'hello' }
      await nextTick()
      await nextTick()
      expect(mockFetch).toHaveBeenCalled()
    })

    test('resets page to 1 when non-pagination query changes', async () => {
      const { pageModel } = withCollection()(makeCtx({ data: { resourceIri: '/data/1' } }))
      pageModel.value = 3
      mockRoute.query = { filter: 'active' }
      await nextTick()
      await nextTick()
      expect(pageModel.value).toBe(1)
    })

    test('does not reset page when only pagination params change', async () => {
      const { pageModel } = withCollection()(makeCtx({ data: { resourceIri: '/data/1' } }))
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
      const { collectionItems } = withCollection()({ iri: ref('/collection/1'), resource, $cwa: { fetch: mockFetch } as any })
      expect(collectionItems.value).toBeUndefined()
      resource.value = { data: { collection: { member: [{ '@id': '/new' }], view: {} } } }
      await nextTick()
      expect(collectionItems.value).toEqual([{ '@id': '/new' }])
    })
  })

  describe('resolveResourceLink', () => {
    test('delegates to useCwaResourceRoute', () => {
      const { resolveResourceLink } = withCollection()(makeCtx())
      expect(resolveResourceLink).toBe(mockGetResourceRoute)
    })
  })
})
