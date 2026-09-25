import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, ref } from 'vue'
import * as vue from 'vue'
import { CwaResourceApiStatuses } from '../../../storage/stores/resources/state'
import * as ResourceUtils from '../../../resources/resource-utils'
import * as cwaComposables from '../../../composables/cwa'
import { CwaResourceTypes } from '../../../resources/resource-utils'
import { consola } from 'consola'
import { flushPromises } from '@vue/test-utils'
import { ComponentGroupUtilSynchronizer } from './ComponentGroup.Util.Synchronizer'

vi.mock('../../../resources/resource-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../resources/resource-utils')>()
  return {
    ...actual,
    getResourceTypeFromIri: vi.fn(),
  }
})

vi.mock('vue', async () => {
  const mod = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...mod,
    watch: vi.fn((...args) => {
      const unwatch = mod.watch(...args)
      return vi.fn(() => unwatch())
    }),
  }
})

function createGroupSynchronizer() {
  const mockResourcesManager = {
    createResource: vi.fn(),
    updateResource: vi.fn(),
  }
  const mockResources = {
    isLoading: ref(false),
    getResource: vi.fn((iri) => {
      return {
        value: {
          data: {
            '@id': iri,
          },
        },
      }
    }),
  }
  const mockAuth = {
    signedIn: ref(false),
  }
  const mockFetchResource = vi.fn()
  const mockGetComponentMetadata = vi.fn()

  vi.spyOn(cwaComposables, 'useCwa').mockImplementation(() => {
    return {
      auth: mockAuth,
      resources: mockResources,
      resourcesManager: mockResourcesManager,
      fetchResource: mockFetchResource,
      getComponentMetadata: mockGetComponentMetadata,
      addUniquePromise: vi.fn((scope: string, key: string, fn: () => Promise<void>) => {
        return fn()
      }),
    }
  })

  // @ts-expect-error
  const groupSynchronizer = new ComponentGroupUtilSynchronizer()

  return {
    groupSynchronizer,
    resources: mockResources,
    resourcesManager: mockResourcesManager,
    auth: mockAuth,
    fetchResource: mockFetchResource,
    getComponentMetadata: mockGetComponentMetadata,
  }
}

function createSyncWatcher(groupSynchronizer: ComponentGroupUtilSynchronizer, ops?: { resource: any, allowedComponents?: null | string[], location?: string, fullReference?: string }) {
  const mockResource = computed(() => {
    return (ops?.resource !== undefined ? ops.resource : { data: {} })
  })
  const mockLocation = ops?.location ?? 'mockLocation'
  const mockReference = computed(() => ops?.fullReference ?? 'mockReference')

  const syncWatcherOps = {
    resource: mockResource,
    location: mockLocation,
    fullReference: mockReference,
    allowedComponents: ops && 'allowedComponents' in ops ? ops.allowedComponents : ['/component/a', '/component/b', '/component/c'],
  }
  groupSynchronizer.createSyncWatcher(syncWatcherOps)
  return syncWatcherOps
}

