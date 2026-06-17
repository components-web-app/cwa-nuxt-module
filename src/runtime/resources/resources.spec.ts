import { describe, test, expect, vi } from 'vitest'
import { computed } from 'vue'
import { Resources } from './resources'
import { CwaResourceApiStatuses } from '#cwa/storage/stores/resources/state'
import * as utils from '#cwa/resources/resource-utils'

function createResources(mockFetcherStoreResponse: any = undefined, mockResourcesStoreResponse: any = undefined) {
  const mockResourcesStore = {
    useStore() {
      const current = {
        currentIds: [] as string[],
        byId: {},
      }
      return mockResourcesStoreResponse || {
        current,
        getResource: vi.fn(id => current.byId[id]),
      }
    },
  }

  const mockFetcherStore = {
    useStore() {
      return mockFetcherStoreResponse || {
        primaryFetch: {
          fetchingToken: '123' as string | null,
        },
        fetches: {},
        resolvedSuccessFetchStatus: computed(() => ({ path: '/test', isPrimary: true, resources: ['1', '2'] })),
      }
    },
  }

  // @ts-expect-error
  const resources = new Resources(mockResourcesStore, mockFetcherStore)

  return { resources, resourcesStore: mockResourcesStore, fetcherStore: mockFetcherStore }
}

