// @vitest-environment nuxt
// todo: SOMETHING in this test file intermittently causes hanging in CI testing, async does not complete? All tests pass though...
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import * as vue from 'vue'
import ResourceLoader from './ResourceLoader.vue'
import { CwaAuthStatus } from '#cwa/runtime/api/auth'
import { CwaResourceApiStatuses } from '#cwa/runtime/storage/stores/resources/state'
import * as cwaComposables from '#cwa/runtime/composables/cwa'

const mockPrefix = 'TestComponent'
const mockIri = 'testIri'

vi.mock('vue', async () => {
  const mod = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...mod,
    watch: vi.fn(() => {})
  }
})

function createWrapper (resource?: any, status?: CwaAuthStatus, component?: any) {
  // @ts-ignore
  vi.spyOn(cwaComposables, 'useCwa').mockImplementationOnce(() => ({
    auth: {
      status: {
        value: status ?? CwaAuthStatus.SIGNED_IN
      }
    },
    fetchResource: vi.fn(),
    resources: {
      getResource: vi.fn(() => ref(resource))
    }
  }))

  return mount(ResourceLoader, {
    shallow: true,
    props: {
      iri: mockIri,
      componentPrefix: mockPrefix,
      uiComponent: component
    },
    global: {
      renderStubDefaultSlot: true,
      components: {
        GlobalComponent: {
          name: 'GlobalComponent',
          template: '<div> global </div>',
          props: ['iri']
        }
      }
    }
  })
}

describe('ResourceLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('reactive variables', () => {
    describe('resourceLoadBuffering', () => {
      test('If the resource exists, resourceLoadBuffering should be false', () => {
        const wrapper = createWrapper({
          apiState: {
            status: CwaResourceApiStatuses.IN_PROGRESS
          }
        })
        expect(wrapper.vm.resourceLoadBuffering).toEqual(false)
      })

      test('If the resource does not exist, resourceLoadBuffering should be true and then revert to false after 20ms', () => {
        vi.useFakeTimers()
        const wrapper = createWrapper(undefined)
        expect(wrapper.vm.resourceLoadBuffering).toEqual(true)
        vi.advanceTimersByTime(20)
        expect(wrapper.vm.resourceLoadBuffering).toEqual(false)
        vi.useRealTimers()
      })
    })

    describe('isLoading', () => {
      test.each([
        {
          resourceLoadBuffering: false,
          resource: {
            data: null,
            apiState: {
              status: CwaResourceApiStatuses.IN_PROGRESS
            }
          },
          result: true
        },
        {
          resourceLoadBuffering: false,
          resource: {
            data: undefined,
            apiState: {
              status: CwaResourceApiStatuses.SUCCESS
            }
          },
          result: false
        },
        {
          resourceLoadBuffering: false,
          resource: {
            data: { test: true },
            apiState: {
              status: CwaResourceApiStatuses.IN_PROGRESS
            }
          },
          result: false
        },
        {
          resourceLoadBuffering: true,
          resource: {
            data: { test: true },
            apiState: {
              status: CwaResourceApiStatuses.IN_PROGRESS
            }
          },
          result: false
        },
        {
          resourceLoadBuffering: true,
          resource: undefined,
          result: true
        }
      ])('should return $result IF there resource is $resource and buffering is $resourceLoadBuffering', ({
        resource,
        result,
        resourceLoadBuffering
      }) => {
        const wrapper = createWrapper(resource)
        wrapper.vm.resourceLoadBuffering = ref(resourceLoadBuffering)
        expect(wrapper.vm.isLoading).toEqual(result)
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

  describe('methods', () => {
    describe('fetchResource', () => {
      test('should NOT fetch resource IF ssr flag for api state is false', async () => {
        const resource = { apiState: { ssr: false } }
        const wrapper = createWrapper(resource)

        await wrapper.vm.methods.fetchResource()

        expect(wrapper.vm.$cwa.fetchResource).not.toHaveBeenCalled()
      })

      test('should NOT fetch resource IF ssr flag for api state is true AND resource has data', async () => {
        const resource = { apiState: { ssr: true }, data: { mock: true } }
        const wrapper = createWrapper(resource)

        await wrapper.vm.methods.fetchResource()

        expect(wrapper.vm.$cwa.fetchResource).not.toHaveBeenCalled()
      })

      test('should NOT fetch resource IF ssr flag for api state is true AND resource has no data AND no silent error', async () => {
        const resource = { apiState: { ssr: true, status: CwaResourceApiStatuses.SUCCESS }, data: null }
        const wrapper = createWrapper(resource)

        await wrapper.vm.methods.fetchResource()

        expect(wrapper.vm.$cwa.fetchResource).not.toHaveBeenCalled()
      })

      test('should fetch resource IF resource data is empty, silent error occurred, resource was fetched during SSR', async () => {
        const resource = { apiState: { ssr: true, error: { statusCode: 404 }, status: CwaResourceApiStatuses.ERROR }, data: undefined }
        const wrapper = createWrapper(resource)

        await wrapper.vm.methods.fetchResource()

        expect(wrapper.vm.$cwa.fetchResource).toHaveBeenCalledWith({ path: mockIri })
      })
    })
  })

  describe('watch', () => {
    test('should be called with correct callback and options', () => {
      const watchSpy = vue.watch
      const wrapper = createWrapper({
        apiState: {
          status: CwaResourceApiStatuses.IN_PROGRESS
        }
      })

      expect(watchSpy.mock.calls[0][0]).toHaveLength(2)
      expect(watchSpy.mock.calls[0][0][0].value).toEqual(wrapper.vm.hasSilentError)
      expect(watchSpy.mock.calls[0][0][1].value).toEqual(wrapper.vm.resource)
      // expect(watchSpy.mock.calls[0][0]).toEqual([wrapper.vm.hasSilentError, wrapper.vm.resource])
      expect(watchSpy.mock.calls[0][1]).toEqual(wrapper.vm.methods.fetchResource)
      expect(watchSpy.mock.calls[0][2]).toEqual({ immediate: true })
    })
  })

  describe('snapshots', () => {
    test('should match snapshot IF resource is loading', () => {
      const wrapper = createWrapper({ data: null, apiState: { status: CwaResourceApiStatuses.IN_PROGRESS } })

      expect(wrapper.element).toMatchSnapshot()
    })

    test('should match snapshot IF resource does not exist after loading', async () => {
      vi.useFakeTimers()
      const wrapper = createWrapper(undefined)
      await vi.advanceTimersByTimeAsync(20)
      expect(wrapper.element).toMatchSnapshot()
      vi.useRealTimers()
    })

    test('should match snapshot IF resource data is not resolved', () => {
      const wrapper = createWrapper({
        data: null,
        apiState: {
          status: CwaResourceApiStatuses.SUCCESS
        }
      })

      expect(wrapper.element).toMatchSnapshot()
    })

    test('should match snapshot IF UI component is not resolved', () => {
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

    test('should match snapshot IF component is resolved from props', async () => {
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

    test('should match snapshot IF global component name is resolved', async () => {
      const wrapper = createWrapper({
        data: {
          uiComponent: 'GlobalComponent'
        },
        apiState: {
          status: CwaResourceApiStatuses.SUCCESS
        }
      })
      await wrapper.setProps({
        componentPrefix: undefined
      })

      expect(wrapper.element).toMatchSnapshot()
    })
  })
})
