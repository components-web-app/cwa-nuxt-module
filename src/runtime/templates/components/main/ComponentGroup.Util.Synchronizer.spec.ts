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
    removeError: vi.fn(),
    errors: [] as any[],
  }
  const lookupState = { value: { apiState: { status: CwaResourceApiStatuses.ERROR, error: { statusCode: 404 } } } as any }
  const mockResources = {
    isLoading: ref(false),
    getResource: vi.fn((iri) => {
      if (iri.startsWith('/_/component_groups/')) {
        return lookupState
      }
      return {
        value: {
          data: {
            '@id': iri,
          },
        },
      }
    }),
  }
  const signedIn = ref(false)
  const roles = ref<string[]>(['ROLE_ADMIN'])
  const mockAuth = {
    signedIn,
    roles,
    isAdmin: computed(() => signedIn.value && roles.value.includes('ROLE_ADMIN')),
  }
  const mockFetchResource = vi.fn()
  const mockGetComponentMetadata = vi.fn()
  vi.mocked(ResourceUtils.getResourceTypeFromIri).mockReturnValue(CwaResourceTypes.COMPONENT)

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
    lookupState,
  }
}

function createSyncWatcher(groupSynchronizer: ComponentGroupUtilSynchronizer, ops?: { resource: any, allowedComponents?: null | string[], maxComponents?: null | number, location?: string, fullReference?: string }) {
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
    maxComponents: ops?.maxComponents,
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

  describe('a signed-in non-admin (#448)', () => {
    function signedInNonAdminWithMissingAndOutOfSyncGroups() {
      const context = createGroupSynchronizer()
      context.auth.roles.value = ['ROLE_USER']
      context.auth.signedIn.value = true
      createSyncWatcher(context.groupSynchronizer, { resource: null, location: '/component/missing-location' })
      createSyncWatcher(context.groupSynchronizer, {
        resource: {
          data: { '@id': '/_/component_groups/out-of-sync', 'allowedComponents': ['/component/a'] },
          apiState: { status: CwaResourceApiStatuses.SUCCESS },
        },
        maxComponents: 3,
      })
      return context
    }

    test('the synchroniser does not create or update a component group for a signed-in non-admin', async () => {
      const { resourcesManager, fetchResource } = signedInNonAdminWithMissingAndOutOfSyncGroups()

      await flushPromises()

      expect(resourcesManager.createResource).not.toHaveBeenCalled()
      expect(resourcesManager.updateResource).not.toHaveBeenCalled()
      expect(fetchResource).not.toHaveBeenCalled()
    })

    test('the synchroniser creates and updates the groups once the user becomes an admin', async () => {
      const { auth, resourcesManager } = signedInNonAdminWithMissingAndOutOfSyncGroups()
      await flushPromises()

      auth.roles.value = ['ROLE_USER', 'ROLE_ADMIN']
      await flushPromises()

      expect(resourcesManager.createResource).toHaveBeenCalledWith({
        endpoint: '/_/component_groups',
        data: {
          reference: 'mockReference',
          location: '/component/missing-location',
          allowedComponents: ['/component/a', '/component/b', '/component/c'],
          components: ['/component/missing-location'],
        },
      })
      expect(resourcesManager.updateResource).toHaveBeenCalledWith({
        endpoint: '/_/component_groups/out-of-sync',
        data: {
          allowedComponents: ['/component/a', '/component/b', '/component/c'],
          maxComponents: 3,
        },
      })
    })
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
        components: [syncWatcherOps.location],
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

  describe('a lookup by reference that did not answer "not found" (#399)', () => {
    const LAYOUT = '/_api/_/layouts/c7e086b5'
    const GROUP = '/_api/_/component_groups/49552a4f'
    const REFERENCE = `headerButton_${LAYOUT}`

    afterEach(() => {
      vi.mocked(ResourceUtils.getResourceTypeFromIri).mockReset()
    })

    function syncMissingLayoutGroup() {
      const context = createGroupSynchronizer()
      vi.mocked(ResourceUtils.getResourceTypeFromIri).mockReturnValue(CwaResourceTypes.LAYOUT)
      return {
        ...context,
        start() {
          createSyncWatcher(context.groupSynchronizer, {
            resource: null,
            allowedComponents: undefined,
            location: LAYOUT,
            fullReference: REFERENCE,
          })
          context.auth.signedIn.value = true
        },
      }
    }

    test('does not create a group when the lookup by reference was aborted, e.g. by Back during a navigation', async () => {
      const { resourcesManager, fetchResource, lookupState, start } = syncMissingLayoutGroup()
      fetchResource.mockResolvedValue(undefined)
      lookupState.value = { apiState: { status: CwaResourceApiStatuses.IN_PROGRESS } }
      start()

      await flushPromises()

      expect(fetchResource).toHaveBeenCalledWith({ path: `/_/component_groups/${REFERENCE}` })
      expect(resourcesManager.createResource).not.toHaveBeenCalled()
    })

    test('does not create a group when the lookup by reference failed with a server error', async () => {
      const { resourcesManager, fetchResource, lookupState, start } = syncMissingLayoutGroup()
      fetchResource.mockResolvedValue(undefined)
      lookupState.value = { apiState: { status: CwaResourceApiStatuses.ERROR, error: { statusCode: 500 } } }
      start()

      await flushPromises()

      expect(fetchResource).toHaveBeenCalled()
      expect(resourcesManager.createResource).not.toHaveBeenCalled()
    })

    test('creates the group after the lookup by reference 404s', async () => {
      const { resourcesManager, fetchResource, start } = syncMissingLayoutGroup()
      fetchResource.mockResolvedValue(undefined)
      start()

      await flushPromises()

      expect(resourcesManager.createResource).toHaveBeenCalledWith({
        endpoint: '/_/component_groups',
        data: {
          reference: REFERENCE,
          location: LAYOUT,
          allowedComponents: undefined,
          layouts: [LAYOUT],
        },
      })
    })

    test('a create rejected because the reference already exists attaches the existing group, and shows no error', async () => {
      const { resourcesManager, fetchResource, start } = syncMissingLayoutGroup()
      fetchResource
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ '@id': GROUP, 'reference': REFERENCE, 'layouts': [] })
      const duplicateError = {
        event: { endpoint: '/_/component_groups' },
        violations: [{ property: 'reference', message: 'There is already a ComponentGroup resource with that reference.' }],
        timestamp: 1760620000000,
      }
      resourcesManager.createResource.mockImplementation(async () => {
        resourcesManager.errors.push(duplicateError)
        return undefined
      })
      start()

      await flushPromises()

      expect(resourcesManager.removeError).toHaveBeenCalledWith(duplicateError.timestamp)
      expect(fetchResource).toHaveBeenCalledTimes(2)
      expect(resourcesManager.updateResource).toHaveBeenCalledWith({
        endpoint: GROUP,
        data: { layouts: [LAYOUT] },
      })
    })

    test('a create rejected for another reason keeps its error for the editor', async () => {
      const { resourcesManager, fetchResource, start } = syncMissingLayoutGroup()
      fetchResource.mockResolvedValue(undefined)
      resourcesManager.createResource.mockImplementation(async () => {
        resourcesManager.errors.push({
          event: { endpoint: '/_/component_groups' },
          violations: [{ property: 'allowedComponents', message: 'Not valid.' }],
          timestamp: 1760620000001,
        })
        return undefined
      })
      start()

      await flushPromises()

      expect(resourcesManager.removeError).not.toHaveBeenCalled()
      expect(fetchResource).toHaveBeenCalledTimes(1)
      expect(resourcesManager.updateResource).not.toHaveBeenCalled()
    })
  })

  describe('maxComponents (#398)', () => {
    function loadedGroup(data: Record<string, any> = {}) {
      return {
        data: {
          '@id': '/test',
          'allowedComponents': ['/component/a', '/component/b', '/component/c'],
          ...data,
        },
        apiState: { status: CwaResourceApiStatuses.SUCCESS },
      }
    }

    test('creates the group with maxComponents when the prop is set', async () => {
      const { auth, groupSynchronizer, resourcesManager } = createGroupSynchronizer()
      const syncWatcherOps = createSyncWatcher(groupSynchronizer, { resource: null, maxComponents: 1 })

      auth.signedIn.value = true
      await flushPromises()

      expect(resourcesManager.createResource).toHaveBeenCalledWith({
        endpoint: '/_/component_groups',
        data: {
          reference: syncWatcherOps.fullReference.value,
          location: syncWatcherOps.location,
          allowedComponents: syncWatcherOps.allowedComponents,
          maxComponents: 1,
          components: [syncWatcherOps.location],
        },
      })
    })

    test('PATCHes maxComponents when the group\'s value differs', async () => {
      const { auth, groupSynchronizer, resourcesManager } = createGroupSynchronizer()
      createSyncWatcher(groupSynchronizer, { resource: loadedGroup({ maxComponents: 3 }), maxComponents: 1 })

      auth.signedIn.value = true
      await flushPromises()

      expect(resourcesManager.updateResource).toHaveBeenCalledTimes(1)
      expect(resourcesManager.updateResource).toHaveBeenCalledWith({
        endpoint: '/test',
        data: { maxComponents: 1 },
      })
    })

    test('PATCHes a stored maxComponents to null when the prop is null', async () => {
      const { auth, groupSynchronizer, resourcesManager } = createGroupSynchronizer()
      createSyncWatcher(groupSynchronizer, { resource: loadedGroup({ maxComponents: 3 }), maxComponents: null })

      auth.signedIn.value = true
      await flushPromises()

      expect(resourcesManager.updateResource).toHaveBeenCalledWith({
        endpoint: '/test',
        data: { maxComponents: null },
      })
    })

    test.each([
      ['a matching value', { maxComponents: 2 }, 2],
      ['a missing key for a null prop', {}, null],
    ])('does not PATCH for %s', async (_label, stored, prop) => {
      const { auth, groupSynchronizer, resourcesManager } = createGroupSynchronizer()
      createSyncWatcher(groupSynchronizer, { resource: loadedGroup(stored), maxComponents: prop })

      auth.signedIn.value = true
      await flushPromises()

      expect(resourcesManager.updateResource).not.toHaveBeenCalled()
    })

    test('leaves maxComponents alone when the prop is omitted', async () => {
      const { auth, groupSynchronizer, resourcesManager } = createGroupSynchronizer()
      createSyncWatcher(groupSynchronizer, { resource: loadedGroup({ maxComponents: 3 }) })

      auth.signedIn.value = true
      await flushPromises()

      expect(resourcesManager.updateResource).not.toHaveBeenCalled()
    })

    test('sends one PATCH when allowedComponents and maxComponents both differ', async () => {
      const { auth, groupSynchronizer, resourcesManager } = createGroupSynchronizer()
      createSyncWatcher(groupSynchronizer, {
        resource: loadedGroup({ allowedComponents: ['/component/a'] }),
        allowedComponents: ['/component/b'],
        maxComponents: 1,
      })

      auth.signedIn.value = true
      await flushPromises()

      expect(resourcesManager.updateResource).toHaveBeenCalledTimes(1)
      expect(resourcesManager.updateResource).toHaveBeenCalledWith({
        endpoint: '/test',
        data: { allowedComponents: ['/component/b'], maxComponents: 1 },
      })
    })

    test.each([0, -1, 1.5])('warns and does not sync a maxComponents of %s, still syncing allowedComponents', async (invalid) => {
      const warn = vi.spyOn(consola, 'warn').mockImplementation(() => {})
      const { auth, groupSynchronizer, resourcesManager } = createGroupSynchronizer()
      createSyncWatcher(groupSynchronizer, {
        resource: loadedGroup({ allowedComponents: ['/component/a'], maxComponents: 3 }),
        allowedComponents: ['/component/b'],
        maxComponents: invalid,
      })

      auth.signedIn.value = true
      await flushPromises()

      expect(resourcesManager.updateResource).toHaveBeenCalledTimes(1)
      expect(resourcesManager.updateResource).toHaveBeenCalledWith({
        endpoint: '/test',
        data: { allowedComponents: ['/component/b'] },
      })
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(`maxComponents was not synced: ${invalid}`))
      warn.mockRestore()
    })

    test('creates the group without an invalid maxComponents', async () => {
      const warn = vi.spyOn(consola, 'warn').mockImplementation(() => {})
      const { auth, groupSynchronizer, resourcesManager } = createGroupSynchronizer()
      createSyncWatcher(groupSynchronizer, { resource: null, maxComponents: 0 })

      auth.signedIn.value = true
      await flushPromises()

      expect(resourcesManager.createResource).toHaveBeenCalledTimes(1)
      expect(resourcesManager.createResource.mock.calls[0]![0].data).not.toHaveProperty('maxComponents')
      expect(warn).toHaveBeenCalled()
      warn.mockRestore()
    })
  })

  describe('a page data location (#363)', () => {
    const PAGE_DATA = '/_api/page_data/blog_articles/9a1c'
    const REFERENCE = `primary_${PAGE_DATA}`

    afterEach(() => {
      vi.mocked(ResourceUtils.getResourceTypeFromIri).mockReset()
      vi.restoreAllMocks()
    })

    function syncPageDataLocation(existingGroup?: Record<string, any>) {
      const warn = vi.spyOn(consola, 'warn').mockImplementation(() => undefined)
      const context = createGroupSynchronizer()
      vi.mocked(ResourceUtils.getResourceTypeFromIri).mockReturnValue(CwaResourceTypes.PAGE_DATA)
      context.fetchResource.mockResolvedValue(existingGroup)
      createSyncWatcher(context.groupSynchronizer, {
        resource: null,
        allowedComponents: ['/component/a'],
        location: PAGE_DATA,
        fullReference: REFERENCE,
      })
      context.auth.signedIn.value = true
      return { ...context, warn }
    }

    test('creates no component group and warns, naming the reference and suggesting the page IRI', async () => {
      const { resourcesManager, warn } = syncPageDataLocation()

      await flushPromises()

      expect(resourcesManager.createResource).not.toHaveBeenCalled()
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.lastCall![0]).toContain(REFERENCE)
      expect(warn.mock.lastCall![0]).toContain('page data')
      expect(warn.mock.lastCall![0]).toContain('orphaned')
      expect(warn.mock.lastCall![0]).toContain('page IRI')
    })

    test('does not attach an existing group found by reference, so no relation is ever sent as undefined', async () => {
      const { resourcesManager, warn } = syncPageDataLocation({
        '@id': '/_api/_/component_groups/49552a4f',
        'reference': REFERENCE,
      })

      await flushPromises()

      expect(resourcesManager.updateResource).not.toHaveBeenCalled()
      expect(resourcesManager.createResource).not.toHaveBeenCalled()
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.lastCall![0]).toContain(REFERENCE)
    })

    test('still syncs allowedComponents on a group that is already loaded', async () => {
      const { resourcesManager, warn } = (() => {
        const warn = vi.spyOn(consola, 'warn').mockImplementation(() => undefined)
        const context = createGroupSynchronizer()
        vi.mocked(ResourceUtils.getResourceTypeFromIri).mockReturnValue(CwaResourceTypes.PAGE_DATA)
        createSyncWatcher(context.groupSynchronizer, {
          resource: {
            data: { '@id': '/test', 'allowedComponents': ['/component/b'] },
            apiState: { status: CwaResourceApiStatuses.SUCCESS },
          },
          allowedComponents: ['/component/a'],
          location: PAGE_DATA,
          fullReference: REFERENCE,
        })
        context.auth.signedIn.value = true
        return { ...context, warn }
      })()

      await flushPromises()

      expect(resourcesManager.updateResource).toHaveBeenCalledTimes(1)
      expect(resourcesManager.updateResource).toHaveBeenCalledWith({
        endpoint: '/test',
        data: { allowedComponents: ['/component/a'] },
      })
      expect(warn).not.toHaveBeenCalled()
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
