import { describe, expect, vi, test, beforeEach } from 'vitest'
import * as vue from 'vue'
import { ref } from 'vue'
import ManageableComponent from '../admin/manageable-component'
import * as cwaComposable from '#cwa/runtime/composables/cwa'
import { useCwaResourceManageable } from '#cwa/runtime/composables/cwa-resource-manageable'

vi.mock('../admin/manageable-component', () => {
  return {
    default: vi.fn(() => {
      return {
        init: vi.fn(),
        clear: vi.fn()
      }
    })
  }
})

describe('CWA resource manageable composable', () => {
  const mockCwa = { mock: 'cwa' }
  const mockIri = ref('mock-iri')

  beforeEach(() => {
    vi.spyOn(vue, 'onMounted').mockImplementation(fn => fn())
    vi.spyOn(vue, 'onBeforeUnmount').mockImplementation(fn => fn())
    vi.spyOn(cwaComposable, 'useCwa').mockReturnValue(mockCwa)
  })

  test('should show message IF current instance does not have a proxy', () => {
    vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ mock: true })
    expect(() => useCwaResourceManageable(mockIri)).toThrow('Cannot initialise manager for resource. Instance is not defined')
  })

  test('should create ManageableComponent IF current instance has proxy', () => {
    const mockProxy = { mock: 'proxy' }

    vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ proxy: mockProxy })

    useCwaResourceManageable(mockIri)

    expect(ManageableComponent).toHaveBeenCalledWith(mockProxy, mockCwa)
  })

  test('ManageableComponent should init IF iri is passed', () => {
    const mockProxy = { mock: 'proxy' }

    vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ proxy: mockProxy })

    const initSpy = vi.fn()

    ManageableComponent.mockReturnValueOnce({ init: initSpy, clear: vi.fn() })

    useCwaResourceManageable(mockIri)

    // todo: this will change
    expect(initSpy).toHaveBeenCalledWith(mockIri.value)
  })

  test('ManageableComponent should clear when before unmount hook is called', () => {
    const mockProxy = { mock: 'proxy' }
    let hookCallback = null

    vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ proxy: mockProxy })
    vi.spyOn(vue, 'onBeforeUnmount').mockImplementation((fn) => { hookCallback = fn })

    const clearSpy = vi.fn()

    ManageableComponent.mockReturnValueOnce({ init: vi.fn(), clear: clearSpy })

    useCwaResourceManageable(mockIri)

    expect(clearSpy).not.toHaveBeenCalled()

    hookCallback()

    expect(clearSpy).toHaveBeenCalled()
  })

  test('should return object containing reference to manageable component', () => {
    const mockProxy = { mock: 'proxy' }

    vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ proxy: mockProxy })

    const mockReference = { init: vi.fn(), clear: vi.fn() }

    ManageableComponent.mockReturnValueOnce(mockReference)

    const result = useCwaResourceManageable(mockIri)

    expect(result.manager).toEqual(mockReference)
  })

  test.todo('Watch options')
})
