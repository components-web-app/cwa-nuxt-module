import { describe, expect, test, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { ComponentGroupUtilSynchronizer } from '#cwa/runtime/templates/components/main/ComponentGroup.Util.Synchronizer'
import { CwaResourceApiStatuses } from '#cwa/runtime/storage/stores/resources/state'

function createGroupSynchronizer () {
  const mockResourcesManager = {
    createResource: vi.fn(),
    updateResource: vi.fn()
  }
  const mockResources = {
    isLoading: ref(false)
  }
  const mockAuth = {
    signedIn: ref(false)
  }
  // @ts-ignore
  const groupSynchronizer = new ComponentGroupUtilSynchronizer()

  return {
    groupSynchronizer,
    resources: mockResources,
    resourcesManager: mockResourcesManager,
    auth: mockAuth
  }
}

describe('Group synchronizer', () => {
  test('should NOT create OR update resource IF loading is in progress', async () => {
    const { resources, groupSynchronizer, resourcesManager } = createGroupSynchronizer()

    const mockResource = computed(() => { return { data: {} } })
    const mockLocation = 'mockLocation'
    const mockReference = computed(() => 'mockReference')
    const mockComponents = ['a', 'b', 'c']

    // @ts-ignore
    groupSynchronizer.createSyncWatcher(mockResource, mockLocation, mockReference, mockComponents)

    resources.isLoading.value = true

    await nextTick()

    expect(resourcesManager.createResource).not.toHaveBeenCalled()
    expect(resourcesManager.updateResource).not.toHaveBeenCalled()
  })

  test('should NOT create OR update resource IF loading is in progress, but user is not signed in', async () => {
    const { auth, resources, groupSynchronizer, resourcesManager } = createGroupSynchronizer()

    const mockResource = computed(() => { return { data: {} } })
    const mockLocation = 'mockLocation'
    const mockReference = computed(() => 'mockReference')
    const mockComponents = ['a', 'b', 'c']

    // @ts-ignore
    groupSynchronizer.createSyncWatcher(mockResource, mockLocation, mockReference, mockComponents)

    resources.isLoading.value = false
    auth.signedIn.value = false

    await nextTick()

    expect(resourcesManager.createResource).not.toHaveBeenCalled()
    expect(resourcesManager.updateResource).not.toHaveBeenCalled()
  })

  test('should create resource IF loading is not in progress, user is signed in, resource does not exist', async () => {
    const { auth, resources, groupSynchronizer, resourcesManager } = createGroupSynchronizer()

    const mockResource = computed(() => { return null })
    const mockLocation = 'mockLocation'
    const mockReference = computed(() => 'mockReference')
    const mockComponents = ['a', 'b', 'c']

    // @ts-ignore
    groupSynchronizer.createSyncWatcher(mockResource, mockLocation, mockReference, mockComponents)

    resources.isLoading.value = false
    auth.signedIn.value = true

    await nextTick()

    expect(resourcesManager.createResource).toHaveBeenCalledWith({
      endpoint: '/_/component_groups',
      data: {
        reference: mockReference.value,
        location: mockLocation,
        allowedComponents: mockComponents
      }
    })
  })

  test('should create resource with additional location info IF loading is not in progress, user is signed in, resource does not exist', async () => {
    const { auth, resources, groupSynchronizer, resourcesManager } = createGroupSynchronizer()

    const mockResource = computed(() => { return null })
    const mockLocation = '/_/pages/'
    const mockReference = computed(() => 'mockReference')
    const mockComponents = ['a', 'b', 'c']

    // @ts-ignore
    groupSynchronizer.createSyncWatcher(mockResource, mockLocation, mockReference, mockComponents)

    resources.isLoading.value = false
    auth.signedIn.value = true

    await nextTick()

    expect(resourcesManager.createResource).toHaveBeenCalledWith({
      endpoint: '/_/component_groups',
      data: {
        reference: mockReference.value,
        location: mockLocation,
        allowedComponents: mockComponents,
        pages: [mockLocation]
      }
    })
  })

  test('should update resource IF loading is not in progress, user is signed in, resource exists, but not all allowed components are present', async () => {
    const { auth, resources, groupSynchronizer, resourcesManager } = createGroupSynchronizer()
    const mockId = '/test'
    const mockResource = computed(() => {
      return {
        data: {
          '@id': mockId,
          allowedComponents: ['a']
        },
        apiState: {
          status: CwaResourceApiStatuses.SUCCESS
        }
      }
    })
    const mockLocation = 'mockLocation'
    const mockReference = computed(() => 'mockReference')
    const mockComponents = ['a', 'b', 'c']

    // @ts-ignore
    groupSynchronizer.createSyncWatcher(mockResource, mockLocation, mockReference, mockComponents)

    resources.isLoading.value = false
    auth.signedIn.value = true

    await nextTick()

    expect(resourcesManager.updateResource).toHaveBeenCalledWith({
      endpoint: mockId,
      data: {
        allowedComponents: mockComponents
      }
    })
  })

  test('should NOT update resource IF loading is not in progress, user is signed in, resource exists, but all allowed components are present', async () => {
    const { auth, resources, groupSynchronizer, resourcesManager } = createGroupSynchronizer()
    const mockId = '/test'
    const mockResource = computed(() => {
      return {
        data: {
          '@id': mockId,
          allowedComponents: ['a', 'b', 'c']
        },
        apiState: {
          status: CwaResourceApiStatuses.SUCCESS
        }
      }
    })
    const mockLocation = 'mockLocation'
    const mockReference = computed(() => 'mockReference')
    const mockComponents = ['a', 'b', 'c']

    // @ts-ignore
    groupSynchronizer.createSyncWatcher(mockResource, mockLocation, mockReference, mockComponents)

    resources.isLoading.value = false
    auth.signedIn.value = true

    await nextTick()

    expect(resourcesManager.updateResource).not.toHaveBeenCalled()
  })
})