describe('Group synchronizer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should NOT create OR update resource IF user is not signed in, whatever the loading state', async () => {
    const { resources, groupSynchronizer, resourcesManager } = createGroupSynchronizer()

    createSyncWatcher(groupSynchronizer)

    resources.isLoading.value = true

    await flushPromises()

    expect(resourcesManager.createResource).not.toHaveBeenCalled()
    expect(resourcesManager.updateResource).not.toHaveBeenCalled()
  })

  test('should NOT create OR update resource IF loading is in progress, but user is not signed in', async () => {
    const { auth, resources, groupSynchronizer, resourcesManager } = createGroupSynchronizer()

    createSyncWatcher(groupSynchronizer)

    resources.isLoading.value = false
    auth.signedIn.value = false

    await flushPromises()

    expect(resourcesManager.createResource).not.toHaveBeenCalled()
    expect(resourcesManager.updateResource).not.toHaveBeenCalled()
  })

  test('should create resource with additional location info IF loading is not in progress, user is signed in, resource does not exist', async () => {
    const { auth, groupSynchronizer, resourcesManager } = createGroupSynchronizer()
    auth.signedIn.value = false

    vi.spyOn(ResourceUtils, 'getResourceTypeFromIri').mockImplementationOnce(() => CwaResourceTypes.PAGE)

    const syncWatcherOps = createSyncWatcher(groupSynchronizer, {
      resource: null,
    })

    auth.signedIn.value = true

    await flushPromises()

    expect(resourcesManager.createResource).toHaveBeenCalledWith({
      endpoint: '/_/component_groups',
      data: {
        reference: syncWatcherOps.fullReference.value,
        location: syncWatcherOps.location,
        allowedComponents: syncWatcherOps.allowedComponents,
        pages: [syncWatcherOps.location],
      },
    })
  })

  test('should create resource IF loading is not in progress, user is signed in, resource does not exist', async () => {
    const { auth, resources, groupSynchronizer, resourcesManager } = createGroupSynchronizer()

    const syncWatcherOps = createSyncWatcher(groupSynchronizer, {
      resource: null,
    })

    resources.isLoading.value = false
    auth.signedIn.value = true

    await flushPromises()

    expect(resourcesManager.createResource).toHaveBeenCalledWith({
      endpoint: '/_/component_groups',
      data: {
        reference: syncWatcherOps.fullReference.value,
        location: syncWatcherOps.location,
        allowedComponents: syncWatcherOps.allowedComponents,
      },
    })
  })

  test('should update resource IF loading is not in progress, user is signed in, resource exists, but not all allowed components are present', async () => {
    const { auth, resources, groupSynchronizer, resourcesManager } = createGroupSynchronizer()
    const mockId = '/test'
    const syncWatcherOps = createSyncWatcher(groupSynchronizer, {
      resource: {
        data: {
          '@id': mockId,
          'allowedComponents': ['/component/a'],
        },
        apiState: {
          status: CwaResourceApiStatuses.SUCCESS,
        },
      },
    })

    resources.isLoading.value = false
    auth.signedIn.value = true

    await flushPromises()

    expect(resourcesManager.updateResource).toHaveBeenCalledWith({
      endpoint: mockId,
      data: {
        allowedComponents: syncWatcherOps.allowedComponents,
      },
    })
  })

  test('should NOT update resource IF loading is not in progress, user is signed in, resource exists, but all allowed components are present', async () => {
    const { auth, resources, groupSynchronizer, resourcesManager } = createGroupSynchronizer()
    const mockId = '/test'
    createSyncWatcher(groupSynchronizer, {
      resource: {
        data: {
          '@id': mockId,
          'allowedComponents': ['/component/a', '/component/b', '/component/c'],
        },
        apiState: {
          status: CwaResourceApiStatuses.SUCCESS,
        },
      },
    })

    resources.isLoading.value = false
    auth.signedIn.value = true

    await flushPromises()

    expect(resourcesManager.updateResource).not.toHaveBeenCalled()
  })

  test('should NOT update resource IF allowed components are null', async () => {
    const { auth, resources, groupSynchronizer, resourcesManager } = createGroupSynchronizer()
    const mockId = '/test'
    createSyncWatcher(groupSynchronizer, {
      resource: {
        data: {
          '@id': mockId,
        },
        apiState: {
          status: CwaResourceApiStatuses.SUCCESS,
        },
      },
      allowedComponents: null,
    })

    resources.isLoading.value = false
    auth.signedIn.value = true

    await flushPromises()

    expect(resourcesManager.updateResource).not.toHaveBeenCalled()
  })

  describe('a group the API returns with no allowedComponents key (#351)', () => {
    function groupWithNoStoredList() {
      return {
        data: {
          '@id': '/test',
        },
        apiState: { status: CwaResourceApiStatuses.SUCCESS },
      }
    }

    test('is given the template list', async () => {
      const { auth, groupSynchronizer, resourcesManager } = createGroupSynchronizer()
      createSyncWatcher(groupSynchronizer, {
        resource: groupWithNoStoredList(),
        allowedComponents: ['/component/a', '/component/b', '/component/c'],
      })

      auth.signedIn.value = true
      await flushPromises()

      expect(resourcesManager.updateResource).toHaveBeenCalledTimes(1)
      expect(resourcesManager.updateResource).toHaveBeenCalledWith({
        endpoint: '/test',
        data: { allowedComponents: ['/component/a', '/component/b', '/component/c'] },
      })
    })

    test('is left alone when the prop is omitted', async () => {
      const { auth, groupSynchronizer, resourcesManager } = createGroupSynchronizer()
      createSyncWatcher(groupSynchronizer, {
        resource: groupWithNoStoredList(),
        allowedComponents: undefined,
      })

      auth.signedIn.value = true
      await flushPromises()

      expect(resourcesManager.updateResource).not.toHaveBeenCalled()
    })

    test('is left alone when the prop is an empty list, which the API stores as null', async () => {
      const { auth, groupSynchronizer, resourcesManager } = createGroupSynchronizer()
      createSyncWatcher(groupSynchronizer, {
        resource: groupWithNoStoredList(),
        allowedComponents: [],
      })

      auth.signedIn.value = true
      await flushPromises()

      expect(resourcesManager.updateResource).not.toHaveBeenCalled()
    })
  })

  describe('component names in allowedComponents (#352)', () => {
    const metadata = {
      HtmlContent: { resourceName: 'HtmlContent', endpoint: '/component/html_contents', isPublishable: true, explicitAllowOnly: false },
      WatchPastConference: { resourceName: 'WatchPastConference', endpoint: '/component/watch_past_conferences', isPublishable: false, explicitAllowOnly: true },
    }

    beforeEach(() => {
      ResourceUtils.ResourceTypeFromIri.setPathPrefix('/_api')
    })

    afterEach(() => {
      ResourceUtils.ResourceTypeFromIri.setPathPrefix(undefined)
    })

    function existingGroup(allowedComponents?: string[]) {
      return {
        data: {
          '@id': '/test',
          ...(allowedComponents ? { allowedComponents } : {}),
        },
        apiState: { status: CwaResourceApiStatuses.SUCCESS },
      }
    }

    test('are resolved to prefixed endpoints before PATCHing', async () => {
      const { auth, groupSynchronizer, resourcesManager, getComponentMetadata } = createGroupSynchronizer()
      getComponentMetadata.mockResolvedValue(metadata)
      createSyncWatcher(groupSynchronizer, {
        resource: existingGroup(),
        allowedComponents: ['HtmlContent', 'WatchPastConference'],
      })

      auth.signedIn.value = true
      await vi.waitFor(() => expect(resourcesManager.updateResource).toHaveBeenCalled())

      expect(resourcesManager.updateResource).toHaveBeenCalledWith({
        endpoint: '/test',
        data: { allowedComponents: ['/_api/component/html_contents', '/_api/component/watch_past_conferences'] },
      })
    })

    test('are compared as endpoints, so a matching stored list is not PATCHed', async () => {
      const { auth, groupSynchronizer, resourcesManager, getComponentMetadata } = createGroupSynchronizer()
      getComponentMetadata.mockResolvedValue(metadata)
      createSyncWatcher(groupSynchronizer, {
        resource: existingGroup(['/_api/component/html_contents']),
        allowedComponents: ['HtmlContent'],
      })

      auth.signedIn.value = true
      await vi.waitFor(() => expect(getComponentMetadata).toHaveBeenCalled())
      await flushPromises()

      expect(resourcesManager.updateResource).not.toHaveBeenCalled()
    })

    test('can be mixed with collection IRIs', async () => {
      const { auth, groupSynchronizer, resourcesManager, getComponentMetadata } = createGroupSynchronizer()
      getComponentMetadata.mockResolvedValue(metadata)
      createSyncWatcher(groupSynchronizer, {
        resource: existingGroup(),
        allowedComponents: ['HtmlContent', '/component/navigation_links'],
      })

      auth.signedIn.value = true
      await vi.waitFor(() => expect(resourcesManager.updateResource).toHaveBeenCalled())

      expect(resourcesManager.updateResource).toHaveBeenCalledWith({
        endpoint: '/test',
        data: { allowedComponents: ['/_api/component/html_contents', '/_api/component/navigation_links'] },
      })
    })

    test('are resolved when creating a new component group', async () => {
      const { auth, groupSynchronizer, resourcesManager, getComponentMetadata } = createGroupSynchronizer()
      getComponentMetadata.mockResolvedValue(metadata)
      createSyncWatcher(groupSynchronizer, {
        resource: null,
        allowedComponents: ['WatchPastConference'],
      })

      auth.signedIn.value = true
      await vi.waitFor(() => expect(resourcesManager.createResource).toHaveBeenCalled())

      expect(resourcesManager.createResource.mock.lastCall[0].data.allowedComponents).toEqual(['/_api/component/watch_past_conferences'])
    })

    test('a name the API does not know warns and syncs nothing', async () => {
      const warn = vi.spyOn(consola, 'warn').mockImplementation(() => undefined)
      const { auth, groupSynchronizer, resourcesManager, getComponentMetadata } = createGroupSynchronizer()
      getComponentMetadata.mockResolvedValue(metadata)
      createSyncWatcher(groupSynchronizer, {
        resource: existingGroup(['/_api/component/html_contents']),
        allowedComponents: ['HtmlContent', 'NotAnApiComponent'],
      })

      auth.signedIn.value = true
      await vi.waitFor(() => expect(warn).toHaveBeenCalled())
      await flushPromises()

      expect(warn.mock.lastCall![0]).toContain('NotAnApiComponent')
      expect(resourcesManager.updateResource).not.toHaveBeenCalled()
      warn.mockRestore()
    })

    test.each([
      ['an existing group', () => existingGroup(['/_api/component/html_contents'])],
      ['a missing group', () => null],
    ])('an undefined or non-string entry warns and syncs nothing for %s', async (_, resource) => {
      const warn = vi.spyOn(consola, 'warn').mockImplementation(() => undefined)
      const { auth, groupSynchronizer, resourcesManager, getComponentMetadata } = createGroupSynchronizer()
      getComponentMetadata.mockResolvedValue(metadata)
      createSyncWatcher(groupSynchronizer, {
        resource: resource(),
        allowedComponents: ['HtmlContent', undefined, 42] as unknown as string[],
      })

      auth.signedIn.value = true
      await vi.waitFor(() => expect(warn).toHaveBeenCalled())
      await flushPromises()

      expect(warn.mock.lastCall![0]).toContain('undefined, 42')
      expect(warn.mock.lastCall![0]).toContain('not a component name')
      expect(resourcesManager.updateResource).not.toHaveBeenCalled()
      expect(resourcesManager.createResource).not.toHaveBeenCalled()
      warn.mockRestore()
    })

    test('nothing is synced when the API docs could not be loaded', async () => {
      const { auth, groupSynchronizer, resourcesManager, getComponentMetadata } = createGroupSynchronizer()
      getComponentMetadata.mockResolvedValue(undefined)
      createSyncWatcher(groupSynchronizer, {
        resource: null,
        allowedComponents: ['HtmlContent'],
      })

      auth.signedIn.value = true
      await vi.waitFor(() => expect(getComponentMetadata).toHaveBeenCalled())
      await flushPromises()

      expect(resourcesManager.createResource).not.toHaveBeenCalled()
      expect(resourcesManager.updateResource).not.toHaveBeenCalled()
    })

    test('a list of IRIs only never requests the API docs', async () => {
      const { auth, groupSynchronizer, resourcesManager, getComponentMetadata } = createGroupSynchronizer()
      createSyncWatcher(groupSynchronizer, {
        resource: existingGroup(),
        allowedComponents: ['/component/navigation_links'],
      })

      auth.signedIn.value = true
      await vi.waitFor(() => expect(resourcesManager.updateResource).toHaveBeenCalled())

      expect(getComponentMetadata).not.toHaveBeenCalled()
    })
  })

  describe('an omitted allowedComponents prop', () => {
    test('leaves a fixture-set list untouched: no PATCH and the stored list survives', async () => {
      ResourceUtils.ResourceTypeFromIri.setPathPrefix('/_api')
      try {
        const { auth, groupSynchronizer, resourcesManager } = createGroupSynchronizer()
        const resource = {
          data: {
            '@id': '/test',
            'allowedComponents': ['/_api/component/navigation_links'],
          },
          apiState: { status: CwaResourceApiStatuses.SUCCESS },
        }
        createSyncWatcher(groupSynchronizer, {
          resource,
          allowedComponents: undefined,
        })

        auth.signedIn.value = true
        await flushPromises()

        expect(resourcesManager.updateResource).not.toHaveBeenCalled()
        expect(resource.data.allowedComponents).toEqual(['/_api/component/navigation_links'])
      }
      finally {
        ResourceUtils.ResourceTypeFromIri.setPathPrefix(undefined)
      }
    })

    test('an explicit null still clears a stored list', async () => {
      const { auth, groupSynchronizer, resourcesManager } = createGroupSynchronizer()
      createSyncWatcher(groupSynchronizer, {
        resource: {
          data: {
            '@id': '/test',
            'allowedComponents': ['/component/navigation_links'],
          },
          apiState: { status: CwaResourceApiStatuses.SUCCESS },
        },
        allowedComponents: null,
      })

      auth.signedIn.value = true
      await flushPromises()

      expect(resourcesManager.updateResource).toHaveBeenCalledTimes(1)
      expect(resourcesManager.updateResource).toHaveBeenCalledWith({
        endpoint: '/test',
        data: { allowedComponents: null },
      })
    })
  })

  describe('allowedComponents path prefix normalisation', () => {
    test('prepends the API path prefix to prop values before PATCHing when stored values have the prefix', async () => {
      ResourceUtils.ResourceTypeFromIri.setPathPrefix('/_api')
      try {
        const { auth, groupSynchronizer, resourcesManager } = createGroupSynchronizer()
        const mockId = '/test'
        createSyncWatcher(groupSynchronizer, {
          resource: {
            data: {
              '@id': mockId,
              'allowedComponents': ['/_api/component/nav'],
            },
            apiState: { status: CwaResourceApiStatuses.SUCCESS },
          },
          allowedComponents: ['/component/nav'],
        })

        auth.signedIn.value = true
        await flushPromises()

        expect(resourcesManager.updateResource).not.toHaveBeenCalled()
      }
      finally {
        ResourceUtils.ResourceTypeFromIri.setPathPrefix(undefined)
      }
    })

    test('does not double-prefix values that already include the path prefix', async () => {
      ResourceUtils.ResourceTypeFromIri.setPathPrefix('/_api')
      try {
        const { auth, groupSynchronizer, resourcesManager } = createGroupSynchronizer()
        const mockId = '/test'
        createSyncWatcher(groupSynchronizer, {
          resource: {
            data: {
              '@id': mockId,
              'allowedComponents': ['/_api/component/nav'],
            },
            apiState: { status: CwaResourceApiStatuses.SUCCESS },
          },
          allowedComponents: ['/_api/component/nav'],
        })

        auth.signedIn.value = true
        await flushPromises()

        expect(resourcesManager.updateResource).not.toHaveBeenCalled()
      }
      finally {
        ResourceUtils.ResourceTypeFromIri.setPathPrefix(undefined)
      }
    })

    test('sends prefixed allowedComponents in PATCH when values differ', async () => {
      ResourceUtils.ResourceTypeFromIri.setPathPrefix('/_api')
      try {
        const { auth, groupSynchronizer, resourcesManager } = createGroupSynchronizer()
        const mockId = '/test'
        createSyncWatcher(groupSynchronizer, {
          resource: {
            data: {
              '@id': mockId,
              'allowedComponents': ['/_api/component/nav', '/_api/component/buttons'],
            },
            apiState: { status: CwaResourceApiStatuses.SUCCESS },
          },
          allowedComponents: ['/component/nav'],
        })

        auth.signedIn.value = true
        await flushPromises()

        expect(resourcesManager.updateResource).toHaveBeenCalledWith({
          endpoint: mockId,
          data: { allowedComponents: ['/_api/component/nav'] },
        })
      }
      finally {
        ResourceUtils.ResourceTypeFromIri.setPathPrefix(undefined)
      }
    })

    test('prefixes allowedComponents when creating a new component group', async () => {
      ResourceUtils.ResourceTypeFromIri.setPathPrefix('/_api')
      try {
        const { auth, groupSynchronizer, resourcesManager } = createGroupSynchronizer()

        createSyncWatcher(groupSynchronizer, {
          resource: null,
          allowedComponents: ['/component/nav'],
        })

        auth.signedIn.value = true
        await flushPromises()

        const call = resourcesManager.createResource.mock.calls[0][0]
        expect(call.data.allowedComponents).toEqual(['/_api/component/nav'])
      }
      finally {
        ResourceUtils.ResourceTypeFromIri.setPathPrefix(undefined)
      }
    })
  })

  describe('a group found by reference', () => {
    const LAYOUT = '/_api/_/layouts/c7e086b5'
    const PAGE = '/_api/_/pages/3d594703'
    const GROUP = '/_api/_/component_groups/49552a4f'

    afterEach(() => {
      vi.mocked(ResourceUtils.getResourceTypeFromIri).mockReset()
    })

    function findGroupByReference(locationType: CwaResourceTypes, location: string, fullReference: string, groupData: Record<string, any>) {
      const context = createGroupSynchronizer()
      vi.mocked(ResourceUtils.getResourceTypeFromIri).mockReturnValue(locationType)
      context.fetchResource.mockResolvedValue({
        '@id': GROUP,
        'reference': fullReference,
        ...groupData,
      })
      createSyncWatcher(context.groupSynchronizer, {
        resource: null,
        allowedComponents: undefined,
        location,
        fullReference,
      })
      context.auth.signedIn.value = true
      return context
    }

    test('does not update a layout group that already lists the layout', async () => {
      const { resourcesManager } = findGroupByReference(CwaResourceTypes.LAYOUT, LAYOUT, `top_${LAYOUT}`, { layouts: [LAYOUT] })

      await flushPromises()

      expect(resourcesManager.updateResource).not.toHaveBeenCalled()
    })

    test('does not update a page group that already lists the page', async () => {
      const { resourcesManager } = findGroupByReference(CwaResourceTypes.PAGE, PAGE, `primary_${PAGE}`, { pages: [PAGE] })

      await flushPromises()

      expect(resourcesManager.updateResource).not.toHaveBeenCalled()
    })

    test('does not update a group that lists the location as an embedded resource', async () => {
      const { resourcesManager } = findGroupByReference(CwaResourceTypes.LAYOUT, LAYOUT, `top_${LAYOUT}`, {
        layouts: [{ '@id': LAYOUT, '@type': 'Layout' }],
      })

      await flushPromises()

      expect(resourcesManager.updateResource).not.toHaveBeenCalled()
    })

    test('stores the group it found without updating it', async () => {
      const { resourcesManager, fetchResource } = findGroupByReference(CwaResourceTypes.LAYOUT, LAYOUT, `top_${LAYOUT}`, { layouts: [LAYOUT] })

      await flushPromises()

      expect(fetchResource).toHaveBeenCalledWith({ path: `/_/component_groups/top_${LAYOUT}` })
      expect(resourcesManager.updateResource).not.toHaveBeenCalled()
    })

    test('adds the location to a group listing another location', async () => {
      const { resourcesManager } = findGroupByReference(CwaResourceTypes.LAYOUT, LAYOUT, `top_${LAYOUT}`, {
        layouts: ['/_api/_/layouts/other'],
      })

      await flushPromises()

      expect(resourcesManager.updateResource).toHaveBeenCalledWith({
        endpoint: GROUP,
        data: { layouts: ['/_api/_/layouts/other', LAYOUT] },
      })
    })

    test('adds the location as an iri when the other locations are embedded resources', async () => {
      const { resourcesManager } = findGroupByReference(CwaResourceTypes.LAYOUT, LAYOUT, `top_${LAYOUT}`, {
        layouts: [{ '@id': '/_api/_/layouts/other', '@type': 'Layout' }],
      })

      await flushPromises()

      expect(resourcesManager.updateResource).toHaveBeenCalledWith({
        endpoint: GROUP,
        data: { layouts: ['/_api/_/layouts/other', LAYOUT] },
      })
    })

    test('adds the location to a group listing no locations', async () => {
      const { resourcesManager } = findGroupByReference(CwaResourceTypes.LAYOUT, LAYOUT, `top_${LAYOUT}`, {})

      await flushPromises()

      expect(resourcesManager.updateResource).toHaveBeenCalledWith({
        endpoint: GROUP,
        data: { layouts: [LAYOUT] },
      })
    })
  })

  test('should stop sync watcher', () => {
    const { groupSynchronizer } = createGroupSynchronizer()
    createSyncWatcher(groupSynchronizer)

    groupSynchronizer.stopSyncWatcher()

    const unwatchSpy = vue.watch.mock.results[0].value
    expect(unwatchSpy).toHaveBeenCalled()
  })
})
