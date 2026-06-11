import { describe, vi, test, expect } from 'vitest'
import { ResourcesManager } from './resources-manager'
import type { CwaResource } from '#cwa/resources/resource-utils'

vi.mock('#cwa/templates/components/core/ConfirmDialog.vue', () => ({ default: {} }))
vi.mock('vuejs-confirm-dialog', () => ({
  createConfirmDialog: vi.fn(() => ({
    reveal: vi.fn().mockResolvedValue({ isCanceled: false }),
  })),
}))

function createResourcesManager(opts: { includeAdmin?: boolean } = {}) {
  const mockCwaFetch = {
    fetch: vi.fn(),
  }
  const resourcesStoreActions = {
    saveResource: vi.fn(),
    deleteResource: vi.fn(),
    getResource: vi.fn(),
    mergeNewResources: vi.fn(),
    resetNewResource: vi.fn(),
  }
  const mockResourcesStore = {
    useStore() {
      return resourcesStoreActions
    },
  }
  const errorStoreActions = {
    removeByEndpoint: vi.fn(),
    manual: vi.fn(),
    get getErrors() { return [{ id: 1, message: 'err' }] },
    get hasErrors() { return true },
    removeById: vi.fn(),
    error: vi.fn(),
  }
  const mockErrorsStore = {
    useStore() {
      return errorStoreActions
    },
  }
  const mockFetchPath = {
    value: '',
  }
  const mockFetchManager = {
    get primaryFetchPath() {
      return mockFetchPath.value
    },
  }

  const mockAdmin = opts.includeAdmin
    ? {
        emitRedraw: vi.fn(),
        emptyStack: vi.fn(),
        eventBus: { emit: vi.fn() },
        resourceStackManager: { forcePublishedVersion: { value: undefined } },
      }
    : undefined

  const resourcesManager = new ResourcesManager(
    // @ts-expect-error
    mockCwaFetch,
    mockResourcesStore,
    mockFetchManager,
    mockErrorsStore,
    undefined,
    mockAdmin,
    undefined,
  )

  return {
    resourcesManager,
    cwaFetch: mockCwaFetch,
    fetchPath: mockFetchPath,
    resourceStore: mockResourcesStore,
    resourcesStoreActions,
    errorStoreActions,
    mockAdmin,
  }
}

