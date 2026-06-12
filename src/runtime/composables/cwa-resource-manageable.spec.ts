import { describe, expect, vi, test, beforeEach } from 'vitest'
import * as vue from 'vue'
import { ref } from 'vue'
import ManageableResource from '../admin/manageable-resource'
import * as cwaComposable from '#cwa/composables/cwa'
import { useCwaResourceManageable } from '#cwa/composables/cwa-resource-manageable'

vi.mock('../admin/manageable-resource', () => {
  return {
    default: vi.fn(function () {
      return {
        init: vi.fn(),
        clear: vi.fn(),
        initNewIri: vi.fn(),
      }
    }),
  }
})

vi.mock('vue', async () => {
  const mod = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...mod,
    onMounted: vi.fn(fn => fn()),
    onBeforeUnmount: vi.fn(fn => fn()),
    watch: vi.fn((source, cb, opts) => {
      if (opts?.immediate) cb(typeof source === 'function' ? source() : source.value, undefined)
      return vi.fn()
    }),
  }
})

describe('CWA resource manageable composable', () => {
  const mockIri = ref('mock-iri')
  const mockCwa = {
    auth: {
      isAdmin: ref(true),
    },
    admin: {
      eventBus: {
        emit: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
      },
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
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

    ManageableResource.mockImplementationOnce(function () {
      return {
        init: initSpy,
        clear: vi.fn(),
      }
    })

    useCwaResourceManageable(mockIri)

    expect(initSpy).toHaveBeenCalledWith(mockIri)
  })

  test('ManageableResource should clear when before unmount hook is called', () => {
    const mockProxy = { mock: 'proxy' }
    let hookCallback = null

    vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ proxy: mockProxy })
    vi.spyOn(vue, 'onBeforeUnmount').mockImplementation((fn) => {
      hookCallback = fn
    })

    const clearSpy = vi.fn()

    ManageableResource.mockImplementationOnce(function () {
      return {
        init: vi.fn(),
        clear: clearSpy,
      }
    })

    useCwaResourceManageable(mockIri)

    expect(clearSpy).not.toHaveBeenCalled()

    hookCallback()

    expect(clearSpy).toHaveBeenCalled()
  })

  test('should return object containing reference to manageable component', () => {
    const mockProxy = { mock: 'proxy' }

    vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ proxy: mockProxy })

    const mockReference = { init: vi.fn(), clear: vi.fn() }

    ManageableResource.mockImplementationOnce(function () {
      return mockReference
    })

    const result = useCwaResourceManageable(mockIri)

    expect(result.manager).toEqual(mockReference)
  })

  describe('onManageableComponentMounted listener', () => {
    test('calls initNewIri and emits componentMounted when iri matches', () => {
      const mockProxy = { mock: 'proxy' }
      vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ proxy: mockProxy })

      const initNewIriSpy = vi.fn()
      ManageableResource.mockImplementationOnce(function () {
        return { init: vi.fn(), clear: vi.fn(), initNewIri: initNewIriSpy }
      })

      useCwaResourceManageable(mockIri)

      // capture the 'manageableComponentMounted' listener registered on eventBus.on
      const listenerCall = mockCwa.admin.eventBus.on.mock.calls.find(([name]) => name === 'manageableComponentMounted')
      const listener = listenerCall?.[1]

      listener(mockIri.value) // matching iri

      expect(initNewIriSpy).toHaveBeenCalledOnce()
      expect(mockCwa.admin.eventBus.emit).toHaveBeenCalledWith('componentMounted', mockIri.value)
    })

    test('does nothing when iri does not match', () => {
      const mockProxy = { mock: 'proxy' }
      vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ proxy: mockProxy })

      const initNewIriSpy = vi.fn()
      ManageableResource.mockImplementationOnce(function () {
        return { init: vi.fn(), clear: vi.fn(), initNewIri: initNewIriSpy }
      })

      useCwaResourceManageable(mockIri)

      const listenerCall = mockCwa.admin.eventBus.on.mock.calls.find(([name]) => name === 'manageableComponentMounted')
      const listener = listenerCall?.[1]

      listener('/different-iri') // non-matching

      expect(initNewIriSpy).not.toHaveBeenCalled()
    })
  })

  describe('isAdmin watcher callback', () => {
    test('calls clearAdmin when admin transitions from true to false', () => {
      const mockProxy = { mock: 'proxy' }
      vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ proxy: mockProxy })

      let watchCallback: ((val: boolean, prev: boolean) => void) | undefined
      vi.spyOn(vue, 'watch').mockImplementation((_source: any, cb: any) => {
        watchCallback = cb
        return vi.fn()
      })

      const clearSpy = vi.fn()
      ManageableResource.mockImplementationOnce(function () {
        return { init: vi.fn(), clear: clearSpy, initNewIri: vi.fn() }
      })

      useCwaResourceManageable(mockIri)

      // invoke the watcher callback with isAdmin going false
      watchCallback!(false, true)

      expect(clearSpy).toHaveBeenCalled()
    })

    test('calls initAdmin when admin transitions from false to true', () => {
      const mockProxy = { mock: 'proxy' }
      vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ proxy: mockProxy })

      let watchCallback: ((val: boolean, prev: boolean) => void) | undefined
      vi.spyOn(vue, 'watch').mockImplementation((_source: any, cb: any) => {
        watchCallback = cb
        return vi.fn()
      })

      // isAdmin starts false so onMounted does NOT call initAdmin
      mockCwa.auth.isAdmin.value = false

      const initSpy = vi.fn()
      ManageableResource.mockImplementationOnce(function () {
        return { init: initSpy, clear: vi.fn(), initNewIri: vi.fn() }
      })

      useCwaResourceManageable(mockIri)

      watchCallback!(true, false)

      expect(initSpy).toHaveBeenCalledWith(mockIri)
    })
  })

  test.todo('Watch options')
})
