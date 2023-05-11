import { describe, expect, test, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import * as nuxt from '#app'
import { reactive, ref } from 'vue'
import ComponentGroup from './ComponentGroup.vue'
import { CwaResourceTypes } from '@cwa/nuxt-module/runtime/resources/resource-utils'
import { CwaAuthStatus } from '@cwa/nuxt-module/runtime/api/auth'

function createWrapper (reference: string, location: string, resourcesByType?: any, byId?: any) {
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
        resources: {
          isLoading: false
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
        const wrapper = createWrapper(mockReference, mockLocation)

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
        const wrapper = createWrapper(
          mockReference,
          mockLocation,
          undefined,
          mockById
        )

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
        const wrapper = createWrapper(
          mockReference,
          mockLocation,
          mockByType,
          mockById
        )

        expect(wrapper.vm.resource).toEqual(mockGroupElement)
      })
    })
  })
})
