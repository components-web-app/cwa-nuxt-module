// @vitest-environment nuxt
import { describe, expect, test, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import * as vue from 'vue'
import ComponentPosition from '../core/ComponentPosition.vue'
import ComponentGroup from './ComponentGroup.vue'
import { CwaResourceApiStatuses } from '#cwa/runtime/storage/stores/resources/state'
import { ComponentGroupUtilSynchronizer } from '#cwa/runtime/templates/components/main/ComponentGroup.Util.Synchronizer'
import * as cwaComposables from '#cwa/runtime/composables/cwa'
import * as cwaResourceManageableComposables from '#cwa/runtime/composables/cwa-resource-manageable'

vi.mock('./ComponentGroup.Util.Synchronizer', () => {
  return {
    ComponentGroupUtilSynchronizer: vi.fn(() => {
      return {
        createSyncWatcher: vi.fn()
      }
    })
  }
})

vi.mock('vue', async () => {
  const mod = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...mod,
    watch: vi.fn(() => {})
  }
})

const mockReference = 'mockReference'
const mockResourceReference = 'mockResourceReference'
const mockLocation = 'mockLocation'
const mockCwaResources = {
  getResource: vi.fn().mockImplementation(() => vue.computed(() => { return undefined })),
  getComponentGroupByReference: vi.fn().mockName('getComponentGroupByReference')
}

function createWrapper ({
  isLoading = false,
  reference = mockReference,
  location = mockLocation,
  allowedComponents = [],
  signedIn = false,
  isEditing = true
}: {
  isLoading?: boolean;
  reference?: string;
  location?: string;
  allowedComponents?: string[];
  signedIn?: boolean;
  isEditing: boolean;
} = {}) {
  // @ts-ignore
  vi.spyOn(cwaComposables, 'useCwa').mockImplementationOnce(() => {
    return {
      auth: { signedIn: vue.ref(signedIn) },
      resources: {
        ...mockCwaResources,
        isLoading: { value: isLoading }
      },
      resourcesManager: {
        createResource: vi.fn(),
        updateResource: vi.fn()
      },
      admin: { isEditing }
    }
  })

  return mount(ComponentGroup, {
    props: {
      reference,
      location,
      allowedComponents
    },
    shallow: true
  })
}

