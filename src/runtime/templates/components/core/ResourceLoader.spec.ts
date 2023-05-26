// @vitest-environment nuxt
import { describe, expect, test, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import * as nuxt from '#app'
import { ref } from 'vue'
import ResourceLoader from './ResourceLoader.vue'
import { CwaAuthStatus } from '#cwa/runtime/api/auth'
import { CwaResourceApiStatuses } from '#cwa/runtime/storage/stores/resources/state'
import * as cwa from '#cwa/runtime/composables/cwaComponent'

const mockPrefix = 'TestComponent'
const mockIri = 'testIri'

function createWrapper (resource: any, status?: CwaAuthStatus, component?: any) {
  // @ts-ignore
  vi.spyOn(nuxt, 'useNuxtApp').mockImplementationOnce(() => ({
    $cwa: {
      auth: {
        status: {
          value: status ?? CwaAuthStatus.SIGNED_IN
        }
      },
      fetchResource: vi.fn()
    }
  }))
  // @ts-ignore
  vi.spyOn(cwa, 'useCwaResource').mockImplementationOnce(() => ref(resource))

  return shallowMount(ResourceLoader, {
    props: {
      iri: mockIri,
      componentPrefix: mockPrefix,
      uiComponent: component
    },
    global: {
      renderStubDefaultSlot: true
    }
  })
}

describe('ResourceLoader', () => {
  describe('computed properties', () => {
    describe('isLoading', () => {
      test('should return true IF there is no resource data AND api status EQUALS in progress', () => {
        const wrapper = createWrapper({
          data: null,
          apiState: {
            status: CwaResourceApiStatuses.IN_PROGRESS
          }
        })

        expect(wrapper.vm.isLoading).toEqual(true)
      })

      test('should return false IF api status DOES NOT EQUAL to in progress', () => {
        const wrapper = createWrapper({
          data: null,
          apiState: {
            status: CwaResourceApiStatuses.SUCCESS
          }
        })

        expect(wrapper.vm.isLoading).toEqual(false)
      })

      test('should return false IF resource data is present', () => {
        const wrapper = createWrapper({
          data: { test: true },
          apiState: {
            status: CwaResourceApiStatuses.IN_PROGRESS
          }
        })

        expect(wrapper.vm.isLoading).toEqual(false)
      })
    })

    describe('resourceUiComponent', () => {
      test('should return nothing IF no resource is present', () => {
        const wrapper = createWrapper({ data: null, apiState: {} })

        expect(wrapper.vm.resourceUiComponent).not.toBeDefined()
      })

      test('should return nothing IF resource data is empty', () => {
        const wrapper = createWrapper({
          data: null,
          apiState: {
            status: CwaResourceApiStatuses.SUCCESS
          }
        })

        expect(wrapper.vm.resourceUiComponent).not.toBeDefined()
      })

      test('should return component name consisting of prefix and name from resource property', () => {
        const mockComponentName = 'Test'
        const wrapper = createWrapper({
          data: {
            uiComponent: mockComponentName
          },
          apiState: {
            status: CwaResourceApiStatuses.SUCCESS
          }
        })

        expect(wrapper.vm.resourceUiComponent).toEqual(mockPrefix + mockComponentName)
      })

      test('should return component name consisting of prefix and type from resource property', () => {
        const mockType = 'MType'
        const wrapper = createWrapper({
          data: {
            '@type': mockType
          },
          apiState: {
            status: CwaResourceApiStatuses.SUCCESS
          }
        })

        expect(wrapper.vm.resourceUiComponent).toEqual(mockPrefix + mockType)
      })
    })

    describe('hasError', () => {
      test('should return true IF api status EQUALS to error', () => {
        const wrapper = createWrapper({
          apiState: {
            status: CwaResourceApiStatuses.ERROR,
            error: {}
          }
        })

        expect(wrapper.vm.hasError).toEqual(true)
      })

      test('should return false IF api status DOES NOT EQUAL to error', () => {
        const wrapper = createWrapper({
          apiState: {
            status: CwaResourceApiStatuses.SUCCESS,
            error: {}
          }
        })

        expect(wrapper.vm.hasError).toEqual(false)
      })
    })

    describe('hasSilentError', () => {
      test('should return false IF hasError property is false', () => {
        const wrapper = createWrapper({
          apiState: {
            status: CwaResourceApiStatuses.SUCCESS,
            error: {}
          }
        })

        expect(wrapper.vm.hasSilentError).toEqual(false)
      })

      test('should return false IF hasError property is true AND error status code is greater than 500', () => {
        const wrapper = createWrapper({
          apiState: {
            status: CwaResourceApiStatuses.ERROR,
            error: {
              statusCode: 501
            }
          }
        })

        expect(wrapper.vm.hasSilentError).toEqual(false)
      })

      test('should return false IF hasError property is true AND error status code is less than 400', () => {
        const wrapper = createWrapper({
          apiState: {
            status: CwaResourceApiStatuses.ERROR,
            error: {
              statusCode: 399
            }
          }
        })

        expect(wrapper.vm.hasSilentError).toEqual(false)
      })

      test('should return true IF hasError property is true AND error status code is within range of [400:500)', () => {
        const wrapper = createWrapper({
          apiState: {
            status: CwaResourceApiStatuses.ERROR,
            error: {
              statusCode: 401
            }
          }
        })

        expect(wrapper.vm.hasSilentError).toEqual(true)
      })
    })

    describe('resolvedComponent', () => {
      test('should return value from props IF it is defined', () => {
        const mockUiComponent = { name: 'MockComponent', template: '<div>I am mock</div>' }
        const wrapper = createWrapper({
          data: null,
          apiState: {
            status: CwaResourceApiStatuses.SUCCESS
          }
        }, CwaAuthStatus.SIGNED_IN, mockUiComponent)

        expect(wrapper.vm.resolvedComponent).toEqual(mockUiComponent)
      })
    })
  })

  describe('watch', () => {
    test('should NOT fetch resource IF resource data IS NOT empty, silent error occurred, user is signed in', () => {
      const wrapper = createWrapper({
        data: { test: true },
        apiState: {
          status: CwaResourceApiStatuses.ERROR,
          error: {
            statusCode: 401
          }
        }
      })

      expect(wrapper.vm.$cwa.fetchResource).not.toHaveBeenCalled()
    })

    test('should NOT fetch resource IF resource data is empty, silent error DID NOT occur, user is signed in', () => {
      const wrapper = createWrapper({
        apiState: {
          status: CwaResourceApiStatuses.ERROR,
          error: {
            statusCode: 399
          }
        }
      })

      expect(wrapper.vm.$cwa.fetchResource).not.toHaveBeenCalled()
    })

    test('should NOT fetch resource IF resource data is empty, silent error occurred, user is signed out', () => {
      const wrapper = createWrapper({
        apiState: {
          status: CwaResourceApiStatuses.ERROR,
          error: {
            statusCode: 401
          }
        }
      }, CwaAuthStatus.SIGNED_OUT)

      expect(wrapper.vm.$cwa.fetchResource).not.toHaveBeenCalled()
    })

    test('should fetch resource IF resource data is empty, silent error occurred, resource was fetched during SSR', () => {
      const wrapper = createWrapper({
        apiState: {
          status: CwaResourceApiStatuses.ERROR,
          error: {
            statusCode: 401
          },
          ssr: true
        }
      })

      expect(wrapper.vm.$cwa.fetchResource).toHaveBeenCalledWith({ path: mockIri })
    })
  })

  describe('snapshots', () => {
    test('should match snapshot IF resource is loading', () => {
      const wrapper = createWrapper({ data: null, apiState: { status: CwaResourceApiStatuses.IN_PROGRESS } })

      expect(wrapper.element).toMatchSnapshot()
    })

    test('should match snapshot IF resource is not found', () => {
      const wrapper = createWrapper({
        data: null,
        apiState: {
          status: CwaResourceApiStatuses.SUCCESS
        }
      })

      expect(wrapper.element).toMatchSnapshot()
    })

    test('should match snapshot IF component is not found', () => {
      const wrapper = createWrapper({
        data: {
          uiComponent: 'Mock'
        },
        apiState: {
          status: CwaResourceApiStatuses.ERROR,
          error: {}
        }
      })

      expect(wrapper.element).toMatchSnapshot()
    })

    test('should match snapshot IF component is rendered', async () => {
      const wrapper = createWrapper({
        data: {
          uiComponent: 'DummyComponent'
        },
        apiState: {
          status: CwaResourceApiStatuses.SUCCESS
        }
      })

      await wrapper.setProps({
        uiComponent: {
          name: 'DummyComponent',
          template: '<div> test </div>',
          props: ['iri']
        }
      })

      expect(wrapper.element).toMatchSnapshot()
    })
  })
})
