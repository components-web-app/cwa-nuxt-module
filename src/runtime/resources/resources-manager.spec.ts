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
    mockFetchManager
  )

  return {
    resourcesManager,
    cwaFetch: mockCwaFetch,
    fetchPath: mockFetchPath,
    resourceStore: mockResourcesStore
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

  describe('update resource', () => {
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

  describe('save resource', () => {
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
})