describe('ComponentGroup', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('computed properties', () => {
    describe('fullReference', () => {
      test('should return nothing IF there is no resource matching location', () => {
        const wrapper = createWrapper()

        expect(wrapper.vm.fullReference).toBeUndefined()
        expect(mockCwaResources.getResource).toHaveBeenCalledWith(mockLocation)
      })

      test('should return fullReference BASED on location resource data', () => {
        vi.spyOn(mockCwaResources, 'getResource').mockImplementationOnce(() => {
          return {
            value: {
              data: {
                reference: mockResourceReference
              }
            }
          }
        })

        const wrapper = createWrapper()
        expect(wrapper.vm.fullReference).toEqual(`${mockReference}_${mockResourceReference}`)
        expect(mockCwaResources.getResource).toHaveBeenCalledWith(mockLocation)
      })
    })

    describe('resource', () => {
      test('should return undefined if full reference is undefined', () => {
        const wrapper = createWrapper()
        expect(mockCwaResources.getComponentGroupByReference).not.toHaveBeenCalled()
        expect(wrapper.vm.resource).toBeUndefined()
      })

      test('should return resource from resources list BASED on type AND full reference', () => {
        vi.spyOn(mockCwaResources, 'getComponentGroupByReference').mockImplementationOnce(() => {
          return 'COMPY-PONENET'
        })

        // todo: see if we can isolate as this mock is because we seem to have to call fullReference computedref
        vi.spyOn(mockCwaResources, 'getResource').mockImplementationOnce(() => {
          return {
            value: {
              data: {
                reference: mockResourceReference
              }
            }
          }
        })

        const wrapper = createWrapper()
        expect(mockCwaResources.getComponentGroupByReference).toHaveBeenCalledWith(`${mockReference}_${mockResourceReference}`)
        expect(wrapper.vm.resource).toEqual('COMPY-PONENET')
      })
    })

    describe('showLoader', () => {
      test('should return false IF resources loading flag is false', () => {
        const wrapper = createWrapper()

        expect(wrapper.vm.showLoader).toEqual(false)
      })

      test('should return true IF resources loading flag is true AND resource is not defined', () => {
        const wrapper = createWrapper({
          isLoading: true
        })

        expect(wrapper.vm.showLoader).toEqual(true)
      })

      test('should return true IF resources loading flag is true AND resource is in loading state', () => {
        // todo: is we can mock other computed vars then we do not need to mock all these as in depth to get other computeds to return
        vi.spyOn(mockCwaResources, 'getComponentGroupByReference').mockImplementationOnce(() => {
          return {
            data: undefined,
            apiState: {
              status: CwaResourceApiStatuses.IN_PROGRESS
            }
          }
        })
        vi.spyOn(mockCwaResources, 'getResource').mockImplementationOnce(() => {
          return {
            value: {
              data: {
                reference: 'anything'
              }
            }
          }
        })

        const wrapper = createWrapper({
          isLoading: true
        })

        expect(wrapper.vm.showLoader).toEqual(true)
      })
    })

    describe('componentPositions', () => {
      test.each([{
        component: {
          data: undefined
        }
      }, { component: undefined }])('should return undefined if component is $component', ({ component }) => {
        vi.spyOn(mockCwaResources, 'getResource').mockImplementationOnce(() => {
          return {
            value: {
              data: {
                reference: 'anything'
              }
            }
          }
        })
        vi.spyOn(mockCwaResources, 'getComponentGroupByReference').mockImplementationOnce(() => {
          return component
        })
        const wrapper = createWrapper()

        expect(wrapper.vm.componentPositions).toBeUndefined()
      })

      test('should return resource component positions BASED on its data', () => {
        vi.spyOn(mockCwaResources, 'getResource').mockImplementationOnce(() => {
          return {
            value: {
              data: {
                reference: 'anything'
              }
            }
          }
        })

        const mockComponentPositions = ['pos1', 'pos2', 'pos3']
        const mockGroupElement = {
          data: {
            componentPositions: mockComponentPositions
          }
        }
        vi.spyOn(mockCwaResources, 'getComponentGroupByReference').mockImplementationOnce(() => {
          return mockGroupElement
        })
        const wrapper = createWrapper()

        expect(wrapper.vm.componentPositions).toEqual(mockComponentPositions)
      })
    })

    describe('signedInAndResourceExists', () => {
      test.each([
        {
          expected: false,
          component: {
            data: undefined
          },
          signedIn: true,
          isEditing: true
        },
        {
          expected: false,
          component: undefined,
          signedIn: true,
          isEditing: true
        },
        {
          expected: false,
          component: {
            data: {}
          },
          signedIn: false,
          isEditing: true
        },
        {
          expected: false,
          component: {
            data: {}
          },
          signedIn: true,
          isEditing: false
        },
        {
          expected: true,
          component: {
            data: {}
          },
          signedIn: true,
          isEditing: true
        }
      ])('should return $expected IF user is signed in is $signedIn AND resource is $component', ({ expected, signedIn, component, isEditing }) => {
        vi.spyOn(mockCwaResources, 'getResource').mockImplementationOnce(() => {
          return {
            value: {
              data: {
                reference: 'anything'
              }
            }
          }
        })
        vi.spyOn(mockCwaResources, 'getComponentGroupByReference').mockImplementationOnce(() => {
          return component
        })

        const wrapper = createWrapper({
          signedIn: vue.ref(signedIn),
          isEditing
        })

        expect(wrapper.vm.signedInAndResourceExists).toEqual(expected)
      })
    })
  })

  describe('Start and stop component group sync watcher', () => {
    test('should synchronize group on mount AND unsync on component unmount', () => {
      vi.spyOn(mockCwaResources, 'getComponentGroupByReference').mockImplementationOnce(() => {
        return 'COMPY-PONENET'
      })
      vi.spyOn(mockCwaResources, 'getResource').mockImplementationOnce(() => {
        return {
          value: {
            data: {
              reference: mockResourceReference
            }
          }
        }
      })

      const watchSpy = vi.fn()
      const unwatchSpy = vi.fn()

      // @ts-ignore
      ComponentGroupUtilSynchronizer.mockReturnValueOnce({ createSyncWatcher: watchSpy, stopSyncWatcher: unwatchSpy })

      const wrapper = createWrapper()
      expect(watchSpy.mock.calls[0][0].resource.value).toEqual(wrapper.vm.resource)
      expect(watchSpy.mock.calls[0][0].location).toEqual(wrapper.props().location)
      expect(watchSpy.mock.calls[0][0].fullReference.value).toEqual(wrapper.vm.fullReference)
      expect(watchSpy.mock.calls[0][0].allowedComponents).toEqual(wrapper.props().allowedComponents)

      wrapper.unmount()

      expect(unwatchSpy).toHaveBeenCalled()
    })
  })

  describe('props', () => {
    test('should pass correct uiComponent objects per each ResourceLoader component', () => {
      vi.spyOn(mockCwaResources, 'getResource').mockImplementationOnce(() => {
        return {
          value: {
            data: {
              reference: 'anything'
            }
          }
        }
      })

      const mockComponentPositions = ['pos1', 'pos2', 'pos3']
      const mockGroupElement = {
        data: {
          componentPositions: mockComponentPositions
        }
      }
      vi.spyOn(mockCwaResources, 'getComponentGroupByReference').mockImplementationOnce(() => {
        return mockGroupElement
      })
      const wrapper = createWrapper()

      const resourceLoaders = wrapper.findAllComponents({ name: 'ResourceLoader' })

      expect(resourceLoaders.length).toEqual(mockComponentPositions.length)

      resourceLoaders.forEach((resourceLoader, index) => {
        const { iri, uiComponent } = resourceLoader.props()

        expect(iri).toEqual(mockComponentPositions[index])
        expect(uiComponent).toEqual(ComponentPosition)
      })
    })
  })

  describe('Initialise manager when resource is available', () => {
    test('Watcher is called with correct options', () => {
      const resourceWatchHandler = vi.fn()
      const resolvedResource = {
        data: undefined,
        apiState: {}
      }
      vi.spyOn(cwaResourceManageableComposables, 'useCwaResourceManageable').mockImplementationOnce(() => {
        return {
          resourceWatchHandler
        }
      })
      vi.spyOn(mockCwaResources, 'getResource').mockImplementationOnce(() => {
        return {
          value: {
            data: {
              reference: 'anything'
            }
          }
        }
      })
      vi.spyOn(mockCwaResources, 'getComponentGroupByReference').mockImplementationOnce(() => {
        return resolvedResource
      })
      const wrapper = createWrapper()

      const watchCall = vue.watch.mock.lastCall
      expect(watchCall[0][0].value).toEqual(wrapper.vm.componentPositions)
      expect(watchCall[0][1].value).toEqual(wrapper.vm.signedInAndResourceExists)
      expect(watchCall[0][2].value).toEqual(wrapper.vm.resource)
      expect(watchCall[1]).toEqual(wrapper.vm.managerWatchCallback)
      expect(watchCall[2]).toEqual({
        immediate: true,
        flush: 'post'
      })
    })
  })

  describe('snapshots', () => {
    test('should match snapshot IF loader is shown', () => {
      const wrapper = createWrapper({
        isLoading: true
      })

      expect(wrapper.element).toMatchSnapshot()
    })

    test('should match snapshot IF resource is not found', () => {
      const wrapper = createWrapper()

      expect(wrapper.element).toMatchSnapshot()
    })

    test('should match snapshot IF there are component positions defined', () => {
      vi.spyOn(mockCwaResources, 'getResource').mockImplementationOnce(() => {
        return {
          value: {
            data: {
              reference: 'anything'
            }
          }
        }
      })

      const mockComponentPositions = ['pos1', 'pos2', 'pos3']
      const mockGroupElement = {
        data: {
          componentPositions: mockComponentPositions
        }
      }
      vi.spyOn(mockCwaResources, 'getComponentGroupByReference').mockImplementationOnce(() => {
        return mockGroupElement
      })
      const wrapper = createWrapper()

      expect(wrapper.element).toMatchSnapshot()
    })

    test('should match snapshot IF there are no component positions defined', () => {
      const wrapper = createWrapper()

      expect(wrapper.element).toMatchSnapshot()
    })

    test('should match snapshot IF user is logged in but there are no positions', () => {
      vi.spyOn(mockCwaResources, 'getResource').mockImplementationOnce(() => {
        return {
          value: {
            data: {
              reference: 'anything'
            }
          }
        }
      })
      vi.spyOn(mockCwaResources, 'getComponentGroupByReference').mockImplementationOnce(() => {
        return {
          data: {}
        }
      })

      const wrapper = createWrapper({
        signedIn: true
      })

      expect(wrapper.element).toMatchSnapshot()
    })
  })
})
