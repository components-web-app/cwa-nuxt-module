import { describe, expect, test, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import * as nuxt from '#app'
import { reactive, ref } from 'vue'
import ComponentGroup from './ComponentGroup.vue'
import { CwaResourceTypes } from '@cwa/nuxt-module/runtime/resources/resource-utils'
import { CwaAuthStatus } from '@cwa/nuxt-module/runtime/api/auth'
import { CwaResourceApiStatuses } from '@cwa/nuxt-module/runtime/storage/stores/resources/state'

function createWrapper ({ reference, location, resourcesByType, byId, cwaResources }: {
  reference: string;
  location: string;
  resourcesByType?: any;
  byId?: any;
  cwaResources?: any;
}) {
  const mockStore = reactive({
    resourcesByType: ref(resourcesByType || { [CwaResourceTypes.COMPONENT_GROUP]: [] }),
    current: ref({ byId: byId || {} })
  })
  // @ts-ignore
  vi.spyOn(nuxt, 'useNuxtApp').mockImplementationOnce(() => {
    return {
      $cwa: {
        auth: {
          status: CwaAuthStatus.SIGNED_OUT
        },
        resources: cwaResources || {
          isLoading: {
            value: false
          }
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
      location
    }
  })
}

describe('ComponentGroup', () => {
  describe('computed properties', () => {
    describe('fullReference', () => {
      test('should return nothing IF there is no resource matching location', () => {
        const mockReference = 'mockReference'
        const mockLocation = 'mockLocation'
        const wrapper = createWrapper({
          reference: mockReference,
          location: mockLocation
        })

        expect(wrapper.vm.fullReference).toBeUndefined()
      })

      test('should return fullReference BASED on location resource data', () => {
        const mockReference = 'mockReference'
        const mockResourceReference = 'mockResourceReference'
        const mockLocation = 'mockLocation'
        const mockById = {
          [mockLocation]: {
            data: {
              reference: mockResourceReference
            }
          }
        }
        const wrapper = createWrapper({
          reference: mockReference,
          location: mockLocation,
          byId: mockById
        })

        expect(wrapper.vm.fullReference).toEqual(`${mockReference}_${mockResourceReference}`)
      })
    })

    describe('resource', () => {
      test('should return resource from resources list BASED on type AND full reference', () => {
        const mockReference = 'mockReference'
        const mockResourceReference = 'mockResourceReference'
        const mockLocation = 'mockLocation'
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
          reference: mockReference,
          location: mockLocation,
          resourcesByType: mockByType,
          byId: mockById
        })

        expect(wrapper.vm.resource).toEqual(mockGroupElement)
      })
    })

    describe('showLoader', () => {
      test('should return false IF resources loading flag is false', () => {
        const mockReference = 'mockReference'
        const mockLocation = 'mockLocation'

        const wrapper = createWrapper({
          reference: mockReference,
          location: mockLocation,
          cwaResources: {
            isLoading: {
              value: false
            }
          }
        })

        expect(wrapper.vm.showLoader).toEqual(false)
      })

      test('should return true IF resources loading flag is true AND resource is not defined', () => {
        const mockReference = 'mockReference'
        const mockLocation = 'mockLocation'
        const mockByType = {
          [CwaResourceTypes.COMPONENT_GROUP]: []
        }

        const wrapper = createWrapper({
          reference: mockReference,
          location: mockLocation,
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
        const mockReference = 'mockReference'
        const mockLocation = 'mockLocation'
        const mockResourceReference = 'mockResourceReference'
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
          reference: mockReference,
          location: mockLocation,
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
        const mockReference = 'mockReference'
        const mockResourceReference = 'mockResourceReference'
        const mockLocation = 'mockLocation'
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
          reference: mockReference,
          location: mockLocation,
          resourcesByType: mockByType,
          byId: mockById
        })

        expect(wrapper.vm.componentPositions).toEqual(mockComponentPositions)
      })
    })
  })
})
