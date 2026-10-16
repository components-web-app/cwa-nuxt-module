import { describe, vi, test, expect, beforeEach, afterEach } from 'vitest'
import type { App } from 'vue'
import { createConfirmDialog } from 'vuejs-confirm-dialog'
import { createPinia, setActivePinia } from 'pinia'
import { ResourcesManager } from './resources-manager'
import { Resources } from './resources'
import { ResourcesStore } from '#cwa/storage/stores/resources/resources-store'
import { FetcherStore } from '#cwa/storage/stores/fetcher/fetcher-store'
import { ErrorStore } from '#cwa/storage/stores/error/error-store'
import type { CwaResource } from '#cwa/resources/resource-utils'

vi.mock('#cwa/templates/components/core/ConfirmDialog.vue', () => ({ default: {} }))
vi.mock('vuejs-confirm-dialog', () => ({
  install: vi.fn(),
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
    {} as App,
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
      const saveSpy = vi.spyOn(resourcesManager, 'storeResource').mockImplementation(() => {})
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
      const saveSpy = vi.spyOn(resourcesManager, 'storeResource').mockImplementation(() => {})
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
      const saveSpy = vi.spyOn(resourcesManager, 'storeResource').mockImplementation(() => {})
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

  describe('storeResource', () => {
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

      const result = resourcesManager.storeResource(mockPayload)

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

    test('asks for confirmation by default', async () => {
      const { resourcesManager, cwaFetch } = createResourcesManager()
      cwaFetch.fetch.mockResolvedValue({})
      await resourcesManager.deleteResource({ endpoint: '/components/1' })
      expect(createConfirmDialog).toHaveBeenCalledTimes(1)
    })

    test('with force, sends the DELETE without asking for confirmation', async () => {
      const { resourcesManager, cwaFetch, resourcesStoreActions } = createResourcesManager()
      resourcesStoreActions.getResource.mockReturnValue(undefined)
      cwaFetch.fetch.mockResolvedValue({})
      await resourcesManager.deleteResource({ endpoint: '/_/component_groups/1' }, true)
      expect(createConfirmDialog).not.toHaveBeenCalled()
      expect(cwaFetch.fetch).toHaveBeenCalledWith(
        '/_/component_groups/1',
        expect.objectContaining({ method: 'DELETE' }),
      )
    })
  })

  describe('updateResource (additional branches)', () => {
    test('uses POST method when event.data is FormData', async () => {
      const { resourcesManager, cwaFetch } = createResourcesManager()
      cwaFetch.fetch.mockResolvedValue({ '@id': '/things/1' })
      vi.spyOn(resourcesManager, 'storeResource').mockImplementation(() => {})
      await resourcesManager.updateResource({ endpoint: '/things/1', data: new FormData() })
      expect(cwaFetch.fetch).toHaveBeenCalledWith(
        '/things/1',
        expect.objectContaining({ method: 'POST' }),
      )
    })

    test('merges event headers into the request headers', async () => {
      const { resourcesManager, cwaFetch } = createResourcesManager()
      cwaFetch.fetch.mockResolvedValue({ '@id': '/things/1' })
      vi.spyOn(resourcesManager, 'storeResource').mockImplementation(() => {})
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
      const saveSpy = vi.spyOn(resourcesManager, 'storeResource').mockImplementation(() => {})
      await resourcesManager.updateResource({ endpoint: '/things/1', data: { name: 'new' } })
      expect(cwaFetch.fetch).not.toHaveBeenCalled()
      expect(saveSpy).toHaveBeenCalled()
    })

    describe('a component still being added takes each change as the API would', () => {
      function updateUnpersisted(existing: Record<string, any>, data: Record<string, any>) {
        const { resourcesManager, resourcesStoreActions } = createResourcesManager()
        resourcesStoreActions.getResource.mockReturnValue({
          data: {
            '@id': '__new__',
            '@type': 'HtmlContent',
            ...existing,
            '_metadata': { persisted: false, adding: { endpoint: '/component/html_contents' } },
          },
        })
        const saveSpy = vi.spyOn(resourcesManager, 'storeResource').mockImplementation(() => {})
        return resourcesManager.updateResource({ endpoint: '__new__', data }).then(() => saveSpy.mock.calls[0]?.[0]?.resource)
      }

      test('selecting a second style gives both styles once', async () => {
        const stored = await updateUnpersisted({ uiClassNames: ['block-text'] }, { uiClassNames: ['block-text', 'text-center'] })
        expect(stored.uiClassNames).toEqual(['block-text', 'text-center'])
      })

      test('deselecting a style removes it', async () => {
        const stored = await updateUnpersisted({ uiClassNames: ['block-text', 'text-center'] }, { uiClassNames: ['text-center'] })
        expect(stored.uiClassNames).toEqual(['text-center'])
      })

      test('choosing the default style clears the styles', async () => {
        const stored = await updateUnpersisted({ uiClassNames: ['block-text'] }, { uiClassNames: null })
        expect(stored.uiClassNames).toBeNull()
      })

      test('a nested object change still keeps the fields it does not mention', async () => {
        const stored = await updateUnpersisted({ settings: { a: 1, b: 2 } }, { settings: { b: 3 } })
        expect(stored.settings).toEqual({ a: 1, b: 3 })
      })

      test('the adding metadata is kept', async () => {
        const stored = await updateUnpersisted({}, { uiClassNames: ['block-text'] })
        expect(stored._metadata).toEqual({ persisted: false, adding: { endpoint: '/component/html_contents' } })
      })
    })

    function publishableThings(livePositions: string[] = [], draftPositions?: string[]) {
      return (iri: string) => {
        if (iri === '/things/draft') {
          return {
            data: {
              '@id': '/things/draft',
              '@type': 'Thing',
              'publishedResource': '/things/live',
              'componentPositions': draftPositions,
              '_metadata': { persisted: true, publishable: { published: false } },
            },
          }
        }
        if (iri === '/things/live') {
          return { data: { '@id': '/things/live', 'draftResource': '/things/draft', 'componentPositions': livePositions, '_metadata': { persisted: true, publishable: { published: true } } } }
        }
      }
    }

    const publishedLiveResponse = { '@id': '/things/live', 'draftResource': null, '_metadata': { persisted: true, publishable: { published: true } } }
    const stillDraftResponse = { '@id': '/things/draft', 'publishedResource': '/things/live', '_metadata': { persisted: true, publishable: { published: false } } }

    test('calls admin.emptyStack when the response is the published live resource', async () => {
      const { resourcesManager, cwaFetch, resourcesStoreActions, mockAdmin } = createResourcesManager({ includeAdmin: true })
      resourcesStoreActions.getResource.mockImplementation(publishableThings())
      cwaFetch.fetch.mockResolvedValue(publishedLiveResponse)
      vi.spyOn(resourcesManager, 'storeResource').mockImplementation(() => {})
      await resourcesManager.updateResource({ endpoint: '/things/draft', data: { publishedAt: new Date().toISOString() } })
      expect(mockAdmin!.emptyStack).toHaveBeenCalled()
    })

    test('removes the draft only when the response is the published live resource (#373)', async () => {
      const { resourcesManager, cwaFetch, resourcesStoreActions, mockAdmin } = createResourcesManager({ includeAdmin: true })
      resourcesStoreActions.getResource.mockImplementation(publishableThings())
      cwaFetch.fetch.mockResolvedValue(publishedLiveResponse)
      vi.spyOn(resourcesManager, 'storeResource').mockImplementation(() => {})
      const removeSpy = vi.spyOn(resourcesManager, 'removeResource')
      await resourcesManager.updateResource({ endpoint: '/things/draft', data: { publishedAt: new Date().toISOString() } })
      expect(removeSpy).toHaveBeenCalledWith({ resource: '/things/draft', noCascade: true })
      expect(mockAdmin!.resourceStackManager.forcePublishedVersion.value).toBeUndefined()
    })

    test('refreshes the live resource\'s positions once the response is the published live resource', async () => {
      const fetcher = { fetchBatch: vi.fn().mockResolvedValue(undefined) }
      const { resourcesManager, cwaFetch, resourcesStoreActions } = createResourcesManager({ includeAdmin: true, fetcher })
      resourcesStoreActions.getResource.mockImplementation(publishableThings(['/_/component_positions/1']))
      cwaFetch.fetch.mockResolvedValue(publishedLiveResponse)
      vi.spyOn(resourcesManager, 'storeResource').mockImplementation(() => {})
      await resourcesManager.updateResource({ endpoint: '/things/draft', data: { publishedAt: new Date().toISOString() } })
      expect(fetcher.fetchBatch).toHaveBeenCalledWith({ paths: ['/_/component_positions/1'], shallowFetch: 'noexist' })
    })

    test('publishing a draft that sits in its own position also refreshes that position, which the API empties when it deletes the draft (#395)', async () => {
      const fetcher = { fetchBatch: vi.fn().mockResolvedValue(undefined) }
      const { resourcesManager, cwaFetch, resourcesStoreActions } = createResourcesManager({ includeAdmin: true, fetcher })
      resourcesStoreActions.getResource.mockImplementation(publishableThings(['/_/component_positions/1'], ['/_/component_positions/draft']))
      cwaFetch.fetch.mockResolvedValue(publishedLiveResponse)
      vi.spyOn(resourcesManager, 'storeResource').mockImplementation(() => {})
      await resourcesManager.updateResource({ endpoint: '/things/draft', data: { publishedAt: 'now' } })
      expect(fetcher.fetchBatch).toHaveBeenCalledWith({ paths: ['/_/component_positions/1', '/_/component_positions/draft'], shallowFetch: 'noexist' })
    })

    test('publishing a draft first sends the edit still waiting to be saved, so what the editor shows is what is published (#394)', async () => {
      const { resourcesManager, cwaFetch, resourcesStoreActions } = createResourcesManager({ includeAdmin: true })
      resourcesStoreActions.getResource.mockImplementation(publishableThings())
      cwaFetch.fetch.mockResolvedValue(stillDraftResponse)
      vi.spyOn(resourcesManager, 'storeResource').mockImplementation(() => {})
      const flush = vi.fn(() => resourcesManager.updateResource({ endpoint: '/things/draft?published=false', data: { html: 'last keystroke' } }))
      const otherFlush = vi.fn()
      resourcesManager.registerPendingUpdate('/things/draft', flush)
      resourcesManager.registerPendingUpdate('/things/other', otherFlush)
      await resourcesManager.updateResource({ endpoint: '/things/draft', data: { publishedAt: 'now' } })
      expect(flush).toHaveBeenCalledOnce()
      expect(otherFlush).not.toHaveBeenCalled()
      expect(cwaFetch.fetch.mock.calls.map(call => call[1].body)).toEqual([{ html: 'last keystroke' }, { publishedAt: 'now' }])
    })

    test('publishing waits for a save of the same resource already in flight (#394)', async () => {
      const { resourcesManager, cwaFetch, resourcesStoreActions } = createResourcesManager({ includeAdmin: true })
      resourcesStoreActions.getResource.mockImplementation(publishableThings())
      let resolveSave: (value: unknown) => void = () => {}
      cwaFetch.fetch
        .mockImplementationOnce(() => new Promise((resolve) => { resolveSave = resolve }))
        .mockResolvedValue(stillDraftResponse)
      vi.spyOn(resourcesManager, 'storeResource').mockImplementation(() => {})
      const saving = resourcesManager.updateResource({ endpoint: '/things/draft?published=false', data: { html: 'last keystroke' }, source: 'input_1' })
      const publishing = resourcesManager.updateResource({ endpoint: '/things/draft', data: { publishedAt: 'now' } })
      await new Promise(resolve => setTimeout(resolve, 0))
      expect(cwaFetch.fetch).toHaveBeenCalledTimes(1)
      resolveSave(stillDraftResponse)
      await Promise.all([saving, publishing])
      expect(cwaFetch.fetch.mock.calls.map(call => call[1].body)).toEqual([{ html: 'last keystroke' }, { publishedAt: 'now' }])
    })

    test('a response that is still the draft is not a publish, whatever the browser clock says (#373)', async () => {
      const fetcher = { fetchBatch: vi.fn().mockResolvedValue(undefined) }
      const { resourcesManager, cwaFetch, resourcesStoreActions, mockAdmin } = createResourcesManager({ includeAdmin: true, fetcher })
      resourcesStoreActions.getResource.mockImplementation(publishableThings(['/_/component_positions/1']))
      cwaFetch.fetch.mockResolvedValue(stillDraftResponse)
      vi.spyOn(resourcesManager, 'storeResource').mockImplementation(() => {})
      const removeSpy = vi.spyOn(resourcesManager, 'removeResource')
      await resourcesManager.updateResource({ endpoint: '/things/draft', data: { publishedAt: new Date(Date.now() - 1000).toISOString() } })
      expect(cwaFetch.fetch).toHaveBeenCalledTimes(1)
      expect(mockAdmin!.emptyStack).not.toHaveBeenCalled()
      expect(removeSpy).not.toHaveBeenCalled()
      expect(fetcher.fetchBatch).not.toHaveBeenCalled()
    })

    test('a server-published response is a publish even when the browser clock thought the time was ahead (#373)', async () => {
      const { resourcesManager, cwaFetch, resourcesStoreActions, mockAdmin } = createResourcesManager({ includeAdmin: true })
      resourcesStoreActions.getResource.mockImplementation(publishableThings())
      cwaFetch.fetch.mockResolvedValue(publishedLiveResponse)
      vi.spyOn(resourcesManager, 'storeResource').mockImplementation(() => {})
      const removeSpy = vi.spyOn(resourcesManager, 'removeResource')
      await resourcesManager.updateResource({ endpoint: '/things/draft', data: { publishedAt: new Date(Date.now() + 500).toISOString() } })
      expect(mockAdmin!.emptyStack).toHaveBeenCalled()
      expect(removeSpy).toHaveBeenCalledWith({ resource: '/things/draft', noCascade: true })
    })

    test('a published response under the draft\'s own IRI is not treated as replacing the live resource', async () => {
      const { resourcesManager, cwaFetch, resourcesStoreActions, mockAdmin } = createResourcesManager({ includeAdmin: true })
      resourcesStoreActions.getResource.mockImplementation(publishableThings())
      cwaFetch.fetch.mockResolvedValue({ ...stillDraftResponse, _metadata: { persisted: true, publishable: { published: true } } })
      vi.spyOn(resourcesManager, 'storeResource').mockImplementation(() => {})
      const removeSpy = vi.spyOn(resourcesManager, 'removeResource')
      await resourcesManager.updateResource({ endpoint: '/things/draft', data: { publishedAt: new Date().toISOString() } })
      expect(mockAdmin!.emptyStack).not.toHaveBeenCalled()
      expect(removeSpy).not.toHaveBeenCalled()
    })

    test('a response under the live IRI that is not published is not a publish', async () => {
      const { resourcesManager, cwaFetch, resourcesStoreActions, mockAdmin } = createResourcesManager({ includeAdmin: true })
      resourcesStoreActions.getResource.mockImplementation(publishableThings())
      cwaFetch.fetch.mockResolvedValue({ ...publishedLiveResponse, _metadata: { persisted: true, publishable: { published: false } } })
      vi.spyOn(resourcesManager, 'storeResource').mockImplementation(() => {})
      const removeSpy = vi.spyOn(resourcesManager, 'removeResource')
      await resourcesManager.updateResource({ endpoint: '/things/draft', data: { publishedAt: new Date().toISOString() } })
      expect(mockAdmin!.emptyStack).not.toHaveBeenCalled()
      expect(removeSpy).not.toHaveBeenCalled()
    })

    test('updating a live resource that comes back published does not remove it', async () => {
      const { resourcesManager, cwaFetch, resourcesStoreActions, mockAdmin } = createResourcesManager({ includeAdmin: true })
      resourcesStoreActions.getResource.mockImplementation(publishableThings())
      cwaFetch.fetch.mockResolvedValue(publishedLiveResponse)
      vi.spyOn(resourcesManager, 'storeResource').mockImplementation(() => {})
      const removeSpy = vi.spyOn(resourcesManager, 'removeResource')
      await resourcesManager.updateResource({ endpoint: '/things/live', data: { publishedAt: new Date().toISOString() } })
      expect(cwaFetch.fetch).toHaveBeenCalledTimes(1)
      expect(mockAdmin!.emptyStack).not.toHaveBeenCalled()
      expect(removeSpy).not.toHaveBeenCalled()
    })

    test('a future publishedAt schedules the draft rather than publishing it (#320)', async () => {
      const { resourcesManager, cwaFetch, resourcesStoreActions, mockAdmin } = createResourcesManager({ includeAdmin: true })
      resourcesStoreActions.getResource.mockImplementation((iri: string) => {
        if (iri === '/things/draft') {
          return {
            data: {
              '@id': '/things/draft',
              '@type': 'Thing',
              'publishedResource': '/things/live',
              '_metadata': { persisted: true, publishable: { published: false } },
            },
          }
        }
        if (iri === '/things/live') {
          return { data: { '@id': '/things/live', 'componentPositions': ['/_/component_positions/1'] } }
        }
      })
      cwaFetch.fetch.mockResolvedValue({ '@id': '/things/draft' })
      vi.spyOn(resourcesManager, 'storeResource').mockImplementation(() => {})
      const removeSpy = vi.spyOn(resourcesManager, 'removeResource')
      const future = new Date(Date.now() + 86_400_000).toISOString()

      const event = { endpoint: '/things/draft', data: { publishedAt: future } }
      await resourcesManager.updateResource(event)

      expect(cwaFetch.fetch).toHaveBeenCalledTimes(1)
      expect(event).not.toHaveProperty('refreshEndpoints')
      expect(mockAdmin!.emptyStack).not.toHaveBeenCalled()
      expect(removeSpy).not.toHaveBeenCalled()
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
      vi.spyOn(resourcesManager, 'storeResource').mockImplementation(() => {})
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
    afterEach(() => {
      vi.useRealTimers()
    })

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
      vi.spyOn(resourcesManager, 'storeResource').mockImplementation(() => {})
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

    test('posts publishedAt "now" when publish=true so the API publishes by its own clock (#381)', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-02T03:04:05.678Z'))
      const { resourcesManager, cwaFetch } = createResourcesManager({ includeAdmin: true })
      cwaFetch.fetch.mockResolvedValue({ '@id': '/component/1' })
      vi.spyOn(resourcesManager, 'storeResource').mockImplementation(() => {})
      setupStore(resourcesManager, {
        addEventOverrides: { targetIri: '/_/component_positions/p1', addAfter: null, closest: {} },
      })
      await resourcesManager.addResourceAction(true)
      expect(cwaFetch.fetch).toHaveBeenCalledWith('/component', expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({ publishedAt: 'now' }),
      }))
    })

    test('sets publishedAt to null when publish=false', async () => {
      const { resourcesManager, cwaFetch } = createResourcesManager({ includeAdmin: true })
      cwaFetch.fetch.mockResolvedValue({ '@id': '/component/1' })
      vi.spyOn(resourcesManager, 'storeResource').mockImplementation(() => {})
      const { newResourceData } = setupStore(resourcesManager, {
        addEventOverrides: { targetIri: '/_/component_positions/p1', addAfter: null, closest: {} },
      })
      await resourcesManager.addResourceAction(false)
      expect(newResourceData.publishedAt).toBeNull()
      expect(cwaFetch.fetch).toHaveBeenCalledWith('/component', expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({ publishedAt: null }),
      }))
    })

    test('binds the new component on the page data at the target position\'s depth, not the routed page\'s', async () => {
      const mockResources = {
        pageDataIri: { value: '/page_data/routed' },
        pageDataIriOf: vi.fn((iri: string) => ({ value: iri === '/_/component_positions/p1' ? '/page_data/uuid' : undefined })),
      }
      const { resourcesManager, cwaFetch } = createResourcesManager({
        includeAdmin: true,
        fetcher: undefined,
        resources: mockResources,
      })
      const updateSpy = vi.spyOn(resourcesManager, 'updateResource').mockResolvedValue(undefined)
      cwaFetch.fetch.mockResolvedValue({ '@id': '/component/new' })
      vi.spyOn(resourcesManager, 'storeResource').mockImplementation(() => {})
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
      expect(mockResources.pageDataIriOf).toHaveBeenCalledWith('/_/component_positions/p1')
    })

    test('clears addResourceEvent after successful create via requestCompleteFn', async () => {
      const { resourcesManager, cwaFetch, resourcesStoreActions } = createResourcesManager({ includeAdmin: true })
      cwaFetch.fetch.mockResolvedValue({ '@id': '/component/1' })
      vi.spyOn(resourcesManager, 'storeResource').mockImplementation(() => {})
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
      vi.spyOn(resourcesManager, 'storeResource').mockImplementation(() => {})

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
      vi.spyOn(resourcesManager, 'storeResource').mockImplementation(() => {})

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
      vi.spyOn(resourcesManager, 'storeResource').mockImplementation(() => {})
      await resourcesManager.createResource({ endpoint: '/api/things', data: {}, requestCompleteFn })
      expect(requestCompleteFn).toHaveBeenCalledWith(mockResource)
    })

    test('calls saveCompleteFn after saving the resource', async () => {
      const { resourcesManager, cwaFetch } = createResourcesManager()
      const mockResource = { '@id': '/things/1', '@type': 'Thing' }
      cwaFetch.fetch.mockResolvedValue(mockResource)
      const saveCompleteFn = vi.fn()
      vi.spyOn(resourcesManager, 'storeResource').mockImplementation(() => {})
      await resourcesManager.createResource({ endpoint: '/api/things', data: {}, saveCompleteFn })
      expect(saveCompleteFn).toHaveBeenCalledWith(mockResource)
    })

    test('POST response componentPositions are added to refreshEndpoints and fetchBatch is called', async () => {
      const mockFetcher = { fetchBatch: vi.fn().mockResolvedValue(undefined) }
      const { resourcesManager, cwaFetch } = createResourcesManager({ fetcher: mockFetcher })
      const mockResource = { '@id': '/things/1', 'componentPositions': ['/positions/a', '/positions/b'] }
      cwaFetch.fetch.mockResolvedValue(mockResource)
      vi.spyOn(resourcesManager, 'storeResource').mockImplementation(() => {})
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
      const saveSpy = vi.spyOn(resourcesManager, 'storeResource').mockImplementation(() => {})
      await resourcesManager.createResource({ endpoint: '/api/things', data: {} })
      expect(errorStoreActions.error).not.toHaveBeenCalled()
      expect(saveSpy).toHaveBeenCalled()
    })

    test('non-404 fetchBatch error is caught by the outer handler and recorded as an error', async () => {
      const serverError = Object.assign(new Error('Server Error'), { statusCode: 500 })
      const mockFetcher = { fetchBatch: vi.fn().mockRejectedValue(serverError) }
      const { resourcesManager, cwaFetch, errorStoreActions } = createResourcesManager({ fetcher: mockFetcher })
      cwaFetch.fetch.mockResolvedValue({ '@id': '/things/1', 'componentPositions': ['/positions/a'] })
      vi.spyOn(resourcesManager, 'storeResource').mockImplementation(() => {})
      await resourcesManager.createResource({ endpoint: '/api/things', data: {} })
      expect(errorStoreActions.error).toHaveBeenCalledWith(
        expect.objectContaining({ endpoint: '/api/things' }),
        serverError,
      )
    })
  })

  describe('reqCount watcher (line 79)', () => {
    test('resets reqCount to 0 when it reaches 10000', async () => {
      const { resourcesManager } = createResourcesManager()
      ;(resourcesManager as any).reqCount.value = 10000
      await new Promise(resolve => setTimeout(resolve, 0))
      expect((resourcesManager as any).reqCount.value).toBe(0)
    })

    test('does not reset reqCount when below the threshold', async () => {
      const { resourcesManager } = createResourcesManager()
      ;(resourcesManager as any).reqCount.value = 9999
      await new Promise(resolve => setTimeout(resolve, 0))
      expect((resourcesManager as any).reqCount.value).toBe(9999)
    })
  })

  describe('requestCount getter caching (line 91)', () => {
    test('returns the same cached computed ref on subsequent calls', () => {
      const { resourcesManager } = createResourcesManager()
      const first = resourcesManager.requestCount
      const second = resourcesManager.requestCount
      expect(second).toBe(first)
    })
  })

  describe('getWaitForRequestPromise (additional branches)', () => {
    test('treats an in-flight DELETE (no data) for the same endpoint as a conflict (line 105)', async () => {
      const { resourcesManager } = createResourcesManager()
      const requests = (resourcesManager as any).requestsInProgress
      requests.delete = {
        1: {
          event: { endpoint: '/delete-endpoint' },
          args: ['/delete-endpoint', { method: 'DELETE', headers: {} }],
        },
      }

      let resolved = false
      const wait = resourcesManager
        .getWaitForRequestPromise('/delete-endpoint', 'field')
        .then(() => { resolved = true })

      await Promise.resolve()
      expect(resolved).toBe(false)

      delete requests.delete
      await wait
      expect(resolved).toBe(true)
    })

    test('stays pending while an unrelated conflicting request is still in flight (line 119)', async () => {
      let resolveFirst!: (v: any) => void
      let resolveSecond!: (v: any) => void
      const { resourcesManager, cwaFetch } = createResourcesManager()
      cwaFetch.fetch
        .mockReturnValueOnce(new Promise(r => (resolveFirst = r)))
        .mockReturnValueOnce(new Promise(r => (resolveSecond = r)))
      vi.spyOn(resourcesManager, 'storeResource').mockImplementation(() => {})

      const p1 = resourcesManager.createResource({ endpoint: '/endpoint', data: { field: 'a' } })
      const p2 = resourcesManager.createResource({ endpoint: '/endpoint', data: { field: 'b' } })
      await Promise.resolve()

      let resolved = false
      const wait = resourcesManager
        .getWaitForRequestPromise('/endpoint', 'field')
        .then(() => { resolved = true })

      await Promise.resolve()
      expect(resolved).toBe(false)

      resolveFirst({ '@id': '/endpoint/1' })
      await p1
      await Promise.resolve()
      expect(resolved).toBe(false)

      resolveSecond({ '@id': '/endpoint/2' })
      await p2
      await wait
      expect(resolved).toBe(true)
    })
  })

  describe('updateResource non-persisted array merge (line 196)', () => {
    test('replaces array fields when merging an unpersisted resource update', async () => {
      const { resourcesManager, cwaFetch, resourcesStoreActions } = createResourcesManager()
      resourcesStoreActions.getResource.mockReturnValue({
        data: {
          '@id': '/things/1',
          '@type': 'Thing',
          'tags': ['existing'],
          '_metadata': { persisted: false },
        },
      })
      const saveSpy = vi.spyOn(resourcesManager, 'storeResource').mockImplementation(() => {})
      await resourcesManager.updateResource({ endpoint: '/things/1', data: { tags: ['added'] } })
      expect(cwaFetch.fetch).not.toHaveBeenCalled()
      const saved = saveSpy.mock.calls[0]![0] as any
      expect(saved.resource.tags).toEqual(['added'])
    })
  })

  describe('initAddResource findClosestPositionFromGroupEvent (line 391)', () => {
    test('leaves closest.position undefined when the target group has no positions', async () => {
      const { resourcesManager } = createResourcesManager({ includeAdmin: true })
      const store = (resourcesManager as any)._resourcesStore
      store.current = {
        byId: {
          '/_/component_groups/g1': {
            data: { componentPositions: [] },
          },
        },
      }
      await resourcesManager.initAddResource('/_/component_groups/g1', true, [])
      expect(resourcesManager.addResourceEvent.value?.closest.position).toBeUndefined()
    })

    test('leaves closest.position undefined when the target group resource is missing positions key', async () => {
      const { resourcesManager } = createResourcesManager({ includeAdmin: true })
      const store = (resourcesManager as any)._resourcesStore
      store.current = {
        byId: {
          '/_/component_groups/g1': {
            data: {},
          },
        },
      }
      await resourcesManager.initAddResource('/_/component_groups/g1', true, [])
      expect(resourcesManager.addResourceEvent.value?.closest.position).toBeUndefined()
    })
  })

  describe('addResourceAction position post data (lines 548, 550, 553)', () => {
    function setupAddingStoreWithPosition(resourcesManager: ResourcesManager, opts: {
      positionIri?: string
      positionData?: any
      addEventOverrides?: any
    } = {}) {
      const newResourceIri = '/_/new-resource'
      const newResourceData = {
        '@id': newResourceIri,
        '@type': 'Component',
        '_metadata': {
          persisted: true,
          adding: { endpoint: '/component', isPublishable: false, instantAdd: false },
        },
      } as any
      const store = (resourcesManager as any)._resourcesStore
      store.adding = { resource: newResourceIri, position: opts.positionIri }
      store.getResource = vi.fn().mockImplementation((iri: string) => {
        if (iri === newResourceIri) return { data: newResourceData }
        if (opts.positionIri && iri === opts.positionIri && opts.positionData !== undefined) {
          return { data: opts.positionData }
        }
        return undefined
      })
      resourcesManager.addResourceEvent.value = {
        targetIri: '/_/component_positions/p1',
        addAfter: true,
        closest: { position: '/_/component_positions/p1' },
        ...opts.addEventOverrides,
      } as any
      return { newResourceData, store }
    }

    test('throws when the position resource being added cannot be found (lines 548, 550)', async () => {
      const { resourcesManager } = createResourcesManager({ includeAdmin: true })
      setupAddingStoreWithPosition(resourcesManager, {
        positionIri: '/_/component_positions/new-pos',
        positionData: undefined,
        addEventOverrides: {
          targetIri: '/_/component_positions/p1',
          addAfter: true,
          closest: { position: '/_/component_positions/p1' },
        },
      })
      await expect(resourcesManager.addResourceAction()).rejects.toThrow('Position resource being added not found')
    })

    test('builds componentPositions post data stripping @id/@type/component/sortValue and anchoring it (#400)', async () => {
      const { resourcesManager, cwaFetch } = createResourcesManager({ includeAdmin: true })
      cwaFetch.fetch.mockResolvedValue({ '@id': '/component/1' })
      vi.spyOn(resourcesManager, 'storeResource').mockImplementation(() => {})
      const { newResourceData } = setupAddingStoreWithPosition(resourcesManager, {
        positionIri: '/_/component_positions/new-pos',
        positionData: {
          '@id': '/_/component_positions/new-pos',
          '@type': 'ComponentPosition',
          'component': '/component/existing',
          'sortValue': 2,
          'extra': 'keep-me',
        },
        addEventOverrides: {
          targetIri: '/_/component_positions/p1',
          addAfter: true,
          closest: { position: '/_/component_positions/p1' },
        },
      })
      await resourcesManager.addResourceAction()
      expect(newResourceData.componentPositions).toHaveLength(1)
      const positionPostData = newResourceData.componentPositions[0]
      expect(positionPostData['@id']).toBeUndefined()
      expect(positionPostData['@type']).toBeUndefined()
      expect(positionPostData.component).toBeUndefined()
      expect(positionPostData.extra).toBe('keep-me')
      expect(positionPostData).not.toHaveProperty('sortValue')
      expect(positionPostData.after).toBe('/_/component_positions/p1')
    })
  })

  describe('adding places the new position by anchor, never by sortValue (#400, api-components-bundle#475)', () => {
    const groupIri = '/_/component_groups/g1'
    const p1 = '/_/component_positions/p1'
    const p2 = '/_/component_positions/p2'
    const newPositionIri = '/_/component_positions/__new__'

    function setupInsert(addEvent: Record<string, any>, opts: { groupPositions?: string[], newResourceIsPosition?: boolean, createResponse?: any, orderResponse?: any } = {}) {
      const mockFetcher = { fetchBatch: vi.fn().mockResolvedValue(undefined) }
      const created = createResourcesManager({ includeAdmin: true, fetcher: mockFetcher })
      const { resourcesManager, cwaFetch } = created
      const stored: Record<string, any> = {
        [p1]: { '@id': p1, 'sortValue': 0, '_metadata': { persisted: true } },
        [p2]: { '@id': p2, 'sortValue': 1, '_metadata': { persisted: true } },
        [groupIri]: { '@id': groupIri, 'componentPositions': opts.groupPositions ?? [p1, p2, newPositionIri] },
      }
      const newResourceData: any = {
        '@id': '/_/new-resource',
        '@type': opts.newResourceIsPosition ? 'ComponentPosition' : 'Component',
        '_metadata': { persisted: true, adding: { endpoint: opts.newResourceIsPosition ? '/_/component_positions' : '/component', isPublishable: false, instantAdd: false } },
      }
      const store = (resourcesManager as any)._resourcesStore
      store.adding = { resource: '/_/new-resource', position: opts.newResourceIsPosition ? undefined : newPositionIri }
      stored[newPositionIri] = { '@id': newPositionIri, '@type': 'ComponentPosition', 'componentGroup': groupIri, 'sortValue': 1, '_metadata': { persisted: false } }
      store.getResource = vi.fn((iri: string) => iri === '/_/new-resource' ? { data: newResourceData } : (stored[iri] ? { data: stored[iri] } : undefined))
      store.saveResource = vi.fn(({ resource }: any) => {
        stored[resource['@id']] = resource
      })
      store.getOrderedPositionsForGroup = vi.fn((iri: string) => stored[iri]?.componentPositions.filter((position: string) => position !== newPositionIri))
      resourcesManager.addResourceEvent.value = { closest: { group: groupIri }, ...addEvent } as any
      cwaFetch.fetch.mockImplementation(async (path: string, options: any) => {
        if (options?.method === 'POST') {
          if (opts.createResponse instanceof Error) {
            throw opts.createResponse
          }
          return opts.createResponse ?? { '@id': '/component/1', 'componentPositions': ['/_/component_positions/n'] }
        }
        if (path === `${groupIri}/order`) {
          return opts.orderResponse ?? { componentGroup: groupIri, sortValues: { [p1]: 0, '/_/component_positions/n': 1, [p2]: 2 } }
        }
      })
      const updateSpy = vi.spyOn(resourcesManager, 'updateResource')
      return { ...created, mockFetcher, newResourceData, stored, updateSpy }
    }

    const postedPosition = (cwaFetch: any) => cwaFetch.fetch.mock.calls.find(([, options]: any) => options?.method === 'POST')![1].body.componentPositions[0]

    test.each([
      ['Add After a component', { targetIri: '/component/c1', addAfter: true, closest: { group: groupIri, position: p1 } }, { after: p1 }],
      ['Add Before a component', { targetIri: '/component/c1', addAfter: false, closest: { group: groupIri, position: p2 } }, { before: p2 }],
      ['Add to Start', { targetIri: groupIri, addAfter: false }, { before: p1 }],
      ['Add to End', { targetIri: groupIri, addAfter: true }, {}],
      ['Add After with no closest position', { targetIri: '/component/c1', addAfter: true, closest: { group: groupIri } }, {}],
    ])('%s sends the anchor and no sortValue, and PATCHes no other position', async (_label, addEvent, anchor) => {
      const { resourcesManager, cwaFetch, updateSpy } = setupInsert(addEvent)
      await resourcesManager.addResourceAction()
      const position = postedPosition(cwaFetch)
      expect(position).not.toHaveProperty('sortValue')
      expect({ after: position.after, before: position.before }).toEqual({ after: undefined, before: undefined, ...anchor })
      expect(updateSpy).not.toHaveBeenCalled()
    })

    test('Add to Start on a group holding only the new position sends no anchor', async () => {
      const { resourcesManager, cwaFetch } = setupInsert({ targetIri: groupIri, addAfter: false }, { groupPositions: [newPositionIri] })
      await resourcesManager.addResourceAction()
      const position = postedPosition(cwaFetch)
      expect(position.before).toBeUndefined()
      expect(position.after).toBeUndefined()
    })

    test('a new position added on its own carries the anchor at the top level and no sortValue', async () => {
      const { resourcesManager, cwaFetch, newResourceData } = setupInsert({ targetIri: '/component/c1', addAfter: true, closest: { group: groupIri, position: p1 } }, { newResourceIsPosition: true })
      await resourcesManager.addResourceAction()
      const body = cwaFetch.fetch.mock.calls.find(([, options]: any) => options?.method === 'POST')![1].body
      expect(body.after).toBe(p1)
      expect(body).not.toHaveProperty('sortValue')
      expect(newResourceData).not.toHaveProperty('sortValue')
    })

    test('after the POST one GET of the group\'s order stores every position\'s sortValue (case 2)', async () => {
      const { resourcesManager, cwaFetch, stored } = setupInsert(
        { targetIri: '/component/c1', addAfter: true, closest: { group: groupIri, position: p1 } },
        { orderResponse: { componentGroup: groupIri, sortValues: { [p1]: 0, '/_/component_positions/n': 1, [p2]: 2 } } },
      )
      await resourcesManager.addResourceAction()
      const orderCalls = cwaFetch.fetch.mock.calls.filter(([path]: any) => path === `${groupIri}/order`)
      expect(orderCalls).toHaveLength(1)
      expect(orderCalls[0]![1].method).toBe('GET')
      expect(stored[p1].sortValue).toBe(0)
      expect(stored[p2].sortValue).toBe(2)
      expect(stored[p2]._metadata).toEqual({ persisted: true })
    })

    test('a failed create, such as one rejected on its anchor, re-fetches the group and its order, keeping the error and the new component', async () => {
      const violation = Object.assign(new Error('422'), { statusCode: 422, data: { violations: [{ propertyPath: 'componentPositions[0].after', message: 'gone' }] } })
      const { resourcesManager, cwaFetch, mockFetcher, errorStoreActions } = setupInsert(
        { targetIri: '/component/c1', addAfter: true, closest: { group: groupIri, position: p1 } },
        { createResponse: violation },
      )
      const clearSpy = vi.spyOn(resourcesManager, 'clearAddResource')
      await resourcesManager.addResourceAction()
      expect(errorStoreActions.error).toHaveBeenCalled()
      expect(errorStoreActions.removeById).not.toHaveBeenCalled()
      expect(clearSpy).not.toHaveBeenCalled()
      expect(mockFetcher.fetchBatch).toHaveBeenCalledWith(expect.objectContaining({ paths: [groupIri] }))
      expect(cwaFetch.fetch.mock.calls.filter(([path]: any) => path === `${groupIri}/order`)).toHaveLength(1)
    })

    test('the insert is a write to its group, so it waits for an order request in flight', async () => {
      const { resourcesManager, cwaFetch } = setupInsert({ targetIri: groupIri, addAfter: true })
      let finishOrder!: () => void
      resourcesManager.queueComponentGroupWrite(groupIri, () => new Promise<void>((resolve) => {
        finishOrder = resolve
      }))
      const adding = resourcesManager.addResourceAction()
      await new Promise(resolve => setTimeout(resolve, 0))
      expect(cwaFetch.fetch).not.toHaveBeenCalled()
      finishOrder()
      await adding
      expect(cwaFetch.fetch.mock.calls.some(([, options]: any) => options?.method === 'POST')).toBe(true)
    })
  })

  describe('component group order requests (#400, api-components-bundle#475)', () => {
    const groupIri = '/_/component_groups/g1'
    const a = '/_/component_positions/a'
    const b = '/_/component_positions/b'
    const c = '/_/component_positions/c'

    function setupOrder() {
      const created = createResourcesManager()
      const stored: Record<string, any> = {
        [a]: { '@id': a, 'sortValue': 0, '_metadata': { sortDisplayNumber: 2 } },
        [b]: { '@id': b, 'sortValue': 10, '_metadata': { sortDisplayNumber: 1 } },
        [c]: { '@id': c, 'sortValue': 20, '_metadata': {} },
      }
      const store = (created.resourcesManager as any)._resourcesStore
      store.getResource = vi.fn((iri: string) => stored[iri] ? { data: stored[iri] } : undefined)
      store.saveResource = vi.fn(({ resource }: any) => {
        stored[resource['@id']] = resource
      })
      return { ...created, stored }
    }

    test('PUTs the listed order as JSON-LD and stores the returned sortValues, keeping display numbers (case 11)', async () => {
      const { resourcesManager, cwaFetch, stored } = setupOrder()
      cwaFetch.fetch.mockResolvedValue({ componentGroup: groupIri, sortValues: { [b]: 10, [a]: 11, [c]: 20 } })
      const result = await resourcesManager.orderComponentGroup(groupIri, [b, a, c])
      expect(result).toBe(true)
      expect(cwaFetch.fetch).toHaveBeenCalledWith(`${groupIri}/order`, {
        method: 'PUT',
        headers: { 'accept': 'application/ld+json,application/json', 'content-type': 'application/ld+json' },
        body: { componentPositions: [b, a, c] },
      })
      expect([stored[a].sortValue, stored[b].sortValue, stored[c].sortValue]).toEqual([11, 10, 20])
      expect(stored[a]._metadata.sortDisplayNumber).toBe(2)
    })

    test('a returned position the module does not hold is not stored', async () => {
      const { resourcesManager, cwaFetch, stored } = setupOrder()
      cwaFetch.fetch.mockResolvedValue({ componentGroup: groupIri, sortValues: { [a]: 0, '/_/component_positions/hidden': 5 } })
      await resourcesManager.orderComponentGroup(groupIri, [a])
      const store = (resourcesManager as any)._resourcesStore
      expect(store.saveResource).toHaveBeenCalledTimes(1)
      expect(Object.keys(stored)).toEqual([a, b, '/_/component_positions/c'])
    })

    test('a failed order request is reported as an error and returns false', async () => {
      const { resourcesManager, cwaFetch, errorStoreActions, stored } = setupOrder()
      const err = new Error('500')
      cwaFetch.fetch.mockRejectedValue(err)
      const result = await resourcesManager.orderComponentGroup(groupIri, [b, a, c])
      expect(result).toBe(false)
      expect(errorStoreActions.error).toHaveBeenCalledWith(expect.objectContaining({ endpoint: `${groupIri}/order` }), err)
      expect(stored[a].sortValue).toBe(0)
    })

    test('an order request counts as a request in progress', async () => {
      const { resourcesManager, cwaFetch } = setupOrder()
      let respond!: (value: any) => void
      cwaFetch.fetch.mockReturnValue(new Promise((resolve) => {
        respond = resolve
      }))
      const ordering = resourcesManager.orderComponentGroup(groupIri, [a])
      expect(resourcesManager.requestCount.value).toBe(1)
      respond({ componentGroup: groupIri, sortValues: {} })
      await ordering
      expect(resourcesManager.requestCount.value).toBe(0)
    })

    test('refreshing the order GETs it and stores the values; a failure stores nothing and does not throw', async () => {
      const { resourcesManager, cwaFetch, stored } = setupOrder()
      cwaFetch.fetch.mockResolvedValueOnce({ componentGroup: groupIri, sortValues: { [a]: 1, [b]: 2 } })
      await resourcesManager.refreshComponentGroupOrder(groupIri)
      expect(cwaFetch.fetch).toHaveBeenCalledWith(`${groupIri}/order`, expect.objectContaining({ method: 'GET' }))
      expect([stored[a].sortValue, stored[b].sortValue]).toEqual([1, 2])
      cwaFetch.fetch.mockRejectedValueOnce(new Error('500'))
      await expect(resourcesManager.refreshComponentGroupOrder(groupIri)).resolves.toBeUndefined()
      expect([stored[a].sortValue, stored[b].sortValue]).toEqual([1, 2])
    })

    test('writes to one group run one at a time, a failed write does not block the next, and other groups do not wait', async () => {
      const { resourcesManager } = setupOrder()
      const events: string[] = []
      let finishFirst!: () => void
      const first = resourcesManager.queueComponentGroupWrite(groupIri, () => new Promise<void>((resolve) => {
        finishFirst = () => {
          events.push('first')
          resolve()
        }
      }))
      const failing = resourcesManager.queueComponentGroupWrite(groupIri, async () => {
        events.push('failing')
        throw new Error('x')
      })
      const third = resourcesManager.queueComponentGroupWrite(groupIri, async () => {
        events.push('third')
      })
      const other = resourcesManager.queueComponentGroupWrite('/_/component_groups/other', async () => {
        events.push('other')
      })
      await other
      expect(events).toEqual(['other'])
      finishFirst()
      await first
      await expect(failing).rejects.toThrow('x')
      await third
      expect(events).toEqual(['other', 'first', 'failing', 'third'])
    })
  })

  describe('publishing a draft while the browser clock is ahead of the API (#373)', () => {
    const liveIri = '/component/html_contents/live'
    const draftIri = '/component/html_contents/draft'
    const positionIri = '/_/component_positions/p1'

    function setup() {
      setActivePinia(createPinia())
      const resourcesStoreDef = new ResourcesStore('cwa')
      const resources = new Resources(resourcesStoreDef, new FetcherStore('cwa'))
      const cwaFetch = { fetch: vi.fn() }
      const fetcher = { fetchBatch: vi.fn().mockResolvedValue(undefined) }
      const admin = {
        emptyStack: vi.fn(),
        resourceStackManager: { forcePublishedVersion: { value: undefined } },
      }
      const resourcesManager = new ResourcesManager(
        cwaFetch as never,
        resourcesStoreDef,
        { primaryFetchPath: undefined } as never,
        new ErrorStore('cwa'),
        fetcher as never,
        admin as never,
        resources,
      )
      const store = resourcesStoreDef.useStore()
      store.saveResource({ resource: { '@id': liveIri, '@type': 'HtmlContent', 'draftResource': draftIri, 'componentPositions': [positionIri], '_metadata': { persisted: true, publishable: { published: true } } } as never })
      store.saveResource({ resource: { '@id': draftIri, '@type': 'HtmlContent', 'publishedResource': liveIri, 'publishedAt': null, '_metadata': { persisted: true, publishable: { published: false } } } as never })
      store.saveResource({ resource: { '@id': positionIri, '@type': 'ComponentPosition', 'component': liveIri, '_metadata': { persisted: true } } as never })
      cwaFetch.fetch.mockResolvedValue({
        '@id': draftIri,
        '@type': 'HtmlContent',
        'publishedResource': liveIri,
        'publishedAt': new Date(Date.now() + 500).toISOString(),
        '_metadata': { persisted: true, publishable: { published: false } },
      })
      return { resourcesManager, resources, store, cwaFetch, admin }
    }

    test('keeps the draft the API saved as scheduled, so the live resource\'s draft is still stored', async () => {
      const { resourcesManager, resources, store, cwaFetch, admin } = setup()
      expect(resources.findDraftComponentIri(liveIri).value).toBe(draftIri)

      await resourcesManager.updateResource({ endpoint: draftIri, data: { publishedAt: new Date().toISOString() } })

      expect(cwaFetch.fetch).toHaveBeenCalledTimes(1)
      expect(store.current.byId[draftIri]?.data).toBeDefined()
      const draftOfLive = resources.findDraftComponentIri(liveIri).value
      expect(draftOfLive).toBe(draftIri)
      expect(store.current.byId[draftOfLive!]?.data).toBeDefined()
      expect(admin.emptyStack).not.toHaveBeenCalled()
    })
  })
})
