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
          fetchingToken: 'mock'
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
      const mockFetcherStore  = {
        fetchesResolved: true,
      }

      const mockResourcesStore= {
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
})