describe('Resources', () => {
  describe('current ids', () => {
    test('should return current ids BASED on resources store', () => {
      const mockIds = ['1', '2', '3']
      const mockResourcesStore = {
        current: {
          byId: {},
          currentIds: mockIds,
        },
      }
      const { resources } = createResources(undefined, mockResourcesStore)

      expect(resources.currentIds).toEqual(mockIds)
    })
  })

  describe('getResource', () => {
    test('should return resource BASED on its id', () => {
      const mockId = 'mockedId'
      const mockResource = { test: true }
      const current = {
        byId: {
          [mockId]: mockResource,
        },
        currentIds: [],
      }

      const mockResourcesStore = {
        current,
        getResource: vi.fn(id => current.byId[id]),
      }
      const { resources } = createResources(undefined, mockResourcesStore)

      expect(resources.getResource(mockId).value).toEqual(mockResource)
    })

    test('should return nothing IF resource with requested id does not exist', () => {
      const mockId = 'mockedId'

      const mockResourcesStore = {
        current: {
          byId: {},
          currentIds: [],
        },
        getResource: vi.fn(() => undefined),
      }

      const { resources } = createResources(undefined, mockResourcesStore)

      expect(resources.getResource(mockId).value).toBeUndefined()
    })
  })

  describe('currentResources', () => {
    test('should return formatted resources', () => {
      const resourceA = { id: 'a', otherData: {} }
      const resourceB = { id: 'b', otherData: {} }
      const resourceC = { id: 'c', otherData: {} }
      const current = {
        byId: {
          a: resourceA,
          b: resourceB,
          c: resourceC,
        },
        currentIds: ['a', 'b', 'c'],
      }

      const mockResourcesStore = {
        current,
        getResource: vi.fn(id => current.byId[id]),
      }

      const { resources } = createResources(undefined, mockResourcesStore)

      expect(resources.currentResources).toEqual({
        a: resourceA,
        b: resourceB,
        c: resourceC,
      })
    })
  })

  describe('displayFetchStatus', () => {
    test('should return resolvedSuccessFetchStatus IF fetching token is not present', () => {
      const mockStatus = { success: 'mock' }

      const mockFetcherStore = {
        primaryFetch: {
          fetchingToken: null,
        },
        resolvedSuccessFetchStatus: mockStatus,
      }

      const { resources } = createResources(mockFetcherStore)

      expect(resources.displayFetchStatus).toEqual(mockStatus)
    })

    test('should return resolvedSuccessFetchStatus IF no fetches are found by fetching token', () => {
      const mockStatus = { success: 'mock' }

      const mockFetcherStore = {
        primaryFetch: {
          fetchingToken: 'mock',
        },
        resolvedSuccessFetchStatus: mockStatus,
        fetches: {},
      }

      const { resources } = createResources(mockFetcherStore)

      expect(resources.displayFetchStatus).toEqual(mockStatus)
    })

    test('should return resolvedSuccessFetchStatus IF page iri is not defined', () => {
      const mockStatus = { success: 'mock' }

      const mockFetcherStore = {
        primaryFetch: {
          fetchingToken: 'abcd' as string | null,
        },
        resolvedSuccessFetchStatus: mockStatus,
        fetches: {
          abcd: { test: true },
        },
      }

      const { resources } = createResources(mockFetcherStore)

      vi.spyOn(resources, 'getPageIriByFetchStatus').mockReturnValue(null)

      expect(resources.displayFetchStatus).toEqual(mockStatus)
    })

    test('should return resolvedSuccessFetchStatus IF current ids do not include page iri', () => {
      const mockStatus = { success: 'mock' }

      const mockFetcherStore = {
        primaryFetch: {
          fetchingToken: 'abcd' as string | null,
        },
        resolvedSuccessFetchStatus: mockStatus,
        fetches: {
          abcd: { test: true },
        },
      }

      const { resources } = createResources(mockFetcherStore)

      vi.spyOn(resources, 'getPageIriByFetchStatus').mockReturnValue('this-iri-does-not-exist')

      expect(resources.displayFetchStatus).toEqual(mockStatus)
    })

    test('should return resolvedSuccessFetchStatus IF page resource has no data', () => {
      const mockStatus = { success: 'mock' }
      const mockPageIri = 'I exist'

      const mockResourcesStore = ({
        current: {
          currentIds: [mockPageIri] as string[],
          byId: {},
        },
      })

      const mockFetcherStore = {
        primaryFetch: {
          fetchingToken: 'abcd' as string | null,
        },
        resolvedSuccessFetchStatus: mockStatus,
        fetches: {
          abcd: { test: true },
        },
      }

      const { resources } = createResources(mockFetcherStore, mockResourcesStore)

      vi.spyOn(resources, 'getPageIriByFetchStatus').mockReturnValue(mockPageIri)
      vi.spyOn(resources, 'getResource').mockReturnValue({ value: { data: null } })

      expect(resources.displayFetchStatus).toEqual(mockStatus)
    })

    test('should return resolvedSuccessFetchStatus IF page resource api status IS NOT success', () => {
      const mockStatus = { success: 'mock' }
      const mockPageIri = 'I exist'

      const mockResourcesStore = {
        current: {
          currentIds: [mockPageIri] as string[],
          byId: {},
        },
      }

      const mockFetcherStore = {
        primaryFetch: {
          fetchingToken: 'abcd' as string | null,
        },
        resolvedSuccessFetchStatus: mockStatus,
        fetches: {
          abcd: { test: true },
        },
      }

      const { resources } = createResources(mockFetcherStore, mockResourcesStore)

      vi.spyOn(resources, 'getPageIriByFetchStatus').mockReturnValue(mockPageIri)
      vi.spyOn(resources, 'getResource').mockReturnValue({
        value: {
          data: {
            some: 'data',
          },
          apiState: {
            status: CwaResourceApiStatuses.IN_PROGRESS,
          },
        },
      })

      expect(resources.displayFetchStatus).toEqual(mockStatus)
    })

    test('should return fetchStatus of resource IF page resource has data and api status IS success', () => {
      const mockStatus = { success: 'mock' }
      const resourceStatus = { specific: 'status' }
      const mockPageIri = 'I exist'

      const mockResourcesStore = {
        current: {
          currentIds: [mockPageIri] as string[],
          byId: {},
        },
      }

      const mockFetcherStore = {
        primaryFetch: {
          fetchingToken: 'abcd' as string | null,
        },
        resolvedSuccessFetchStatus: mockStatus,
        fetches: {
          abcd: resourceStatus,
        },
      }

      const { resources } = createResources(mockFetcherStore, mockResourcesStore)

      vi.spyOn(resources, 'getPageIriByFetchStatus').mockReturnValue(mockPageIri)
      vi.spyOn(resources, 'getResource').mockReturnValue({
        value: {
          data: {
            some: 'data',
          },
          apiState: {
            status: CwaResourceApiStatuses.SUCCESS,
          },
        },
      })

      expect(resources.displayFetchStatus).toEqual(resourceStatus)
    })

    test('should early-switch using depth-0 irisByDepth PAGE iri when it is in currentIds and SUCCESS', () => {
      const mockPageIri = '/_/pages/parent-uuid'
      const resourceStatus = {
        specific: 'status',
        manifest: { irisByDepth: [['/_/routes//conference', mockPageIri]] },
      }

      const mockResourcesStore = {
        current: { currentIds: [mockPageIri] as string[], byId: {} },
      }

      const mockFetcherStore = {
        primaryFetch: { fetchingToken: 'abcd' as string | null },
        resolvedSuccessFetchStatus: { success: 'mock' },
        fetches: { abcd: resourceStatus },
      }

      const { resources } = createResources(mockFetcherStore, mockResourcesStore)

      vi.spyOn(resources, 'getResource').mockReturnValue({
        value: {
          data: { some: 'data' },
          apiState: { status: CwaResourceApiStatuses.SUCCESS },
        },
      })

      expect(resources.displayFetchStatus).toEqual(resourceStatus)
    })

    test('should return resolvedSuccessFetchStatus when irisByDepth depth-0 has no PAGE type IRI', () => {
      const mockStatus = { success: 'mock' }
      const fetchingStatus = {
        manifest: { irisByDepth: [['/_/routes//conference']] },
      }

      const mockFetcherStore = {
        primaryFetch: { fetchingToken: 'abcd' as string | null },
        resolvedSuccessFetchStatus: mockStatus,
        fetches: { abcd: fetchingStatus },
      }

      const { resources } = createResources(mockFetcherStore)
      expect(resources.displayFetchStatus).toEqual(mockStatus)
    })

    test('should NOT early-switch with multi-depth manifest when depth-1 page is not yet ready', () => {
      const depth0PageIri = '/_/pages/parent-uuid'
      const depth1PageIri = '/_/pages/child-uuid'
      const mockStatus = { success: 'mock' }
      const resourceStatus = {
        specific: 'status',
        manifest: {
          irisByDepth: [
            ['/_/routes//conference', depth0PageIri],
            ['/_/routes//conference/speakers', depth1PageIri],
          ],
        },
      }

      const mockResourcesStore = {
        current: { currentIds: [depth0PageIri] as string[], byId: {} },
      }

      const mockFetcherStore = {
        primaryFetch: { fetchingToken: 'abcd' as string | null },
        resolvedSuccessFetchStatus: mockStatus,
        fetches: { abcd: resourceStatus },
      }

      const { resources } = createResources(mockFetcherStore, mockResourcesStore)

      vi.spyOn(resources, 'getResource').mockImplementation((iri: string) => ({
        value: iri === depth0PageIri
          ? { data: { some: 'data' }, apiState: { status: CwaResourceApiStatuses.SUCCESS } }
          : { data: undefined, apiState: { status: CwaResourceApiStatuses.IN_PROGRESS } },
      }))

      // depth-0 is ready but depth-1 is IN_PROGRESS — must wait
      expect(resources.displayFetchStatus).toEqual(mockStatus)
    })

    test('should early-switch with multi-depth manifest when ALL depth page resources are ready', () => {
      const depth0PageIri = '/_/pages/parent-uuid'
      const depth1PageIri = '/_/pages/child-uuid'
      const resourceStatus = {
        specific: 'status',
        manifest: {
          irisByDepth: [
            ['/_/routes//conference', depth0PageIri],
            ['/_/routes//conference/speakers', depth1PageIri],
          ],
        },
      }

      const mockResourcesStore = {
        current: { currentIds: [depth0PageIri, depth1PageIri] as string[], byId: {} },
      }

      const mockFetcherStore = {
        primaryFetch: { fetchingToken: 'abcd' as string | null },
        resolvedSuccessFetchStatus: { success: 'mock' },
        fetches: { abcd: resourceStatus },
      }

      const { resources } = createResources(mockFetcherStore, mockResourcesStore)

      vi.spyOn(resources, 'getResource').mockReturnValue({
        value: { data: { some: 'data' }, apiState: { status: CwaResourceApiStatuses.SUCCESS } },
      })

      expect(resources.displayFetchStatus).toEqual(resourceStatus)
    })
  })

  describe('pageIriAtDepth', () => {
    test('returns the PAGE IRI from irisByDepth at the specified depth', () => {
      const depth1PageIri = '/_/pages/child-uuid'
      const fetchStatus = {
        manifest: {
          irisByDepth: [
            ['/_/routes//conference', '/_/pages/parent-uuid'],
            ['/_/routes//conference/speakers', depth1PageIri],
          ],
        },
      }
      const { resources } = createResources()
      vi.spyOn(resources, 'displayFetchStatus', 'get').mockReturnValue(fetchStatus as any)
      expect(resources.pageIriAtDepth(1).value).toEqual(depth1PageIri)
    })

    test('returns undefined when depth group has no PAGE type IRI', () => {
      const fetchStatus = {
        manifest: { irisByDepth: [['/_/routes//conference']] },
      }
      const { resources } = createResources()
      vi.spyOn(resources, 'displayFetchStatus', 'get').mockReturnValue(fetchStatus as any)
      expect(resources.pageIriAtDepth(0).value).toBeUndefined()
    })

    test('falls back to getPageIriByFetchStatus for depth 0 when no irisByDepth', () => {
      const mockPageIri = 'some-page-iri'
      const fetchStatus = { path: '/_/pages/1' }
      const { resources } = createResources()
      vi.spyOn(resources, 'displayFetchStatus', 'get').mockReturnValue(fetchStatus as any)
      vi.spyOn(resources, 'getPageIriByFetchStatus').mockReturnValue(mockPageIri)
      expect(resources.pageIriAtDepth(0).value).toEqual(mockPageIri)
    })

    test('returns undefined for depth > 0 when no irisByDepth', () => {
      const fetchStatus = { path: '/_/pages/1' }
      const { resources } = createResources()
      vi.spyOn(resources, 'displayFetchStatus', 'get').mockReturnValue(fetchStatus as any)
      expect(resources.pageIriAtDepth(1).value).toBeUndefined()
    })

    test('returns undefined when requested depth index does not exist in irisByDepth', () => {
      const fetchStatus = {
        manifest: { irisByDepth: [['/_/routes//conference', '/_/pages/parent-uuid']] },
      }
      const { resources } = createResources()
      vi.spyOn(resources, 'displayFetchStatus', 'get').mockReturnValue(fetchStatus as any)
      expect(resources.pageIriAtDepth(1).value).toBeUndefined()
    })
  })

  describe('pageDataIriAtDepth', () => {
    test('returns the PAGE_DATA IRI from irisByDepth at the specified depth', () => {
      const fetchStatus = {
        manifest: {
          irisByDepth: [
            ['/_/routes//conference', '/page_data/event-uuid', '/_/pages/template-uuid'],
            ['/_/routes//conference/programme', '/page_data/child-uuid', '/_/pages/child-template-uuid'],
          ],
        },
      }
      const { resources } = createResources()
      vi.spyOn(resources, 'displayFetchStatus', 'get').mockReturnValue(fetchStatus as any)
      expect(resources.pageDataIriAtDepth(0).value).toEqual('/page_data/event-uuid')
      expect(resources.pageDataIriAtDepth(1).value).toEqual('/page_data/child-uuid')
    })

    test('returns undefined when depth group has no PAGE_DATA IRI (Page-backed depth)', () => {
      const fetchStatus = {
        manifest: { irisByDepth: [['/_/routes//about', '/_/pages/page-uuid']] },
      }
      const { resources } = createResources()
      vi.spyOn(resources, 'displayFetchStatus', 'get').mockReturnValue(fetchStatus as any)
      expect(resources.pageDataIriAtDepth(0).value).toBeUndefined()
    })

    test('returns undefined when no irisByDepth', () => {
      const fetchStatus = { path: '/_/pages/uuid' }
      const { resources } = createResources()
      vi.spyOn(resources, 'displayFetchStatus', 'get').mockReturnValue(fetchStatus as any)
      expect(resources.pageDataIriAtDepth(0).value).toBeUndefined()
    })

    test('returns undefined when requested depth index does not exist in irisByDepth', () => {
      const fetchStatus = {
        manifest: { irisByDepth: [['/_/routes//conference', '/page_data/event-uuid']] },
      }
      const { resources } = createResources()
      vi.spyOn(resources, 'displayFetchStatus', 'get').mockReturnValue(fetchStatus as any)
      expect(resources.pageDataIriAtDepth(1).value).toBeUndefined()
    })
  })

  describe('pageLoadResources', () => {
    test('should return nothing IF token is not defined', () => {
      const mockFetcherStore = {
        primaryFetch: {
          fetchingToken: null,
        },
      }

      const { resources } = createResources(mockFetcherStore)

      expect(resources.pageLoadResources).toBeUndefined()
    })

    test('should return nothing IF fetch status is not defined', () => {
      const mockFetcherStore = {
        primaryFetch: {
          fetchingToken: 'abc',
        },
        fetches: {},
      }

      const { resources } = createResources(mockFetcherStore)

      expect(resources.pageLoadResources).toBeUndefined()
    })

    test('should return nothing IF fetch status type is not defined', () => {
      const mockFetcherStore = {
        primaryFetch: {
          fetchingToken: 'abc',
        },
        fetches: {
          abc: {
            mock: true,
          },
        },
      }

      const { resources } = createResources(mockFetcherStore)

      vi.spyOn(resources, 'getFetchStatusType').mockReturnValue(null)

      expect(resources.pageLoadResources).toBeUndefined()
    })

    test('should return page iri and layout iri IF fetch status type is NOT route OR page data', () => {
      const mockPageIri = 'mock page iri'
      const mockLayoutIri = 'mock layout iri'
      const mockFetchStatus = { mock: true }

      const mockFetcherStore = {
        primaryFetch: {
          fetchingToken: 'abc',
        },
        fetches: {
          abc: mockFetchStatus,
        },
      }

      const { resources } = createResources(mockFetcherStore)

      vi.spyOn(resources, 'getFetchStatusType').mockReturnValue(utils.CwaResourceTypes.COMPONENT)
      const layoutSpy = vi.spyOn(resources, 'getLayoutIriByFetchStatus').mockReturnValue(mockLayoutIri)
      const pageSpy = vi.spyOn(resources, 'getPageIriByFetchStatus').mockReturnValue(mockPageIri)

      expect(resources.pageLoadResources).toEqual([mockLayoutIri, mockPageIri])
      expect(layoutSpy).toHaveBeenCalledWith(mockFetchStatus)
      expect(pageSpy).toHaveBeenCalledWith(mockFetchStatus)
    })

    test('should return resources including path IF fetch status type is page data', () => {
      const mockPageIri = 'mock page iri'
      const mockLayoutIri = 'mock layout iri'
      const mockPath = '/test'
      const mockFetchStatus = { path: mockPath }

      const mockFetcherStore = {
        primaryFetch: {
          fetchingToken: 'abc',
        },
        fetches: {
          abc: mockFetchStatus,
        },
      }

      const { resources } = createResources(mockFetcherStore)

      vi.spyOn(resources, 'getFetchStatusType').mockReturnValue(utils.CwaResourceTypes.PAGE_DATA)
      const layoutSpy = vi.spyOn(resources, 'getLayoutIriByFetchStatus').mockReturnValue(mockLayoutIri)
      const pageSpy = vi.spyOn(resources, 'getPageIriByFetchStatus').mockReturnValue(mockPageIri)

      expect(resources.pageLoadResources).toEqual([mockLayoutIri, mockPageIri, mockPath])
      expect(layoutSpy).toHaveBeenCalledWith(mockFetchStatus)
      expect(pageSpy).toHaveBeenCalledWith(mockFetchStatus)
    })

    test('should return resources including path IF fetch status type is route', () => {
      const mockPageIri = 'mock page iri'
      const mockLayoutIri = 'mock layout iri'
      const mockPath = '/test'
      const mockFetchStatus = { path: mockPath }

      const mockFetcherStore = {
        primaryFetch: {
          fetchingToken: 'abc',
        },
        fetches: {
          abc: mockFetchStatus,
        },
      }

      const { resources } = createResources(mockFetcherStore)

      vi.spyOn(resources, 'getFetchStatusType').mockReturnValue(utils.CwaResourceTypes.ROUTE)
      const layoutSpy = vi.spyOn(resources, 'getLayoutIriByFetchStatus').mockReturnValue(mockLayoutIri)
      const pageSpy = vi.spyOn(resources, 'getPageIriByFetchStatus').mockReturnValue(mockPageIri)

      expect(resources.pageLoadResources).toEqual([mockLayoutIri, mockPageIri, mockPath])
      expect(layoutSpy).toHaveBeenCalledWith(mockFetchStatus)
      expect(pageSpy).toHaveBeenCalledWith(mockFetchStatus)
    })

    test('should return resources including path AND page data iri IF fetch status type is route AND resource has data', () => {
      const mockPageIri = 'mock page iri'
      const mockLayoutIri = 'mock layout iri'
      const mockPageData = { mock: { page: 'data' } }
      const mockRouteResource = { data: { value: { pageData: mockPageData } } }
      const mockPath = '/test'
      const mockFetchStatus = { path: mockPath }

      const mockFetcherStore = {
        primaryFetch: {
          fetchingToken: 'abc',
        },
        fetches: {
          abc: mockFetchStatus,
        },
      }

      const { resources } = createResources(mockFetcherStore)

      vi.spyOn(resources, 'getFetchStatusType').mockReturnValue(utils.CwaResourceTypes.ROUTE)
      vi.spyOn(resources, 'getResource').mockReturnValue({ value: mockRouteResource })
      const layoutSpy = vi.spyOn(resources, 'getLayoutIriByFetchStatus').mockReturnValue(mockLayoutIri)
      const pageSpy = vi.spyOn(resources, 'getPageIriByFetchStatus').mockReturnValue(mockPageIri)

      expect(resources.pageLoadResources).toEqual([mockLayoutIri, mockPageIri, mockPath, mockPageData])
      expect(layoutSpy).toHaveBeenCalledWith(mockFetchStatus)
      expect(pageSpy).toHaveBeenCalledWith(mockFetchStatus)
    })
  })

  describe('getComponentGroupByReference', () => {
    test('Returns a component if it exists with the same reference', () => {
      const component = { data: { any: 'thing', reference: 'ref' } }
      // @ts-expect-error
      const mockResourcesStore = {
        resourcesByType: {
          [utils.CwaResourceTypes.COMPONENT_GROUP]: [component, {}, {
            data: {
              some: 'dupe-not-to-return',
              reference: 'ref',
            },
          }],
        },
      }
      const { resources } = createResources(undefined, mockResourcesStore)
      expect(resources.getComponentGroupByReference('ref')).toEqual(component)
    })
  })

  describe('pageLoadProgress', () => {
    test('should return default load progress IF page load resources are not defined', () => {
      const mockFetcherStore = {
        primaryFetch: {
          fetchingToken: null,
        },
      }

      const { resources } = createResources(mockFetcherStore)

      expect(resources.pageLoadProgress.value).toEqual({
        resources: [],
        total: 0,
        complete: 0,
        percent: 100,
      })
    })

    test('should return load progress IF half of resources are loading', () => {
      const mockPageIri = 'mock page iri'
      const mockLayoutIri = 'mock layout iri'
      const mockFetchStatus = { mock: true }

      const mockFetcherStore = {
        primaryFetch: {
          fetchingToken: 'abc',
        },
        fetches: {
          abc: mockFetchStatus,
        },
      }

      const { resources } = createResources(mockFetcherStore)

      vi.spyOn(resources, 'getLayoutIriByFetchStatus').mockReturnValue(mockLayoutIri)
      vi.spyOn(resources, 'getPageIriByFetchStatus').mockReturnValue(mockPageIri)
      vi.spyOn(resources, 'getFetchStatusType').mockReturnValue(utils.CwaResourceTypes.COMPONENT)
      vi.spyOn(resources, 'getResource')
        .mockReturnValueOnce({ value: { apiState: { status: CwaResourceApiStatuses.IN_PROGRESS } } })
        .mockReturnValueOnce({ value: { apiState: { status: CwaResourceApiStatuses.SUCCESS } } })

      expect(resources.pageLoadProgress.value).toEqual({
        resources: [mockLayoutIri, mockPageIri],
        total: 2,
        complete: 1,
        percent: 50,
      })
    })

    test('should return load progress IF all resources are loading', () => {
      const mockPageIri = 'mock page iri'
      const mockLayoutIri = 'mock layout iri'
      const mockFetchStatus = { mock: true }

      const mockFetcherStore = {
        primaryFetch: {
          fetchingToken: 'abc',
        },
        fetches: {
          abc: mockFetchStatus,
        },
      }

      const { resources } = createResources(mockFetcherStore)

      vi.spyOn(resources, 'getLayoutIriByFetchStatus').mockReturnValue(mockLayoutIri)
      vi.spyOn(resources, 'getPageIriByFetchStatus').mockReturnValue(mockPageIri)
      vi.spyOn(resources, 'getFetchStatusType').mockReturnValue(utils.CwaResourceTypes.COMPONENT)
      vi.spyOn(resources, 'getResource')
        .mockReturnValue({ value: { apiState: { status: CwaResourceApiStatuses.IN_PROGRESS } } })

      expect(resources.pageLoadProgress.value).toEqual({
        resources: [mockLayoutIri, mockPageIri],
        total: 2,
        complete: 0,
        percent: 0,
      })
    })

    test('should return load progress IF some resources are loading AND some iri is not defined', () => {
      const mockLayoutIri = 'mock layout iri'
      const mockFetchStatus = { mock: true }

      const mockFetcherStore = {
        primaryFetch: {
          fetchingToken: 'abc',
        },
        fetches: {
          abc: mockFetchStatus,
        },
      }

      const { resources } = createResources(mockFetcherStore)

      vi.spyOn(resources, 'getLayoutIriByFetchStatus').mockReturnValue(mockLayoutIri)
      vi.spyOn(resources, 'getPageIriByFetchStatus').mockReturnValue(undefined)
      vi.spyOn(resources, 'getFetchStatusType').mockReturnValue(utils.CwaResourceTypes.COMPONENT)
      vi.spyOn(resources, 'getResource')
        .mockReturnValueOnce({ value: { apiState: { status: CwaResourceApiStatuses.SUCCESS } } })

      expect(resources.pageLoadProgress.value).toEqual({
        resources: [mockLayoutIri, undefined],
        total: 2,
        complete: 1,
        percent: 50,
      })
    })
  })

  describe('getFetchStatusType', () => {
    const { resources } = createResources()

    test('should return nothing IF no status is passed', () => {
      expect(resources.getFetchStatusType()).toBeUndefined()
    })

    test('should return nothing IF no type is found by status path', () => {
      const mockPath = '/test'

      vi.spyOn(utils, 'getResourceTypeFromIri').mockReturnValue(null)

      expect(resources.getFetchStatusType({ path: mockPath })).toBeUndefined()
      expect(utils.getResourceTypeFromIri).toHaveBeenCalledWith(mockPath)
    })

    test('should return type IF type is found by status path', () => {
      const mockPath = '/test'
      const mockType = 'mock type'

      vi.spyOn(utils, 'getResourceTypeFromIri').mockReturnValue(mockType)

      expect(resources.getFetchStatusType({ path: mockPath })).toEqual(mockType)
      expect(utils.getResourceTypeFromIri).toHaveBeenCalledWith(mockPath)
    })
  })

  describe('getLayoutIriByFetchStatus', () => {
    const { resources } = createResources()

    test('should return nothing IF page iri is not found', () => {
      const mockStatus = { path: '/test' }

      vi.spyOn(resources, 'getPageIriByFetchStatus').mockReturnValue(null)

      expect(resources.getLayoutIriByFetchStatus(mockStatus)).toBeUndefined()
      expect(resources.getPageIriByFetchStatus).toHaveBeenCalledWith(mockStatus)
    })

    test('should return nothing IF page resource is not found', () => {
      const mockStatus = { path: '/test' }
      const mockIri = 'mock iri'

      vi.spyOn(resources, 'getPageIriByFetchStatus').mockReturnValue(mockIri)
      vi.spyOn(resources, 'getResource').mockReturnValue({ value: null })

      expect(resources.getLayoutIriByFetchStatus(mockStatus)).toBeUndefined()
      expect(resources.getPageIriByFetchStatus).toHaveBeenCalledWith(mockStatus)
      expect(resources.getResource).toHaveBeenCalledWith(mockIri)
    })

    test('should return nothing IF page resource has no data', () => {
      const mockStatus = { path: '/test' }
      const mockIri = 'mock iri'

      vi.spyOn(resources, 'getPageIriByFetchStatus').mockReturnValue(mockIri)
      vi.spyOn(resources, 'getResource').mockReturnValue({ value: {} })

      expect(resources.getLayoutIriByFetchStatus(mockStatus)).toBeUndefined()
      expect(resources.getPageIriByFetchStatus).toHaveBeenCalledWith(mockStatus)
      expect(resources.getResource).toHaveBeenCalledWith(mockIri)
    })

    test('should return layout', () => {
      const mockStatus = { path: '/test' }
      const mockIri = 'mock iri'
      const mockLayout = 'mock layout'

      vi.spyOn(resources, 'getPageIriByFetchStatus').mockReturnValue(mockIri)
      vi.spyOn(resources, 'getResource').mockReturnValue({ value: { data: { layout: mockLayout } } })

      expect(resources.getLayoutIriByFetchStatus(mockStatus)).toEqual(mockLayout)
      expect(resources.getPageIriByFetchStatus).toHaveBeenCalledWith(mockStatus)
      expect(resources.getResource).toHaveBeenCalledWith(mockIri)
    })
  })

  describe('getPageIriByFetchStatus', () => {
    const { resources } = createResources()

    test('should return nothing IF status is not passed', () => {
      expect(resources.getPageIriByFetchStatus()).toBeUndefined()
    })

    test('should return nothing IF type is not found', () => {
      const mockStatus = { path: '/test' }

      vi.spyOn(resources, 'getFetchStatusType').mockReturnValue(null)

      expect(resources.getPageIriByFetchStatus(mockStatus)).toBeUndefined()
      expect(resources.getFetchStatusType).toHaveBeenCalledWith(mockStatus)
    })

    test('should return status path IF type is page', () => {
      const mockStatus = { path: '/test' }

      vi.spyOn(resources, 'getFetchStatusType').mockReturnValue(utils.CwaResourceTypes.PAGE)

      expect(resources.getPageIriByFetchStatus(mockStatus)).toEqual(mockStatus.path)
      expect(resources.getFetchStatusType).toHaveBeenCalledWith(mockStatus)
    })

    test('should return iri BASED on resource data IF type is page data', () => {
      const mockStatus = { path: '/test' }
      const mockPage = 'mock page'

      vi.spyOn(resources, 'getFetchStatusType').mockReturnValue(utils.CwaResourceTypes.PAGE_DATA)
      vi.spyOn(resources, 'getResource').mockReturnValue({ value: { data: { page: mockPage } } })

      expect(resources.getPageIriByFetchStatus(mockStatus)).toEqual(mockPage)
      expect(resources.getFetchStatusType).toHaveBeenCalledWith(mockStatus)
      expect(resources.getResource).toHaveBeenCalledWith(mockStatus.path)
    })

    test('should return iri BASED on resource page data IF type is route', () => {
      const mockStatus = { path: '/test' }
      const mockPageData = 'mock page data'
      const mockPage = 'mock page'

      vi.spyOn(resources, 'getFetchStatusType').mockReturnValue(utils.CwaResourceTypes.ROUTE)
      vi.spyOn(resources, 'getResource')
        .mockReturnValueOnce({ value: { data: { pageData: mockPageData } } })
        .mockReturnValueOnce({ value: { data: { page: mockPage } } })

      expect(resources.getPageIriByFetchStatus(mockStatus)).toEqual(mockPage)
      expect(resources.getFetchStatusType).toHaveBeenCalledWith(mockStatus)
      expect(resources.getResource).toHaveBeenCalledWith(mockStatus.path)
      expect(resources.getResource).toHaveBeenCalledWith(mockPageData)
    })

    test('should return iri BASED on resource data IF type is route AND page data is not defined', () => {
      const mockStatus = { path: '/test' }
      const mockPage = 'mock page'

      vi.spyOn(resources, 'getFetchStatusType').mockReturnValue(utils.CwaResourceTypes.ROUTE)
      vi.spyOn(resources, 'getResource')
        .mockReturnValue({ value: { data: { page: mockPage } } })

      expect(resources.getPageIriByFetchStatus(mockStatus)).toEqual(mockPage)
      expect(resources.getFetchStatusType).toHaveBeenCalledWith(mockStatus)
      expect(resources.getResource).toHaveBeenCalledWith(mockStatus.path)
    })
  })

  describe('pageIri getter', () => {
    test('makes correct calls and returns correct value', () => {
      const { resources } = createResources()
      vi.spyOn(resources, 'getPageIriByFetchStatus').mockImplementationOnce(() => 'mocked getPageIriByFetchStatus')
      vi.spyOn(resources, 'displayFetchStatus', 'get').mockImplementationOnce(() => 'status')
      expect(resources.pageIri.value).toEqual('mocked getPageIriByFetchStatus')
      expect(resources.getPageIriByFetchStatus).toHaveBeenCalledWith('status')
    })
  })

  describe('page getter', () => {
    test('Returns undefined if no pageIri value', () => {
      const { resources } = createResources()
      vi.spyOn(resources, 'pageIri', 'get').mockImplementationOnce(() => computed(() => undefined))
      expect(resources.page).toBeUndefined()
    })

    test('Returns getResource result passing pageIri as a parameter', () => {
      const { resources } = createResources()
      vi.spyOn(resources, 'getResource').mockImplementationOnce(() => computed(() => 'resource'))
      vi.spyOn(resources, 'pageIri', 'get').mockImplementation(() => computed(() => 'pageIri'))
      expect(resources.page.value).toEqual('resource')
      expect(resources.getResource).toHaveBeenCalledWith('pageIri')
      vi.clearAllMocks()
    })
  })

  describe('layoutIri getter', () => {
    test('should return layout iri BASED on fetch status', () => {
      const { resources } = createResources()
      const mockLayout = { layout: 'mock' }

      const spy = vi.spyOn(resources, 'getLayoutIriByFetchStatus').mockReturnValue(mockLayout)

      expect(resources.layoutIri.value).toEqual(mockLayout)
      expect(spy.mock.calls[0][0].value).toEqual(resources.displayFetchStatus.value)
    })
  })

  describe('layout getter', () => {
    test('should return nothing IF layout iri is not defined', () => {
      const { resources } = createResources()

      vi.spyOn(resources, 'getLayoutIriByFetchStatus').mockReturnValue(null)

      expect(resources.layout.value).toBeUndefined()
    })

    test('should return layout', () => {
      const { resources } = createResources()
      const mockLayoutIri = { mockIri: true }
      const mockLayout = { layout: 'mock' }

      vi.spyOn(resources, 'getLayoutIriByFetchStatus').mockReturnValue(mockLayoutIri)
      const spy = vi.spyOn(resources, 'getResource')
        .mockReturnValue(computed(() => mockLayout))

      expect(resources.layout.value).toEqual(mockLayout)
      expect(spy).toHaveBeenCalledWith(mockLayoutIri)
    })
  })

  describe('isLoading getter', () => {
    test('should return true IF some fetches are not resolved', () => {
      const mockFetcherStore = {
        fetchesResolved: false,
      }

      const { resources } = createResources(mockFetcherStore)

      expect(resources.isLoading.value).toEqual(true)
    })

    test('should return true IF some resources are pending', () => {
      const mockFetcherStore = {
        fetchesResolved: true,
      }

      const mockResourcesStore = {
        resourceLoadStatus: {
          pending: 1,
        },
      }

      const { resources } = createResources(mockFetcherStore, mockResourcesStore)

      expect(resources.isLoading.value).toEqual(true)
    })

    test('should return false IF both resources are not pending AND all fetches are resolved', () => {
      const mockFetcherStore = {
        fetchesResolved: true,
      }

      const mockResourcesStore = {
        resourceLoadStatus: {
          pending: 0,
        },
      }

      const { resources } = createResources(mockFetcherStore, mockResourcesStore)

      expect(resources.isLoading.value).toEqual(false)
    })
  })

  describe('resourceLoadStatus getter', () => {
    test('should return load status from store', () => {
      const mockStatus = 'mock status'
      const resourcesMock = {
        resourceLoadStatus: mockStatus,
      }
      const { resources } = createResources(undefined, resourcesMock)

      expect(resources.resourceLoadStatus).toEqual(mockStatus)
    })
  })

  describe('fetcherStore getter', () => {
    test('should return fetcher store', () => {
      const mockStore = { mock: { fetcher: 'store' } }
      const { resources } = createResources(mockStore)

      expect(resources.fetcherStore).toEqual(mockStore)
    })
  })

  describe('resourcesStore getter', () => {
    test('should return resources store', () => {
      const mockStore = { mock: { resources: 'store' } }
      const { resources } = createResources(undefined, mockStore)

      expect(resources.resourcesStore).toEqual(mockStore)
    })
  })

  describe('delegation methods', () => {
    test('isIriPublishableEquivalent delegates to resourcesStore', () => {
      const mockStore = { isIriPublishableEquivalent: vi.fn(() => true) }
      const { resources } = createResources(undefined, mockStore)
      const result = resources.isIriPublishableEquivalent('/a', '/b')
      expect(mockStore.isIriPublishableEquivalent).toHaveBeenCalledWith('/a', '/b')
      expect(result).toBe(true)
    })

    test('findAllPublishableIris delegates to resourcesStore', () => {
      const mockStore = { findAllPublishableIris: vi.fn(() => ['/a', '/b']) }
      const { resources } = createResources(undefined, mockStore)
      const result = resources.findAllPublishableIris('/a')
      expect(mockStore.findAllPublishableIris).toHaveBeenCalledWith('/a')
      expect(result).toEqual(['/a', '/b'])
    })

    test('getChildIris delegates to resourcesStore', () => {
      const mockStore = { getChildIris: vi.fn(() => ['/child']) }
      const { resources } = createResources(undefined, mockStore)
      const result = resources.getChildIris('/parent', undefined)
      expect(mockStore.getChildIris).toHaveBeenCalledWith('/parent', undefined)
      expect(result).toEqual(['/child'])
    })

    test('newResource returns computed from resourcesStore.getResource(NEW_RESOURCE_IRI)', () => {
      const mockNewResource = { data: { '@id': '__new__', '@type': 'Component', '_metadata': { persisted: false } } }
      const mockStore = { getResource: vi.fn(() => mockNewResource) }
      const { resources } = createResources(undefined, mockStore)
      expect(resources.newResource.value).toBe(mockNewResource)
    })

    test('findPublishedComponentIri delegates to resourcesStore', () => {
      const mockStore = { findPublishedComponentIri: vi.fn(() => '/component/published') }
      const { resources } = createResources(undefined, mockStore)
      const result = resources.findPublishedComponentIri('/component/draft')
      expect(result.value).toBe('/component/published')
    })

    test('findDraftComponentIri delegates to resourcesStore', () => {
      const mockStore = { findDraftComponentIri: vi.fn(() => '/component/draft') }
      const { resources } = createResources(undefined, mockStore)
      const result = resources.findDraftComponentIri('/component/published')
      expect(result.value).toBe('/component/draft')
    })

    test('getOrderedPositionsForGroup delegates to resourcesStore', () => {
      const mockFn = vi.fn()
      const mockStore = { getOrderedPositionsForGroup: mockFn }
      const { resources } = createResources(undefined, mockStore)
      expect(resources.getOrderedPositionsForGroup).toBe(mockFn)
    })

    test('getPositionSortDisplayNumber delegates to resourcesStore', () => {
      const mockFn = vi.fn()
      const mockStore = { getPositionSortDisplayNumber: mockFn }
      const { resources } = createResources(undefined, mockStore)
      expect(resources.getPositionSortDisplayNumber).toBe(mockFn)
    })

    test('hasNewResources delegates to resourcesStore', () => {
      const mockStore = { hasNewResources: true }
      const { resources } = createResources(undefined, mockStore)
      expect(resources.hasNewResources).toBe(true)
    })
  })

  describe('isPageDataResource', () => {
    function createResourcesWithPageData(pageDataValues: Record<string, any> | null, publishableIris: string[]) {
      const mockStore = {
        findAllPublishableIris: vi.fn(() => publishableIris),
        getResource: vi.fn(() => undefined),
      }
      const { resources } = createResources(undefined, mockStore)
      // Override pageData getter on instance to control what it returns
      const pageDataResult = pageDataValues !== null
        ? computed(() => ({ apiState: { status: 1 as any, headers: {}, fetchedAt: 0 }, data: pageDataValues }))
        : undefined
      Object.defineProperty(resources, 'pageData', {
        get: () => pageDataResult,
        configurable: true,
      })
      return resources
    }

    test('returns false when no pageData', () => {
      const resources = createResourcesWithPageData(null, [])
      expect(resources.isPageDataResource('/component/1').value).toBe(false)
    })

    test('returns false when iri is not a COMPONENT type', () => {
      const resources = createResourcesWithPageData({ someIri: '/component/1' }, [])
      expect(resources.isPageDataResource('/page_data/1').value).toBe(false)
    })

    test('iterates publishable iris looking for pageData match', () => {
      const componentIri = '/component/comp-1'
      const otherIri = '/component/other'
      const resources = createResourcesWithPageData({ someField: otherIri }, [componentIri])
      // With otherIri in pageData but we search for componentIri — no match
      expect(resources.isPageDataResource(componentIri).value).toBe(false)
    })

    test('returns false when component IRI is not in pageData values', () => {
      const componentIri = '/component/comp-1'
      const resources = createResourcesWithPageData({ someField: '/component/other' }, [componentIri])
      expect(resources.isPageDataResource(componentIri).value).toBe(false)
    })
  })

  describe('pageDataIri getter', () => {
    test('returns undefined when displayFetchStatus has no type', () => {
      const { resources } = createResources()
      vi.spyOn(resources, 'displayFetchStatus', 'get').mockReturnValue(undefined)
      expect(resources.pageDataIri.value).toBeUndefined()
    })

    test('returns undefined when displayFetchStatus has no path', () => {
      const { resources } = createResources()
      vi.spyOn(resources, 'getFetchStatusType').mockReturnValue(utils.CwaResourceTypes.PAGE)
      vi.spyOn(resources, 'displayFetchStatus', 'get').mockReturnValue({ path: '' } as any)
      expect(resources.pageDataIri.value).toBeUndefined()
    })

    test('returns path when type is PAGE_DATA', () => {
      const { resources } = createResources()
      vi.spyOn(resources, 'getFetchStatusType').mockReturnValue(utils.CwaResourceTypes.PAGE_DATA)
      vi.spyOn(resources, 'displayFetchStatus', 'get').mockReturnValue({ path: '/page_data/1' } as any)
      expect(resources.pageDataIri.value).toBe('/page_data/1')
    })

    test('returns resource pageData when type is ROUTE', () => {
      const { resources } = createResources()
      vi.spyOn(resources, 'getFetchStatusType').mockReturnValue(utils.CwaResourceTypes.ROUTE)
      vi.spyOn(resources, 'displayFetchStatus', 'get').mockReturnValue({ path: '/_/routes/test' } as any)
      vi.spyOn(resources, 'getResource').mockReturnValue(computed(() => ({ data: { pageData: '/page_data/1' } })) as any)
      expect(resources.pageDataIri.value).toBe('/page_data/1')
    })

    test('returns undefined when type is PAGE (not PAGE_DATA or ROUTE)', () => {
      const { resources } = createResources()
      vi.spyOn(resources, 'getFetchStatusType').mockReturnValue(utils.CwaResourceTypes.PAGE)
      vi.spyOn(resources, 'displayFetchStatus', 'get').mockReturnValue({ path: '/_/pages/1' } as any)
      vi.spyOn(resources, 'getResource').mockReturnValue(computed(() => ({ data: {} })) as any)
      expect(resources.pageDataIri.value).toBeUndefined()
    })
  })

  describe('displayPageIri getter', () => {
    test('returns pageDataIri when isDataPage is true', () => {
      const { resources } = createResources()
      vi.spyOn(resources, 'isDataPage', 'get').mockReturnValue(computed(() => true))
      vi.spyOn(resources, 'pageDataIri', 'get').mockReturnValue(computed(() => '/page_data/1'))
      expect(resources.displayPageIri.value).toBe('/page_data/1')
    })

    test('returns pageIri when isDataPage is false', () => {
      const { resources } = createResources()
      vi.spyOn(resources, 'isDataPage', 'get').mockReturnValue(computed(() => false))
      vi.spyOn(resources, 'pageIri', 'get').mockReturnValue(computed(() => '/_/pages/1'))
      expect(resources.displayPageIri.value).toBe('/_/pages/1')
    })
  })

  describe('displayPage getter', () => {
    test('returns undefined when displayPageIri is not set', () => {
      const { resources } = createResources()
      vi.spyOn(resources, 'displayPageIri', 'get').mockReturnValue(computed(() => undefined))
      expect(resources.displayPage).toBeUndefined()
    })

    test('returns getResource result when displayPageIri is set', () => {
      const { resources } = createResources()
      vi.spyOn(resources, 'displayPageIri', 'get').mockReturnValue(computed(() => '/page_data/1'))
      vi.spyOn(resources, 'getResource').mockReturnValue(computed(() => ({ data: { '@id': '/page_data/1' } })) as any)
      expect(resources.displayPage?.value?.data?.['@id']).toBe('/page_data/1')
    })
  })

  describe('usesPageTemplate, isDataPage, isDynamicPage', () => {
    test('usesPageTemplate returns false when page has no data', () => {
      const { resources } = createResources()
      vi.spyOn(resources, 'page', 'get').mockReturnValue(undefined)
      expect(resources.usesPageTemplate.value).toBe(false)
    })

    test('usesPageTemplate returns true when page.isTemplate is true', () => {
      const { resources } = createResources()
      vi.spyOn(resources, 'page', 'get').mockReturnValue(computed(() => ({ data: { isTemplate: true } })) as any)
      expect(resources.usesPageTemplate.value).toBe(true)
    })

    test('isDataPage returns true when usesPageTemplate and pageDataIri is set', () => {
      const { resources } = createResources()
      vi.spyOn(resources, 'usesPageTemplate', 'get').mockReturnValue(computed(() => true))
      vi.spyOn(resources, 'pageDataIri', 'get').mockReturnValue(computed(() => '/page_data/1'))
      expect(resources.isDataPage.value).toBe(true)
    })

    test('isDataPage returns false when usesPageTemplate is false', () => {
      const { resources } = createResources()
      vi.spyOn(resources, 'usesPageTemplate', 'get').mockReturnValue(computed(() => false))
      vi.spyOn(resources, 'pageDataIri', 'get').mockReturnValue(computed(() => '/page_data/1'))
      expect(resources.isDataPage.value).toBe(false)
    })

    test('isDynamicPage returns true when usesPageTemplate and no pageDataIri', () => {
      const { resources } = createResources()
      vi.spyOn(resources, 'usesPageTemplate', 'get').mockReturnValue(computed(() => true))
      vi.spyOn(resources, 'pageDataIri', 'get').mockReturnValue(computed(() => undefined))
      expect(resources.isDynamicPage.value).toBe(true)
    })

    test('isDynamicPage returns false when pageDataIri is set', () => {
      const { resources } = createResources()
      vi.spyOn(resources, 'usesPageTemplate', 'get').mockReturnValue(computed(() => true))
      vi.spyOn(resources, 'pageDataIri', 'get').mockReturnValue(computed(() => '/page_data/1'))
      expect(resources.isDynamicPage.value).toBe(false)
    })
  })

  describe('getRefreshEndpointsForDelete', () => {
    test('returns empty array when no pageDataIri or positionsByComponent', () => {
      const mockStore = {
        findAllPublishableIris: vi.fn(() => ['/component/1']),
        current: { positionsByComponent: {} },
      }
      const { resources } = createResources(undefined, mockStore)
      vi.spyOn(resources, 'pageDataIri', 'get').mockReturnValue(computed(() => undefined))
      expect(resources.getRefreshEndpointsForDelete('/component/1')).toEqual([])
    })

    test('includes pageDataIri when present', () => {
      const mockStore = {
        findAllPublishableIris: vi.fn(() => ['/component/1']),
        current: { positionsByComponent: {} },
      }
      const { resources } = createResources(undefined, mockStore)
      vi.spyOn(resources, 'pageDataIri', 'get').mockReturnValue(computed(() => '/page_data/1'))
      const result = resources.getRefreshEndpointsForDelete('/component/1')
      expect(result).toContain('/page_data/1')
    })

    test('includes component positions and their groups', () => {
      const positionIri = '/_/component_positions/pos-1'
      const groupIri = '/_/component_groups/group-1'
      const mockStore = {
        findAllPublishableIris: vi.fn(() => ['/component/1']),
        current: { positionsByComponent: { '/component/1': [positionIri] } },
        getResource: vi.fn((iri: string) => {
          if (iri === positionIri) {
            return { data: { componentGroup: groupIri } }
          }
          return undefined
        }),
      }
      const { resources } = createResources(undefined, mockStore)
      vi.spyOn(resources, 'pageDataIri', 'get').mockReturnValue(computed(() => undefined))
      vi.spyOn(resources, 'getResource').mockImplementation((iri: string) => {
        if (iri === positionIri) {
          return computed(() => ({ data: { componentGroup: groupIri } })) as any
        }
        return computed(() => undefined) as any
      })
      const result = resources.getRefreshEndpointsForDelete('/component/1')
      expect(result).toContain(positionIri)
      expect(result).toContain(groupIri)
    })
  })

  describe('getPageIriByFetchStatus real implementation', () => {
    test('returns path when type is PAGE and no resource in store', () => {
      const mockStore = { getResource: vi.fn(() => undefined), current: { currentIds: [] } }
      const { resources } = createResources(undefined, mockStore)
      vi.spyOn(resources, 'getFetchStatusType').mockReturnValue(utils.CwaResourceTypes.PAGE)
      expect(resources.getPageIriByFetchStatus({ path: '/_/pages/1' } as any)).toBe('/_/pages/1')
    })

    test('returns responseIri when type is PAGE and resource has responseIri in apiState', () => {
      const mockStore = {
        getResource: vi.fn(() => ({
          apiState: { status: 1, headers: {}, fetchedAt: 0, iri: '/_/pages/1', responseIri: '/_/pages/2' },
        })),
      }
      const { resources } = createResources(undefined, mockStore)
      vi.spyOn(resources, 'getFetchStatusType').mockReturnValue(utils.CwaResourceTypes.PAGE)
      expect(resources.getPageIriByFetchStatus({ path: '/_/pages/1' } as any)).toBe('/_/pages/2')
    })
  })
})
