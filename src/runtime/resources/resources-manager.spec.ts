import { describe, vi, test, expect } from 'vitest'
import { ResourcesManager } from './resources-manager'
import { CwaResource } from '#cwa/runtime/resources/resource-utils'

function createResourcesManager () {
  const mockCwaFetch = {
    fetch: vi.fn()
  }
  const resourcesStoreActions = {
    saveResource: vi.fn(),
    deleteResource: vi.fn()
  }
  const mockResourcesStore = {
    useStore () {
      return resourcesStoreActions
    }
  }
  const errorStoreActions = {
    removeByEndpoint: vi.fn()
  }
  const mockErrorsStore = {
    useStore () {
      return errorStoreActions
    }
  }
  const mockFetchPath = {
    value: ''
  }
  const mockFetchManager = {
    get primaryFetchPath () {
      return mockFetchPath.value
    }
  }

  const resourcesManager = new ResourcesManager(
    // @ts-ignore
    mockCwaFetch,
    mockResourcesStore,
    mockFetchManager,
    mockErrorsStore
  )

  return {
    resourcesManager,
    cwaFetch: mockCwaFetch,
    fetchPath: mockFetchPath,
    resourceStore: mockResourcesStore,
    resourcesStoreActions,
    errorStoreActions
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
          test: true
        }
      }
      const saveSpy = vi.spyOn(resourcesManager, 'saveResource').mockImplementation(() => {})
      cwaFetch.fetch.mockResolvedValue(mockResource)

      await resourcesManager.createResource(mockPayload)

      expect(cwaFetch.fetch).toHaveBeenCalledWith(mockPayload.endpoint, {
        method: 'POST',
        headers: {
          accept: 'application/ld+json,application/json'
        },
        body: mockPayload.data
      })
      expect(saveSpy).toHaveBeenCalledWith({
        resource: mockResource
      })
    })

    test('should send request with path header IF primary fetch path is defined AND then save result of that request', async () => {
      const { resourcesManager, cwaFetch, fetchPath } = createResourcesManager()
      const mockResource = { id: 'new-resource' }
      const mockPayload = {
        endpoint: '/api/mock/endpoint',
        data: {
          test: true
        }
      }
      fetchPath.value = 'primary-path'
      const saveSpy = vi.spyOn(resourcesManager, 'saveResource').mockImplementation(() => {})
      cwaFetch.fetch.mockResolvedValue(mockResource)

      await resourcesManager.createResource(mockPayload)

      expect(cwaFetch.fetch).toHaveBeenCalledWith(mockPayload.endpoint, {
        method: 'POST',
        headers: {
          path: 'primary-path',
          accept: 'application/ld+json,application/json'
        },
        body: mockPayload.data
      })
      expect(saveSpy).toHaveBeenCalledWith({
        resource: mockResource
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
          test: true
        }
      }
      const saveSpy = vi.spyOn(resourcesManager, 'saveResource').mockImplementation(() => {})
      cwaFetch.fetch.mockResolvedValue(mockResource)

      await resourcesManager.updateResource(mockPayload)

      expect(cwaFetch.fetch).toHaveBeenCalledWith(mockPayload.endpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/merge-patch+json',
          accept: 'application/ld+json,application/json'
        },
        body: mockPayload.data
      })
      expect(saveSpy).toHaveBeenCalledWith({
        resource: mockResource
      })
    })
  })

  describe('saveResource', () => {
    test('should save resource', () => {
      const { resourcesManager, resourceStore } = createResourcesManager()
      const mockCwaResource: CwaResource = {
        '@id': 'mock-id',
        '@type': 'Component',
        _metadata: {
          persisted: true
        }
      }
      const mockPayload = { resource: mockCwaResource }
      const mockResult = { test: true }

      resourceStore.useStore().saveResource.mockReturnValue(mockResult)

      const result = resourcesManager.saveResource(mockPayload)

      expect(resourceStore.useStore().saveResource).toHaveBeenCalledWith(mockPayload)
      expect(result).toEqual(mockResult)
    })
  })

  describe('deleteResource', () => {
    test('should delete resource', () => {
      const { resourcesManager, resourcesStoreActions } = createResourcesManager()
      const mockDeleteEvent = { resource: 'test' }

      resourcesManager.deleteResource(mockDeleteEvent)

      expect(resourcesStoreActions.deleteResource).toHaveBeenCalledWith(mockDeleteEvent)
    })
  })

  describe('requestOptions', () => {
    test('should return options for POST request', () => {
      const { resourcesManager } = createResourcesManager()

      expect(resourcesManager.requestOptions('POST')).toEqual({
        method: 'POST',
        headers: {
          accept: 'application/ld+json,application/json'
        }
      })
    })

    test('should return options for PATCH request', () => {
      const { resourcesManager } = createResourcesManager()

      expect(resourcesManager.requestOptions('PATCH')).toEqual({
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/merge-patch+json',
          accept: 'application/ld+json,application/json'
        }
      })
    })

    test('should options with path header IF primary fetch path is defined', () => {
      const { resourcesManager, fetchPath } = createResourcesManager()

      fetchPath.value = '/test'

      expect(resourcesManager.requestOptions('PATCH')).toEqual({
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/merge-patch+json',
          accept: 'application/ld+json,application/json',
          path: '/test'
        }
      })
    })
  })

  describe('resourcesStore getter', () => {
    test('should return resourcesStore', () => {
      const { resourcesManager, resourceStore } = createResourcesManager()

      expect(resourcesManager.resourcesStore).toEqual(resourceStore.useStore())
    })
  })
})
