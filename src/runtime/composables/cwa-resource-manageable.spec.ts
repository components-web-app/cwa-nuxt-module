import { describe, expect, vi, test, beforeEach } from 'vitest'
import * as vue from 'vue'
import { ref } from 'vue'
import ManageableResource from '../admin/manageable-resource'
import * as cwaComposable from '#cwa/runtime/composables/cwa'
import { useCwaResourceManageable } from '#cwa/runtime/composables/cwa-resource-manageable'

vi.mock('../admin/manageable-resource', () => {
  return {
    default: vi.fn(() => {
      return {
        init: vi.fn(),
        clear: vi.fn()
      }
    })
  }
})

vi.mock('vue', async () => {
  const mod = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...mod,
    onMounted: vi.fn(fn => fn()),
    onBeforeUnmount: vi.fn(fn => fn())
  }
})

describe('CWA resource manageable composable', () => {
  const mockCwa = { mock: 'cwa' }
  const mockIri = ref('mock-iri')

  beforeEach(() => {
    vi.spyOn(cwaComposable, 'useCwa').mockReturnValue(mockCwa)
  })

  test('should show message IF current instance does not have a proxy', () => {
    vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ mock: true })
    expect(() => useCwaResourceManageable(mockIri)).toThrow('Cannot initialise manager for resource. Instance is not defined')
  })

  test('should create ManageableResource IF current instance has proxy', () => {
    const mockProxy = { mock: 'proxy' }

    vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ proxy: mockProxy })

    const ops = { op: 'op' }
    useCwaResourceManageable(mockIri, ops)

    expect(ManageableResource).toHaveBeenCalledWith(mockProxy, mockCwa, ops)
  })

  test('ManageableResource should init IF iri is passed', () => {
    const mockProxy = { mock: 'proxy' }

    vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ proxy: mockProxy })

    const initSpy = vi.fn()

    ManageableResource.mockReturnValueOnce({ init: initSpy, clear: vi.fn() })

    useCwaResourceManageable(mockIri)

    expect(initSpy).toHaveBeenCalledWith(mockIri)
  })

  test('ManageableResource should clear when before unmount hook is called', () => {
    const mockProxy = { mock: 'proxy' }
    let hookCallback = null

    vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ proxy: mockProxy })
    vi.spyOn(vue, 'onBeforeUnmount').mockImplementation((fn) => { hookCallback = fn })

    const clearSpy = vi.fn()

    ManageableResource.mockReturnValueOnce({ init: vi.fn(), clear: clearSpy })

    useCwaResourceManageable(mockIri)

    expect(clearSpy).not.toHaveBeenCalled()

    hookCallback()

    expect(clearSpy).toHaveBeenCalled()
  })

  test('should return object containing reference to manageable component', () => {
    const mockProxy = { mock: 'proxy' }

    vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ proxy: mockProxy })

    const mockReference = { init: vi.fn(), clear: vi.fn() }

    ManageableResource.mockReturnValueOnce(mockReference)

    const result = useCwaResourceManageable(mockIri)

    expect(result.manager).toEqual(mockReference)
  })

  test.todo('Watch options')
})
