// @vitest-environment nuxt
import { describe, expect, test, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { reactive, ref } from 'vue'
import * as composables from '../../../composables/cwaComponent'
import ComponentPosition from '../core/ComponentPosition.vue'
import ComponentGroup from './ComponentGroup.vue'
import * as nuxt from '#app'
import { CwaResourceTypes } from '#cwa/runtime/resources/resource-utils'
import { CwaResourceApiStatuses } from '#cwa/runtime/storage/stores/resources/state'
import { ComponentGroupUtilSynchronizer } from '#cwa/runtime/templates/components/main/ComponentGroup.Util.Synchronizer'

vi.mock('./ComponentGroup.Util.Synchronizer', () => {
  return {
    ComponentGroupUtilSynchronizer: vi.fn(() => {
      return {
        createSyncWatcher: vi.fn()
      }
    })
  }
})

const mockReference = 'mockReference'
const mockResourceReference = 'mockResourceReference'
const mockLocation = 'mockLocation'
const mockResourcesByType = { [CwaResourceTypes.COMPONENT_GROUP]: [] }
const mockCwaResources = {
  isLoading: {
    value: false
  }
}
const mockAuth = {
  signedIn: ref(false)
}

function createWrapper ({
  reference = mockReference,
  location = mockLocation,
  resourcesByType = mockResourcesByType,
  byId = {},
  cwaResources = mockCwaResources,
  allowedComponents = [],
  auth = mockAuth
}: {
  location?: string;
  resourcesByType?: any;
  reference?: string;
  byId?: any;
  cwaResources?: any;
  allowedComponents?: string[];
  auth?: any;
} = {}) {
  const mockStore = reactive({
    resourcesByType: ref(resourcesByType),
    current: ref({ byId })
  })
  // @ts-ignore
  vi.spyOn(composables, 'useCwaResourceUtils').mockImplementationOnce(() => {
    return {
      getResourceStore: mockStore
    }
  })
  // @ts-ignore
  vi.spyOn(nuxt, 'useNuxtApp').mockImplementationOnce(() => {
    return {
      $cwa: {
        auth,
        resources: cwaResources,
        resourcesManager: {
          createResource: vi.fn(),
          updateResource: vi.fn()
        }
      }
    }
  })

  return shallowMount(ComponentGroup, {
    props: {
      reference,
      location,
      allowedComponents
    },
    global: {
      renderStubDefaultSlot: true
    }
  })
}

describe('ComponentGroup', () => {
  describe('computed properties', () => {
    describe('fullReference', () => {
      test('should return nothing IF there is no resource matching location', () => {
        const wrapper = createWrapper()

        expect(wrapper.vm.fullReference).toBeUndefined()
      })

      test('should return fullReference BASED on location resource data', () => {
        const mockById = {
          [mockLocation]: {
            data: {
              reference: mockResourceReference
            }
          }
        }
        const wrapper = createWrapper({
          byId: mockById
        })

        expect(wrapper.vm.fullReference).toEqual(`${mockReference}_${mockResourceReference}`)
      })
    })

    describe('resource', () => {
      test('should return resource from resources list BASED on type AND full reference', () => {
        const mockGroupElement = { data: { reference: `${mockReference}_${mockResourceReference}` } }
        const mockByType = {
          [CwaResourceTypes.COMPONENT_GROUP]: [mockGroupElement]
        }
        const mockById = {
          [mockLocation]: {
            data: {
              reference: mockResourceReference
            }
          }
        }
        const wrapper = createWrapper({
          resourcesByType: mockByType,
          byId: mockById
        })

        expect(wrapper.vm.resource).toEqual(mockGroupElement)
      })
    })

    describe('showLoader', () => {
      test('should return false IF resources loading flag is false', () => {
        const wrapper = createWrapper({
          cwaResources: {
            isLoading: {
              value: false
            }
          }
        })

        expect(wrapper.vm.showLoader).toEqual(false)
      })

      test('should return true IF resources loading flag is true AND resource is not defined', () => {
        const mockByType = {
          [CwaResourceTypes.COMPONENT_GROUP]: []
        }

        const wrapper = createWrapper({
          resourcesByType: mockByType,
          cwaResources: {
            isLoading: {
              value: true
            }
          }
        })

        expect(wrapper.vm.showLoader).toEqual(true)
      })

      test('should return true IF resources loading flag is true AND resource is in loading state', () => {
        const mockGroupElement = {
          data: {
            reference: `${mockReference}_${mockResourceReference}`
          },
          apiState: {
            status: CwaResourceApiStatuses.IN_PROGRESS
          }
        }
        const mockByType = {
          [CwaResourceTypes.COMPONENT_GROUP]: [mockGroupElement]
        }

        const wrapper = createWrapper({
          resourcesByType: mockByType,
          cwaResources: {
            isLoading: {
              value: true
            }
          }
        })

        expect(wrapper.vm.showLoader).toEqual(true)
      })
    })

    describe('componentPositions', () => {
      test('should return resource component positions BASED on its data', () => {
        const mockComponentPositions = ['pos1', 'pos2', 'pos3']
        const mockGroupElement = {
          data: {
            reference: `${mockReference}_${mockResourceReference}`,
            componentPositions: mockComponentPositions
          }
        }
        const mockByType = {
          [CwaResourceTypes.COMPONENT_GROUP]: [mockGroupElement]
        }
        const mockById = {
          [mockLocation]: {
            data: {
              reference: mockResourceReference
            }
          }
        }
        const wrapper = createWrapper({
          resourcesByType: mockByType,
          byId: mockById
        })

        expect(wrapper.vm.componentPositions).toEqual(mockComponentPositions)
      })
    })

    describe('areNoPositions', () => {
      test('should return true IF user is signed in AND resource is defined', () => {
        const mockGroupElement = {
          data: { reference: `${mockReference}_${mockResourceReference}` },
          apiState: {
            status: CwaResourceApiStatuses.IN_PROGRESS
          }
        }
        const mockByType = {
          [CwaResourceTypes.COMPONENT_GROUP]: [mockGroupElement]
        }
        const mockById = {
          [mockLocation]: {
            data: {
              reference: mockResourceReference
            }
          }
        }
        const wrapper = createWrapper({
          resourcesByType: mockByType,
          byId: mockById,
          auth: {
            signedIn: ref(true)
          }
        })

        expect(wrapper.vm.areNoPositions).toEqual(true)
      })

      test('should return false IF user is signed out AND resource is defined', () => {
        const mockGroupElement = {
          data: { reference: `${mockReference}_${mockResourceReference}` },
          apiState: {
            status: CwaResourceApiStatuses.IN_PROGRESS
          }
        }
        const mockByType = {
          [CwaResourceTypes.COMPONENT_GROUP]: [mockGroupElement]
        }
        const mockById = {
          [mockLocation]: {
            data: {
              reference: mockResourceReference
            }
          }
        }
        const wrapper = createWrapper({
          resourcesByType: mockByType,
          byId: mockById,
          auth: {
            signedIn: ref(false)
          }
        })

        expect(wrapper.vm.areNoPositions).toEqual(false)
      })

      test('should return false IF user is signed in AND resource is not defined', () => {
        const mockGroupElement = {
          data: { reference: 'another-reference' },
          apiState: {
            status: CwaResourceApiStatuses.IN_PROGRESS
          }
        }
        const mockByType = {
          [CwaResourceTypes.COMPONENT_GROUP]: [mockGroupElement]
        }
        const mockById = {
          [mockLocation]: {
            data: {
              reference: mockResourceReference
            }
          }
        }
        const wrapper = createWrapper({
          resourcesByType: mockByType,
          byId: mockById,
          auth: {
            signedIn: ref(true)
          }
        })

        expect(wrapper.vm.areNoPositions).toEqual(false)
      })
    })
  })

  describe('sync group', () => {
    test('should synchronize group on mount AND unsync on component unmount', () => {
      const mockGroupElement = { data: { reference: `${mockReference}_${mockResourceReference}` } }
      const mockByType = {
        [CwaResourceTypes.COMPONENT_GROUP]: [mockGroupElement]
      }
      const mockById = {
        [mockLocation]: {
          data: {
            reference: mockResourceReference
          }
        }
      }

      const watchSpy = vi.fn()
      const unwatchSpy = vi.fn()

      // @ts-ignore
      ComponentGroupUtilSynchronizer.mockReturnValueOnce({ createSyncWatcher: watchSpy, stopSyncWatcher: unwatchSpy })

      const wrapper = createWrapper({
        resourcesByType: mockByType,
        byId: mockById
      })

      expect(watchSpy.mock.calls[0][0].value).toEqual(wrapper.vm.resource)
      expect(watchSpy.mock.calls[0][1]).toEqual(wrapper.props().location)
      expect(watchSpy.mock.calls[0][2].value).toEqual(wrapper.vm.fullReference)
      expect(watchSpy.mock.calls[0][3]).toEqual(wrapper.props().allowedComponents)

      wrapper.unmount()

      expect(unwatchSpy).toHaveBeenCalled()
    })
  })

  describe('props', () => {
    test('should pass correct uiComponent objects per each ResourceLoader component', () => {
      const mockComponentPositions = ['pos1', 'pos2', 'pos3']
      const mockGroupElement = {
        data: {
          reference: `${mockReference}_${mockResourceReference}`,
          componentPositions: mockComponentPositions
        }
      }
      const mockByType = {
        [CwaResourceTypes.COMPONENT_GROUP]: [mockGroupElement]
      }
      const mockById = {
        [mockLocation]: {
          data: {
            reference: mockResourceReference
          }
        }
      }
      const wrapper = createWrapper({
        resourcesByType: mockByType,
        byId: mockById
      })

      const resourceLoaders = wrapper.findAllComponents({ name: 'ResourceLoader' })

      expect(resourceLoaders.length).toEqual(mockComponentPositions.length)

      resourceLoaders.forEach((resourceLoader, index) => {
        const { iri, uiComponent } = resourceLoader.props()

        expect(iri).toEqual(mockComponentPositions[index])
        expect(uiComponent).toEqual(ComponentPosition)
      })
    })
  })

  describe('snapshots', () => {
    test('should match snapshot IF loader is shown', () => {
      const wrapper = createWrapper({
        cwaResources: {
          isLoading: ref(true)
        }
      })

      expect(wrapper.element).toMatchSnapshot()
    })

    test('should match snapshot IF resource is not found', () => {
      const wrapper = createWrapper()

      expect(wrapper.element).toMatchSnapshot()
    })

    test('should match snapshot IF there are component positions defined', () => {
      const mockComponentPositions = ['pos1', 'pos2', 'pos3']
      const mockGroupElement = {
        data: {
          reference: `${mockReference}_${mockResourceReference}`,
          componentPositions: mockComponentPositions
        }
      }
      const mockByType = {
        [CwaResourceTypes.COMPONENT_GROUP]: [mockGroupElement]
      }
      const mockById = {
        [mockLocation]: {
          data: {
            reference: mockResourceReference
          }
        }
      }
      const wrapper = createWrapper({
        resourcesByType: mockByType,
        byId: mockById
      })

      expect(wrapper.element).toMatchSnapshot()
    })

    test('should match snapshot IF there are no component positions defined', () => {
      const wrapper = createWrapper()

      expect(wrapper.element).toMatchSnapshot()
    })

    test('should match snapshot IF user is logged in but there are no positions', () => {
      const mockGroupElement = {
        data: { reference: `${mockReference}_${mockResourceReference}` },
        apiState: {
          status: CwaResourceApiStatuses.IN_PROGRESS
        }
      }
      const mockByType = {
        [CwaResourceTypes.COMPONENT_GROUP]: [mockGroupElement]
      }
      const mockById = {
        [mockLocation]: {
          data: {
            reference: mockResourceReference
          }
        }
      }
      const wrapper = createWrapper({
        resourcesByType: mockByType,
        byId: mockById,
        auth: {
          signedIn: ref(true)
        }
      })

      expect(wrapper.element).toMatchSnapshot()
    })
  })
})