describe('Resources manager', () => {
  describe('create resource', () => {
    test('should send request AND then save result of that request', async () => {
      const { resourcesManager, cwaFetch } = createResourcesManager()
      const mockResource = { id: 'new-resource' }
      const mockPayload = {
        endpoint: '/api/mock/endpoint',
        data: {
          test: true,
        },
      }
      const saveSpy = vi.spyOn(resourcesManager, 'saveResource').mockImplementation(() => {})
      cwaFetch.fetch.mockResolvedValue(mockResource)

      await resourcesManager.createResource(mockPayload)

      expect(cwaFetch.fetch).toHaveBeenCalledWith(mockPayload.endpoint, {
        method: 'POST',
        headers: {
          'accept': 'application/ld+json,application/json',
          'content-type': 'application/ld+json',
        },
        body: mockPayload.data,
      })
      expect(saveSpy).toHaveBeenCalledWith({
        resource: mockResource,
      })
    })

    test('should send request with path header IF primary fetch path is defined AND then save result of that request', async () => {
      const { resourcesManager, cwaFetch, fetchPath } = createResourcesManager()
      const mockResource = { id: 'new-resource' }
      const mockPayload = {
        endpoint: '/api/mock/endpoint',
        data: {
          test: true,
        },
      }
      fetchPath.value = 'primary-path'
      const saveSpy = vi.spyOn(resourcesManager, 'saveResource').mockImplementation(() => {})
      cwaFetch.fetch.mockResolvedValue(mockResource)

      await resourcesManager.createResource(mockPayload)

      expect(cwaFetch.fetch).toHaveBeenCalledWith(mockPayload.endpoint, {
        method: 'POST',
        headers: {
          'path': 'primary-path',
          'accept': 'application/ld+json,application/json',
          'content-type': 'application/ld+json',
        },
        body: mockPayload.data,
      })
      expect(saveSpy).toHaveBeenCalledWith({
        resource: mockResource,
      })
    })
  })

  describe('updateResource', () => {
    test('should send request AND then save result of that request', async () => {
      const { resourcesManager, cwaFetch } = createResourcesManager()
      const mockResource = { id: 'new-resource' }
      const mockPayload = {
        endpoint: '/api/mock/endpoint',
        data: {
          test: true,
        },
      }
      const saveSpy = vi.spyOn(resourcesManager, 'saveResource').mockImplementation(() => {})
      cwaFetch.fetch.mockResolvedValue(mockResource)

      await resourcesManager.updateResource(mockPayload)

      expect(cwaFetch.fetch).toHaveBeenCalledWith(mockPayload.endpoint, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/merge-patch+json',
          'accept': 'application/ld+json,application/json',
        },
        body: mockPayload.data,
      })
      expect(saveSpy).toHaveBeenCalledWith({
        resource: mockResource,
      })
    })
  })

  describe('saveResource', () => {
    test('should save resource', () => {
      const { resourcesManager, resourceStore } = createResourcesManager()
      const mockCwaResource: CwaResource = {
        '@id': 'mock-id',
        '@type': 'Component',
        '_metadata': {
          persisted: true,
        },
      }
      const mockPayload = { resource: mockCwaResource }
      const mockResult = { test: true }

      resourceStore.useStore().saveResource.mockReturnValue(mockResult)

      const result = resourcesManager.saveResource(mockPayload)

      expect(resourceStore.useStore().saveResource).toHaveBeenCalledWith(mockPayload)
      expect(result).toEqual(mockResult)
    })
  })

  describe('removeResource', () => {
    test('should remove a resource', () => {
      const { resourcesManager, resourcesStoreActions } = createResourcesManager()
      const mockDeleteEvent = { resource: 'test' }

      resourcesManager.removeResource(mockDeleteEvent)

      expect(resourcesStoreActions.deleteResource).toHaveBeenCalledWith(mockDeleteEvent)
    })
  })

  describe('requestOptions', () => {
    test('should return options for POST request', () => {
      const { resourcesManager } = createResourcesManager()

      expect(resourcesManager.requestOptions('POST')).toEqual({
        method: 'POST',
        headers: {
          'accept': 'application/ld+json,application/json',
          'content-type': 'application/ld+json',
        },
      })
    })

    test('should return options for PATCH request', () => {
      const { resourcesManager } = createResourcesManager()

      expect(resourcesManager.requestOptions('PATCH')).toEqual({
        method: 'PATCH',
        headers: {
          'content-type': 'application/merge-patch+json',
          'accept': 'application/ld+json,application/json',
        },
      })
    })

    test('should options with path header IF primary fetch path is defined', () => {
      const { resourcesManager, fetchPath } = createResourcesManager()

      fetchPath.value = '/test'

      expect(resourcesManager.requestOptions('PATCH')).toEqual({
        method: 'PATCH',
        headers: {
          'content-type': 'application/merge-patch+json',
          'accept': 'application/ld+json,application/json',
          'path': '/test',
        },
      })
    })
  })

  describe('resourcesStore getter', () => {
    test('should return resourcesStore', () => {
      const { resourcesManager, resourceStore } = createResourcesManager()

      expect(resourcesManager.resourcesStore).toEqual(resourceStore.useStore())
    })
  })

  describe('error store delegation', () => {
    test('addError delegates to errorStore.manual', () => {
      const { resourcesManager, errorStoreActions } = createResourcesManager()
      const errorEvent = { type: 'manual', message: 'test error' } as any
      resourcesManager.addError(errorEvent)
      expect(errorStoreActions.manual).toHaveBeenCalledWith(errorEvent)
    })

    test('errors getter returns errorStore.getErrors', () => {
      const { resourcesManager } = createResourcesManager()
      expect(resourcesManager.errors).toEqual([{ id: 1, message: 'err' }])
    })

    test('hasErrors getter returns errorStore.hasErrors', () => {
      const { resourcesManager } = createResourcesManager()
      expect(resourcesManager.hasErrors).toBe(true)
    })

    test('removeError delegates to errorStore.removeById', () => {
      const { resourcesManager, errorStoreActions } = createResourcesManager()
      resourcesManager.removeError(42)
      expect(errorStoreActions.removeById).toHaveBeenCalledWith(42)
    })
  })

  describe('addResource event management', () => {
    test('addResourceEvent getter returns the ref', () => {
      const { resourcesManager } = createResourcesManager()
      expect(resourcesManager.addResourceEvent.value).toBeUndefined()
    })

    test('clearAddResourceEventResource resets new resource in store', () => {
      const { resourcesManager, resourcesStoreActions } = createResourcesManager()
      resourcesManager.clearAddResourceEventResource()
      expect(resourcesStoreActions.resetNewResource).toHaveBeenCalled()
    })

    test('clearAddResource clears event and resets store', () => {
      const { resourcesManager, resourcesStoreActions } = createResourcesManager()
      resourcesManager.clearAddResource()
      expect(resourcesManager.addResourceEvent.value).toBeUndefined()
      expect(resourcesStoreActions.resetNewResource).toHaveBeenCalled()
    })
  })

  describe('mergeNewResources', () => {
    test('calls resourcesStore.mergeNewResources and admin.emitRedraw', () => {
      const { resourcesManager, resourcesStoreActions, mockAdmin } = createResourcesManager({ includeAdmin: true })
      resourcesManager.mergeNewResources()
      expect(resourcesStoreActions.mergeNewResources).toHaveBeenCalled()
      expect(mockAdmin!.emitRedraw).toHaveBeenCalled()
    })
  })

  describe('requestCount getter', () => {
    test('returns 0 initially', () => {
      const { resourcesManager } = createResourcesManager()
      expect(resourcesManager.requestCount.value).toBe(0)
    })
  })

  describe('getEndpointForIri', () => {
    test('returns iri directly when resource not found in store', () => {
      const { resourcesManager, resourcesStoreActions } = createResourcesManager()
      resourcesStoreActions.getResource.mockReturnValue(undefined)
      expect(resourcesManager.getEndpointForIri('/components/1')).toBe('/components/1')
    })

    test('appends ?published=false for draft resource', () => {
      const { resourcesManager, resourcesStoreActions } = createResourcesManager()
      resourcesStoreActions.getResource.mockReturnValue({
        data: {
          '@id': '/components/1',
          '@type': 'Component',
          '_metadata': { persisted: true, publishable: { published: false } },
        },
      })
      expect(resourcesManager.getEndpointForIri('/components/1')).toBe('/components/1?published=false')
    })

    test('appends ?published=true for published resource', () => {
      const { resourcesManager, resourcesStoreActions } = createResourcesManager()
      resourcesStoreActions.getResource.mockReturnValue({
        data: {
          '@id': '/components/1',
          '@type': 'Component',
          '_metadata': { persisted: true, publishable: { published: true } },
        },
      })
      expect(resourcesManager.getEndpointForIri('/components/1')).toBe('/components/1?published=true')
    })
  })

  describe('confirmDiscardAddingResource', () => {
    test('returns true immediately when no addResourceEvent is set', async () => {
      const { resourcesManager } = createResourcesManager()
      const result = await resourcesManager.confirmDiscardAddingResource()
      expect(result).toBe(true)
    })
  })
})
