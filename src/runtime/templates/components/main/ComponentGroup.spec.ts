import { describe, expect, test, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import * as nuxt from '#app'
import { reactive, ref } from 'vue'
import ComponentGroup from './ComponentGroup.vue'
import { CwaResourceTypes } from '@cwa/nuxt-module/runtime/resources/resource-utils'
import { CwaAuthStatus } from '@cwa/nuxt-module/runtime/api/auth'
import { CwaResourceApiStatuses } from '@cwa/nuxt-module/runtime/storage/stores/resources/state'

const mockReference = 'mockReference'
const mockResourceReference = 'mockResourceReference'
const mockLocation = 'mockLocation'
const mockResourcesByType = { [CwaResourceTypes.COMPONENT_GROUP]: [] }
const mockCwaResources = {
  isLoading: {
    value: false
  }
}

function createWrapper ({
  reference = mockReference,
  location = mockLocation,
  resourcesByType = mockResourcesByType,
  byId = {},
  cwaResources = mockCwaResources,
  allowedComponents = []
}: {
  location?: string;
  resourcesByType?: any;
  reference?: string;
  byId?: any;
  cwaResources?: any;
  allowedComponents?: string[];
} = {}) {
  const mockStore = reactive({
    resourcesByType: ref(resourcesByType),
    current: ref({ byId })
  })
  // @ts-ignore
  vi.spyOn(nuxt, 'useNuxtApp').mockImplementationOnce(() => {
    return {
      $cwa: {
        auth: {
          status: CwaAuthStatus.SIGNED_OUT
        },
        resources: cwaResources,
        resourcesManager: {
          createResource: vi.fn(),
          updateResource: vi.fn()
        },
        storage: {
          stores: {
            resources: {
              useStore () {
                return mockStore
              }
            }
          }
        }
      }
    }
  })

  return shallowMount(ComponentGroup, {
    props: {
      reference,
      location,
      allowedComponents
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
  })

  describe('methods', () => {
    describe('createComponentGroup', () => {
      test('should call resource manager method with correct params', async () => {
        const mockLocation = '/_/pages/mock-page'
        const mockById = {
          [mockLocation]: {
            data: {
              reference: mockResourceReference
            }
          }
        }
        const mockAllowedComponents = ['comp1', 'comp2']

        const wrapper = createWrapper({
          location: mockLocation,
          byId: mockById,
          allowedComponents: mockAllowedComponents
        })

        await wrapper.vm.createComponentGroup()

        expect(wrapper.vm.$cwa.resourcesManager.createResource).toHaveBeenCalledWith({
          data: {
            reference: wrapper.vm.fullReference,
            location: '/_/pages/mock-page',
            allowedComponents: mockAllowedComponents,
            pages: ['/_/pages/mock-page']
          },
          endpoint: '/_/component_groups'
        })
      })

      test('should call resource manager method with correct params without location option IF no such location type is available', async () => {
        const mockLocation = '/_/routes/mock-route'
        const mockById = {
          [mockLocation]: {
            data: {
              reference: mockResourceReference
            }
          }
        }
        const mockAllowedComponents = ['comp1', 'comp2']

        const wrapper = createWrapper({
          location: mockLocation,
          byId: mockById
        })

        await wrapper.setProps({ allowedComponents: mockAllowedComponents })

        await wrapper.vm.createComponentGroup()

        expect(wrapper.vm.$cwa.resourcesManager.createResource).toHaveBeenCalledWith({
          data: {
            reference: wrapper.vm.fullReference,
            location: mockLocation,
            allowedComponents: mockAllowedComponents
          },
          endpoint: '/_/component_groups'
        })
      })
    })

    describe('updateAllowedComponents', () => {
      test('should NOT perform update operation IF allowed components from props and resource are equal', async () => {
        const mockGroupElement = {
          data: {
            reference: `${mockReference}_${mockResourceReference}`,
            allowedComponents: ['comp1']
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
          allowedComponents: ['comp1']
        })

        await wrapper.vm.updateAllowedComponents()

        expect(wrapper.vm.$cwa.resourcesManager.updateResource).not.toHaveBeenCalled()
      })

      test('should perform update operation IF allowed components from props and resource are NOT equal', async () => {
        const mockId = '/_/test'
        const mockGroupElement = {
          data: {
            reference: `${mockReference}_${mockResourceReference}`,
            allowedComponents: ['comp1'],
            '@id': mockId
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
          allowedComponents: ['comp2']
        })

        await wrapper.vm.updateAllowedComponents()

        expect(wrapper.vm.$cwa.resourcesManager.updateResource).toHaveBeenCalledWith({
          endpoint: mockId,
          data: {
            allowedComponents: wrapper.props().allowedComponents
          }
        })
      })
    })
  })
})
