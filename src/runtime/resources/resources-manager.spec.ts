import { describe, vi, test, expect, beforeEach } from 'vitest'
import { createConfirmDialog } from 'vuejs-confirm-dialog'
import { ResourcesManager } from './resources-manager'
import type { CwaResource } from '#cwa/resources/resource-utils'

vi.mock('#cwa/templates/components/core/ConfirmDialog.vue', () => ({ default: {} }))
vi.mock('vuejs-confirm-dialog', () => ({
  createConfirmDialog: vi.fn(() => ({
    reveal: vi.fn().mockResolvedValue({ isCanceled: false }),
  })),
}))

function createResourcesManager(opts: { includeAdmin?: boolean, fetcher?: any, resources?: any } = {}) {
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
    opts.fetcher ?? undefined,
    mockAdmin,
    opts.resources ?? undefined,
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
    beforeEach(() => {
      vi.clearAllMocks()
    })

    test('returns true immediately when no addResourceEvent is set', async () => {
      const { resourcesManager } = createResourcesManager()
      const result = await resourcesManager.confirmDiscardAddingResource()
      expect(result).toBe(true)
    })

    test('returns false and keeps event when dialog is cancelled', async () => {
      vi.mocked(createConfirmDialog).mockReturnValueOnce({
        reveal: vi.fn().mockResolvedValue({ isCanceled: true }),
      } as any)
      const { resourcesManager } = createResourcesManager()
      resourcesManager.addResourceEvent.value = { targetIri: '/x', addAfter: null, closest: {} } as any
      const result = await resourcesManager.confirmDiscardAddingResource()
      expect(result).toBe(false)
      expect(resourcesManager.addResourceEvent.value).toBeDefined()
    })

    test('clears event and returns true when confirmed', async () => {
      const { resourcesManager, resourcesStoreActions } = createResourcesManager()
      resourcesManager.addResourceEvent.value = { targetIri: '/x', addAfter: null, closest: {} } as any
      const result = await resourcesManager.confirmDiscardAddingResource()
      expect(result).toBe(true)
      expect(resourcesManager.addResourceEvent.value).toBeUndefined()
      expect(resourcesStoreActions.resetNewResource).toHaveBeenCalled()
    })
  })

  describe('deleteResource', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    test('returns false without fetching when confirm dialog is cancelled', async () => {
      vi.mocked(createConfirmDialog).mockReturnValueOnce({
        reveal: vi.fn().mockResolvedValue({ isCanceled: true }),
      } as any)
      const { resourcesManager, cwaFetch } = createResourcesManager()
      const result = await resourcesManager.deleteResource({ endpoint: '/components/1' })
      expect(result).toBe(false)
      expect(cwaFetch.fetch).not.toHaveBeenCalled()
    })

    test('sends DELETE and removes resource from store when confirmed', async () => {
      const { resourcesManager, cwaFetch, resourcesStoreActions } = createResourcesManager()
      resourcesStoreActions.getResource.mockReturnValue(undefined)
      cwaFetch.fetch.mockResolvedValue({})
      const removeSpy = vi.spyOn(resourcesManager, 'removeResource')
      await resourcesManager.deleteResource({ endpoint: '/components/1' })
      expect(cwaFetch.fetch).toHaveBeenCalledWith(
        '/components/1',
        expect.objectContaining({ method: 'DELETE' }),
      )
      expect(removeSpy).toHaveBeenCalledWith({ resource: '/components/1' })
    })
  })

  describe('updateResource (additional branches)', () => {
    test('uses POST method when event.data is FormData', async () => {
      const { resourcesManager, cwaFetch } = createResourcesManager()
      cwaFetch.fetch.mockResolvedValue({ '@id': '/things/1' })
      vi.spyOn(resourcesManager, 'saveResource').mockImplementation(() => {})
      await resourcesManager.updateResource({ endpoint: '/things/1', data: new FormData() })
      expect(cwaFetch.fetch).toHaveBeenCalledWith(
        '/things/1',
        expect.objectContaining({ method: 'POST' }),
      )
    })

    test('merges event headers into the request headers', async () => {
      const { resourcesManager, cwaFetch } = createResourcesManager()
      cwaFetch.fetch.mockResolvedValue({ '@id': '/things/1' })
      vi.spyOn(resourcesManager, 'saveResource').mockImplementation(() => {})
      await resourcesManager.updateResource({
        endpoint: '/things/1',
        data: {},
        headers: { 'x-custom': 'value' },
      })
      expect(cwaFetch.fetch).toHaveBeenCalledWith(
        '/things/1',
        expect.objectContaining({ headers: expect.objectContaining({ 'x-custom': 'value' }) }),
      )
    })

    test('saves locally without fetching when resource is not persisted', async () => {
      const { resourcesManager, cwaFetch, resourcesStoreActions } = createResourcesManager()
      resourcesStoreActions.getResource.mockReturnValue({
        data: {
          '@id': '/things/1',
          '@type': 'Thing',
          'name': 'old',
          '_metadata': { persisted: false },
        },
      })
      const saveSpy = vi.spyOn(resourcesManager, 'saveResource').mockImplementation(() => {})
      await resourcesManager.updateResource({ endpoint: '/things/1', data: { name: 'new' } })
      expect(cwaFetch.fetch).not.toHaveBeenCalled()
      expect(saveSpy).toHaveBeenCalled()
    })

    test('calls admin.emptyStack when publishing overwrites an existing live resource', async () => {
      const { resourcesManager, cwaFetch, resourcesStoreActions, mockAdmin } = createResourcesManager({ includeAdmin: true })
      resourcesStoreActions.getResource.mockImplementation((iri: string) => {
        if (iri === '/things/draft') {
          return {
            data: {
              '@id': '/things/draft',
              '@type': 'Thing',
              'publishedResource': '/things/live',
              'componentPositions': undefined,
              '_metadata': { persisted: true, publishable: { published: false } },
            },
          }
        }
        if (iri === '/things/live') {
          return { data: { '@id': '/things/live', 'componentPositions': [] } }
        }
      })
      cwaFetch.fetch.mockResolvedValue({ '@id': '/things/draft' })
      vi.spyOn(resourcesManager, 'saveResource').mockImplementation(() => {})
      const past = new Date(Date.now() - 1000).toISOString()
      await resourcesManager.updateResource({ endpoint: '/things/draft', data: { publishedAt: past } })
      expect(mockAdmin!.emptyStack).toHaveBeenCalled()
    })

    test('removes the draft after publishing when response IRI matches original', async () => {
      const { resourcesManager, cwaFetch, resourcesStoreActions } = createResourcesManager({ includeAdmin: true })
      resourcesStoreActions.getResource.mockImplementation((iri: string) => {
        if (iri === '/things/draft') {
          return {
            data: {
              '@id': '/things/draft',
              '@type': 'Thing',
              'publishedResource': '/things/live',
              'componentPositions': undefined,
              '_metadata': { persisted: true, publishable: { published: false } },
            },
          }
        }
        if (iri === '/things/live') {
          return { data: { '@id': '/things/live', 'componentPositions': [] } }
        }
      })
      cwaFetch.fetch.mockResolvedValue({ '@id': '/things/draft' })
      vi.spyOn(resourcesManager, 'saveResource').mockImplementation(() => {})
      const removeSpy = vi.spyOn(resourcesManager, 'removeResource')
      const past = new Date(Date.now() - 1000).toISOString()
      await resourcesManager.updateResource({ endpoint: '/things/draft', data: { publishedAt: past } })
      expect(removeSpy).toHaveBeenCalledWith({ resource: '/things/draft', noCascade: true })
    })

    test('sets forcePublishedVersion to false when response IRI differs (new draft created)', async () => {
      const { resourcesManager, cwaFetch, resourcesStoreActions, mockAdmin } = createResourcesManager({ includeAdmin: true })
      resourcesStoreActions.getResource.mockReturnValue({
        data: {
          '@id': '/things/1',
          '@type': 'Thing',
          '_metadata': { persisted: true, publishable: { published: true } },
        },
      })
      cwaFetch.fetch.mockResolvedValue({ '@id': '/things/1-draft' })
      vi.spyOn(resourcesManager, 'saveResource').mockImplementation(() => {})
      await resourcesManager.updateResource({ endpoint: '/things/1', data: { name: 'updated' } })
      expect(mockAdmin!.resourceStackManager.forcePublishedVersion.value).toBe(false)
    })
  })

  describe('initAddResource', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    function makeStack(iris: string[]) {
      return iris.map(iri => ({ iri })) as any[]
    }

    test('does nothing when confirmDiscardAddingResource returns false', async () => {
      vi.mocked(createConfirmDialog).mockReturnValueOnce({
        reveal: vi.fn().mockResolvedValue({ isCanceled: true }),
      } as any)
      const { resourcesManager } = createResourcesManager({ includeAdmin: true })
      resourcesManager.addResourceEvent.value = { targetIri: '/x', addAfter: null, closest: {} } as any
      await resourcesManager.initAddResource('/_/component_positions/1', null, [])
      expect(resourcesManager.addResourceEvent.value).toBeDefined()
    })

    test('sets addResourceEvent with closest position from stack when targetIri is a position', async () => {
      const { resourcesManager } = createResourcesManager({ includeAdmin: true })
      const stack = makeStack(['/_/component_groups/g1', '/_/component_positions/p1'])
      await resourcesManager.initAddResource('/_/component_positions/target', null, stack)
      expect(resourcesManager.addResourceEvent.value).toMatchObject({
        targetIri: '/_/component_positions/target',
        addAfter: null,
        closest: {
          position: '/_/component_positions/p1',
          group: '/_/component_groups/g1',
        },
      })
    })

    test('sets addResourceEvent with closest position from group positions when targetIri is a component group and addAfter is true', async () => {
      const { resourcesManager, resourcesStoreActions } = createResourcesManager({ includeAdmin: true })
      resourcesStoreActions.getResource = undefined as any
      // Inject current.byId directly on the store used by the class
      const store = (resourcesManager as any)._resourcesStore
      store.current = {
        byId: {
          '/_/component_groups/g1': {
            data: { componentPositions: ['/_/component_positions/p1', '/_/component_positions/p2'] },
          },
        },
      }
      await resourcesManager.initAddResource('/_/component_groups/g1', true, [])
      expect(resourcesManager.addResourceEvent.value?.closest.position).toBe('/_/component_positions/p2')
    })

    test('sets addResourceEvent with first group position when addAfter is false', async () => {
      const { resourcesManager } = createResourcesManager({ includeAdmin: true })
      const store = (resourcesManager as any)._resourcesStore
      store.current = {
        byId: {
          '/_/component_groups/g1': {
            data: { componentPositions: ['/_/component_positions/p1', '/_/component_positions/p2'] },
          },
        },
      }
      await resourcesManager.initAddResource('/_/component_groups/g1', false, [])
      expect(resourcesManager.addResourceEvent.value?.closest.position).toBe('/_/component_positions/p1')
    })

    test('sets pageDataProperty on addResourceEvent when provided', async () => {
      const { resourcesManager } = createResourcesManager({ includeAdmin: true })
      await resourcesManager.initAddResource('/_/component_positions/p1', null, [], 'heroImage')
      expect(resourcesManager.addResourceEvent.value?.pageDataProperty).toBe('heroImage')
    })
  })

  describe('setAddResourceEventResource', () => {
    test('does nothing when addResourceEvent is not set', async () => {
      const { resourcesManager, resourcesStoreActions } = createResourcesManager({ includeAdmin: true })
      resourcesStoreActions.initNewResource = vi.fn()
      await resourcesManager.setAddResourceEventResource('Type', '/endpoint', true, false)
      expect(resourcesStoreActions.initNewResource).not.toHaveBeenCalled()
    })

    test('calls initNewResource and emits selectResource when not instantAdd', async () => {
      const { resourcesManager, resourcesStoreActions, mockAdmin } = createResourcesManager({ includeAdmin: true })
      resourcesStoreActions.initNewResource = vi.fn()
      resourcesManager.addResourceEvent.value = { targetIri: '/x', addAfter: null, closest: {} } as any
      await resourcesManager.setAddResourceEventResource('MyType', '/endpoint', true, false)
      expect(resourcesStoreActions.initNewResource).toHaveBeenCalledWith(
        resourcesManager.addResourceEvent.value,
        'MyType',
        '/endpoint',
        true,
        false,
        undefined,
      )
      expect(mockAdmin!.eventBus.emit).toHaveBeenCalledWith('selectResource', expect.any(String))
    })

    test('does not emit selectResource when instantAdd is true', async () => {
      const { resourcesManager, resourcesStoreActions, mockAdmin } = createResourcesManager({ includeAdmin: true })
      resourcesStoreActions.initNewResource = vi.fn()
      resourcesManager.addResourceEvent.value = { targetIri: '/x', addAfter: null, closest: {} } as any
      await resourcesManager.setAddResourceEventResource('MyType', '/endpoint', true, true)
      expect(mockAdmin!.eventBus.emit).not.toHaveBeenCalled()
    })
  })

  describe('addResourceAction', () => {
    function setupStore(resourcesManager: ResourcesManager, opts: {
      newResourceData?: any
      addEventOverrides?: any
      storeAddingPosition?: string
      extraGetResource?: (iri: string) => any
    } = {}) {
      const newResourceIri = '/_/new-resource'
      const newResourceData = opts.newResourceData ?? {
        '@id': newResourceIri,
        '@type': 'Component',
        '_metadata': {
          persisted: true,
          adding: { endpoint: '/component', isPublishable: false, instantAdd: false },
        },
      }
      const store = (resourcesManager as any)._resourcesStore
      store.adding = { resource: newResourceIri, position: opts.storeAddingPosition }
      store.getResource = vi.fn().mockImplementation((iri: string) => {
        if (iri === newResourceIri) return { data: newResourceData }
        return opts.extraGetResource?.(iri) ?? undefined
      })
      resourcesManager.addResourceEvent.value = {
        targetIri: '/_/component_positions/p1',
        addAfter: null,
        closest: {},
        ...opts.addEventOverrides,
      } as any
      return { newResourceData, store }
    }

    test('throws when no addResourceEvent is set', async () => {
      const { resourcesManager } = createResourcesManager({ includeAdmin: true })
      await expect(resourcesManager.addResourceAction()).rejects.toThrow('No addResource event is present')
    })

    test('throws when no new resource data exists in the store', async () => {
      const { resourcesManager } = createResourcesManager({ includeAdmin: true })
      resourcesManager.addResourceEvent.value = { targetIri: '/x', addAfter: null, closest: {} } as any
      const store = (resourcesManager as any)._resourcesStore
      store.adding = { resource: '/_/new-resource' }
      store.getResource = vi.fn().mockReturnValue(undefined)
      await expect(resourcesManager.addResourceAction()).rejects.toThrow('No new resource exists in the store')
    })

    test('throws when new resource has no adding metadata', async () => {
      const { resourcesManager } = createResourcesManager({ includeAdmin: true })
      setupStore(resourcesManager, {
        newResourceData: {
          '@id': '/_/new-resource',
          '@type': 'Component',
          '_metadata': { persisted: true },
        },
      })
      await expect(resourcesManager.addResourceAction()).rejects.toThrow('no adding metadata')
    })

    test('sets componentPositions to [targetIri] when addAfter is null and no pageDataProperty', async () => {
      const { resourcesManager, cwaFetch } = createResourcesManager({ includeAdmin: true })
      cwaFetch.fetch.mockResolvedValue({ '@id': '/component/1' })
      vi.spyOn(resourcesManager, 'saveResource').mockImplementation(() => {})
      const { newResourceData } = setupStore(resourcesManager, {
        addEventOverrides: { targetIri: '/_/component_positions/p1', addAfter: null, closest: {} },
      })
      await resourcesManager.addResourceAction()
      expect(newResourceData.componentPositions).toEqual(['/_/component_positions/p1'])
    })

    test('throws when addAfter is null, no pageDataProperty, and targetIri is not a COMPONENT_POSITION', async () => {
      const { resourcesManager } = createResourcesManager({ includeAdmin: true })
      setupStore(resourcesManager, {
        addEventOverrides: { targetIri: '/_/component_groups/g1', addAfter: null, closest: {} },
      })
      await expect(resourcesManager.addResourceAction()).rejects.toThrow('Only to component positions')
    })

    test('sets sortValue from group last position when addAfter=true and targetIri is a COMPONENT_GROUP', async () => {
      const { resourcesManager, cwaFetch } = createResourcesManager({ includeAdmin: true })
      cwaFetch.fetch.mockResolvedValue({ '@id': '/component/1' })
      vi.spyOn(resourcesManager, 'saveResource').mockImplementation(() => {})
      const { newResourceData } = setupStore(resourcesManager, {
        addEventOverrides: {
          targetIri: '/_/component_groups/g1',
          addAfter: true,
          closest: { group: '/_/component_groups/g1' },
        },
        extraGetResource: (iri: string) => {
          if (iri === '/_/component_groups/g1') {
            return { data: { componentPositions: ['/_/component_positions/p1', '/_/component_positions/p2'] } }
          }
          if (iri === '/_/component_positions/p2') return { data: { sortValue: 5 } }
        },
      })
      await resourcesManager.addResourceAction()
      expect(newResourceData.sortValue).toBe(6)
    })

    test('sets sortValue from group first position when addAfter=false and targetIri is a COMPONENT_GROUP', async () => {
      const { resourcesManager, cwaFetch } = createResourcesManager({ includeAdmin: true })
      cwaFetch.fetch.mockResolvedValue({ '@id': '/component/1' })
      vi.spyOn(resourcesManager, 'saveResource').mockImplementation(() => {})
      const { newResourceData } = setupStore(resourcesManager, {
        addEventOverrides: {
          targetIri: '/_/component_groups/g1',
          addAfter: false,
          closest: { group: '/_/component_groups/g1' },
        },
        extraGetResource: (iri: string) => {
          if (iri === '/_/component_groups/g1') {
            return { data: { componentPositions: ['/_/component_positions/p1', '/_/component_positions/p2'] } }
          }
          if (iri === '/_/component_positions/p1') return { data: { '@id': '/_/component_positions/p1', 'sortValue': 3, '_metadata': {} } }
          if (iri === '/_/component_positions/p2') return { data: { '@id': '/_/component_positions/p2', 'sortValue': 4, '_metadata': {} } }
        },
      })
      await resourcesManager.addResourceAction()
      expect(newResourceData.sortValue).toBe(3)
    })

    test('shifts existing positions up before inserting to avoid sort value collisions', async () => {
      const { resourcesManager, cwaFetch } = createResourcesManager({ includeAdmin: true })
      cwaFetch.fetch.mockResolvedValue({ '@id': '/component/1' })
      vi.spyOn(resourcesManager, 'saveResource').mockImplementation(() => {})
      const updateSpy = vi.spyOn(resourcesManager, 'updateResource').mockResolvedValue(undefined)
      setupStore(resourcesManager, {
        addEventOverrides: {
          targetIri: '/_/component_groups/g1',
          addAfter: false,
          closest: { group: '/_/component_groups/g1' },
        },
        extraGetResource: (iri: string) => {
          if (iri === '/_/component_groups/g1') {
            return { data: { componentPositions: ['/_/component_positions/p1', '/_/component_positions/p2'] } }
          }
          if (iri === '/_/component_positions/p1') return { data: { '@id': '/_/component_positions/p1', 'sortValue': 3, '_metadata': {} } }
          if (iri === '/_/component_positions/p2') return { data: { '@id': '/_/component_positions/p2', 'sortValue': 4, '_metadata': {} } }
        },
      })
      await resourcesManager.addResourceAction()
      // p2 (sortValue=4) must be shifted before p1 (sortValue=3) to avoid intermediate collisions
      expect(updateSpy).toHaveBeenNthCalledWith(1, expect.objectContaining({ endpoint: '/_/component_positions/p2', data: { sortValue: 5 }, refreshEndpoints: [] }))
      expect(updateSpy).toHaveBeenNthCalledWith(2, expect.objectContaining({ endpoint: '/_/component_positions/p1', data: { sortValue: 4 }, refreshEndpoints: [] }))
    })

    test('does not shift when adding to end of group (add after last position)', async () => {
      const { resourcesManager, cwaFetch } = createResourcesManager({ includeAdmin: true })
      cwaFetch.fetch.mockResolvedValue({ '@id': '/component/1' })
      vi.spyOn(resourcesManager, 'saveResource').mockImplementation(() => {})
      const updateSpy = vi.spyOn(resourcesManager, 'updateResource').mockResolvedValue(undefined)
      const { newResourceData } = setupStore(resourcesManager, {
        addEventOverrides: {
          targetIri: '/_/component_groups/g1',
          addAfter: true,
          closest: { group: '/_/component_groups/g1' },
        },
        extraGetResource: (iri: string) => {
          if (iri === '/_/component_groups/g1') {
            return { data: { componentPositions: ['/_/component_positions/p1'] } }
          }
          if (iri === '/_/component_positions/p1') return { data: { '@id': '/_/component_positions/p1', 'sortValue': 2, '_metadata': {} } }
        },
      })
      await resourcesManager.addResourceAction()
      expect(newResourceData.sortValue).toBe(3) // last sortValue + 1
      expect(updateSpy).not.toHaveBeenCalled() // no shift needed
    })

    test('sets publishedAt when publish=true', async () => {
      const { resourcesManager, cwaFetch } = createResourcesManager({ includeAdmin: true })
      cwaFetch.fetch.mockResolvedValue({ '@id': '/component/1' })
      vi.spyOn(resourcesManager, 'saveResource').mockImplementation(() => {})
      const { newResourceData } = setupStore(resourcesManager, {
        addEventOverrides: { targetIri: '/_/component_positions/p1', addAfter: null, closest: {} },
      })
      await resourcesManager.addResourceAction(true)
      expect(newResourceData.publishedAt).toBeTruthy()
    })

    test('sets publishedAt to null when publish=false', async () => {
      const { resourcesManager, cwaFetch } = createResourcesManager({ includeAdmin: true })
      cwaFetch.fetch.mockResolvedValue({ '@id': '/component/1' })
      vi.spyOn(resourcesManager, 'saveResource').mockImplementation(() => {})
      const { newResourceData } = setupStore(resourcesManager, {
        addEventOverrides: { targetIri: '/_/component_positions/p1', addAfter: null, closest: {} },
      })
      await resourcesManager.addResourceAction(false)
      expect(newResourceData.publishedAt).toBeNull()
    })

    test('calls updateResource with pageDataProperty binding after creating', async () => {
      const mockResources = { pageDataIri: { value: '/page_data/uuid' } }
      const { resourcesManager, cwaFetch } = createResourcesManager({
        includeAdmin: true,
        fetcher: undefined,
        resources: mockResources,
      })
      const updateSpy = vi.spyOn(resourcesManager, 'updateResource').mockResolvedValue(undefined)
      cwaFetch.fetch.mockResolvedValue({ '@id': '/component/new' })
      vi.spyOn(resourcesManager, 'saveResource').mockImplementation(() => {})
      setupStore(resourcesManager, {
        addEventOverrides: {
          targetIri: '/_/component_positions/p1',
          addAfter: null,
          closest: {},
          pageDataProperty: 'heroImage',
        },
      })
      await resourcesManager.addResourceAction()
      expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({
        endpoint: '/page_data/uuid',
        data: { heroImage: '/component/new' },
      }))
    })

    test('clears addResourceEvent after successful create via requestCompleteFn', async () => {
      const { resourcesManager, cwaFetch, resourcesStoreActions } = createResourcesManager({ includeAdmin: true })
      cwaFetch.fetch.mockResolvedValue({ '@id': '/component/1' })
      vi.spyOn(resourcesManager, 'saveResource').mockImplementation(() => {})
      setupStore(resourcesManager, {
        addEventOverrides: { targetIri: '/_/component_positions/p1', addAfter: null, closest: {} },
      })
      await resourcesManager.addResourceAction()
      expect(resourcesManager.addResourceEvent.value).toBeUndefined()
      expect(resourcesStoreActions.resetNewResource).toHaveBeenCalled()
    })
  })

  describe('getWaitForRequestPromise', () => {
    test('resolves immediately when no requests are in progress', async () => {
      const { resourcesManager } = createResourcesManager()
      await expect(resourcesManager.getWaitForRequestPromise('/endpoint', 'field')).resolves.toBeUndefined()
    })

    test('waits and resolves when a conflicting in-flight request completes', async () => {
      let resolveRequest!: (v: any) => void
      const { resourcesManager, cwaFetch } = createResourcesManager()
      cwaFetch.fetch.mockReturnValue(new Promise(r => (resolveRequest = r)))
      vi.spyOn(resourcesManager, 'saveResource').mockImplementation(() => {})

      resourcesManager.createResource({ endpoint: '/endpoint', data: { field: 'value' } })

      let resolved = false
      const wait = resourcesManager
        .getWaitForRequestPromise('/endpoint', 'field')
        .then(() => { resolved = true })

      await Promise.resolve()
      expect(resolved).toBe(false)

      resolveRequest({ '@id': '/endpoint/1' })
      await wait
      expect(resolved).toBe(true)
    })

    test('resolves immediately when in-flight request is for the same source (no conflict)', async () => {
      let resolveRequest!: (v: any) => void
      const { resourcesManager, cwaFetch } = createResourcesManager()
      cwaFetch.fetch.mockReturnValue(new Promise(r => (resolveRequest = r)))
      vi.spyOn(resourcesManager, 'saveResource').mockImplementation(() => {})

      resourcesManager.createResource({ endpoint: '/endpoint', data: { field: 'value' }, source: 'my-source' })

      let resolved = false
      resourcesManager
        .getWaitForRequestPromise('/endpoint', 'field', 'my-source')
        .then(() => { resolved = true })

      await Promise.resolve()
      expect(resolved).toBe(true)

      resolveRequest({ '@id': '/endpoint/1' })
    })
  })

  describe('doResourceRequest (via createResource)', () => {
    test('calls errorStore.error and cleans up requestsInProgress on fetch failure', async () => {
      const { resourcesManager, cwaFetch, errorStoreActions } = createResourcesManager()
      const err = new Error('network fail')
      cwaFetch.fetch.mockRejectedValue(err)
      await resourcesManager.createResource({ endpoint: '/api/things', data: {} })
      expect(errorStoreActions.error).toHaveBeenCalledWith(
        expect.objectContaining({ endpoint: '/api/things' }),
        err,
      )
      expect(resourcesManager.requestCount.value).toBe(0)
    })

    test('calls requestCompleteFn with the response resource on success', async () => {
      const { resourcesManager, cwaFetch } = createResourcesManager()
      const mockResource = { '@id': '/things/1', '@type': 'Thing' }
      cwaFetch.fetch.mockResolvedValue(mockResource)
      const requestCompleteFn = vi.fn()
      vi.spyOn(resourcesManager, 'saveResource').mockImplementation(() => {})
      await resourcesManager.createResource({ endpoint: '/api/things', data: {}, requestCompleteFn })
      expect(requestCompleteFn).toHaveBeenCalledWith(mockResource)
    })

    test('calls saveCompleteFn after saving the resource', async () => {
      const { resourcesManager, cwaFetch } = createResourcesManager()
      const mockResource = { '@id': '/things/1', '@type': 'Thing' }
      cwaFetch.fetch.mockResolvedValue(mockResource)
      const saveCompleteFn = vi.fn()
      vi.spyOn(resourcesManager, 'saveResource').mockImplementation(() => {})
      await resourcesManager.createResource({ endpoint: '/api/things', data: {}, saveCompleteFn })
      expect(saveCompleteFn).toHaveBeenCalledWith(mockResource)
    })

    test('POST response componentPositions are added to refreshEndpoints and fetchBatch is called', async () => {
      const mockFetcher = { fetchBatch: vi.fn().mockResolvedValue(undefined) }
      const { resourcesManager, cwaFetch } = createResourcesManager({ fetcher: mockFetcher })
      const mockResource = { '@id': '/things/1', 'componentPositions': ['/positions/a', '/positions/b'] }
      cwaFetch.fetch.mockResolvedValue(mockResource)
      vi.spyOn(resourcesManager, 'saveResource').mockImplementation(() => {})
      await resourcesManager.createResource({ endpoint: '/api/things', data: {} })
      expect(mockFetcher.fetchBatch).toHaveBeenCalledWith(
        expect.objectContaining({ paths: expect.arrayContaining(['/positions/a', '/positions/b']) }),
      )
    })

    test('fetchBatch 404 is swallowed and resource is still saved', async () => {
      const notFoundError = Object.assign(new Error('Not Found'), { statusCode: 404 })
      const mockFetcher = { fetchBatch: vi.fn().mockRejectedValue(notFoundError) }
      const { resourcesManager, cwaFetch, errorStoreActions } = createResourcesManager({ fetcher: mockFetcher })
      const mockResource = { '@id': '/things/1', 'componentPositions': ['/positions/a'] }
      cwaFetch.fetch.mockResolvedValue(mockResource)
      const saveSpy = vi.spyOn(resourcesManager, 'saveResource').mockImplementation(() => {})
      await resourcesManager.createResource({ endpoint: '/api/things', data: {} })
      expect(errorStoreActions.error).not.toHaveBeenCalled()
      expect(saveSpy).toHaveBeenCalled()
    })

    test('non-404 fetchBatch error is caught by the outer handler and recorded as an error', async () => {
      const serverError = Object.assign(new Error('Server Error'), { statusCode: 500 })
      const mockFetcher = { fetchBatch: vi.fn().mockRejectedValue(serverError) }
      const { resourcesManager, cwaFetch, errorStoreActions } = createResourcesManager({ fetcher: mockFetcher })
      cwaFetch.fetch.mockResolvedValue({ '@id': '/things/1', 'componentPositions': ['/positions/a'] })
      vi.spyOn(resourcesManager, 'saveResource').mockImplementation(() => {})
      await resourcesManager.createResource({ endpoint: '/api/things', data: {} })
      expect(errorStoreActions.error).toHaveBeenCalledWith(
        expect.objectContaining({ endpoint: '/api/things' }),
        serverError,
      )
    })
  })
})
