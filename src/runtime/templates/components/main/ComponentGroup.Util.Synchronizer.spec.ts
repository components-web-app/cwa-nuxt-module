import { beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import * as vue from 'vue'
import { CwaResourceApiStatuses } from '../../../storage/stores/resources/state'
import * as ResourceUtils from '../../../resources/resource-utils'
import * as cwaComposables from '../../../composables/cwa'
import { CwaResourceTypes } from '../../../resources/resource-utils'
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

  vi.spyOn(cwaComposables, 'useCwa').mockImplementation(() => {
    return {
      auth: mockAuth,
      resources: mockResources,
      resourcesManager: mockResourcesManager,
      fetchResource: vi.fn(),
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
  }
}

function createSyncWatcher(groupSynchronizer: ComponentGroupUtilSynchronizer, ops?: { resource: any, allowedComponents: null | string[] }) {
  const mockResource = computed(() => {
    return (ops?.resource !== undefined ? ops.resource : { data: {} })
  })
  const mockLocation = 'mockLocation'
  const mockReference = computed(() => 'mockReference')

  const syncWatcherOps = {
    resource: mockResource,
    location: mockLocation,
    fullReference: mockReference,
    allowedComponents: ops?.allowedComponents !== undefined ? ops.allowedComponents : ['a', 'b', 'c'],
  }
  groupSynchronizer.createSyncWatcher(syncWatcherOps)
  return syncWatcherOps
}

describe('Group synchronizer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should NOT create OR update resource IF loading is in progress', async () => {
    const { resources, groupSynchronizer, resourcesManager } = createGroupSynchronizer()

    createSyncWatcher(groupSynchronizer)

    resources.isLoading.value = true

    await nextTick()

    expect(resourcesManager.createResource).not.toHaveBeenCalled()
    expect(resourcesManager.updateResource).not.toHaveBeenCalled()
  })

  test('should NOT create OR update resource IF loading is in progress, but user is not signed in', async () => {
    const { auth, resources, groupSynchronizer, resourcesManager } = createGroupSynchronizer()

    createSyncWatcher(groupSynchronizer)

    resources.isLoading.value = false
    auth.signedIn.value = false

    await nextTick()

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

    await nextTick()

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

    await nextTick()

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
          'allowedComponents': ['a'],
        },
        apiState: {
          status: CwaResourceApiStatuses.SUCCESS,
        },
      },
    })

    resources.isLoading.value = false
    auth.signedIn.value = true

    await nextTick()

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
          'allowedComponents': ['a', 'b', 'c'],
        },
        apiState: {
          status: CwaResourceApiStatuses.SUCCESS,
        },
      },
    })

    resources.isLoading.value = false
    auth.signedIn.value = true

    await nextTick()

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

    await nextTick()

    expect(resourcesManager.updateResource).not.toHaveBeenCalled()
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
        await nextTick()

        // prop was '/component/nav' but PATCH must send '/_api/component/nav' to match stored format
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
        await nextTick()

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
        await nextTick()

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
        await nextTick()

        const call = resourcesManager.createResource.mock.calls[0][0]
        expect(call.data.allowedComponents).toEqual(['/_api/component/nav'])
      }
      finally {
        ResourceUtils.ResourceTypeFromIri.setPathPrefix(undefined)
      }
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
