import { describe, expect, vi, test, beforeEach } from 'vitest'
import * as vue from 'vue'
import { ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { consola } from 'consola'
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
        refreshElements: vi.fn(),
        elements: ref([]),
      }
    }),
  }
})

const lazy = vi.hoisted(() => ({
  loaded: undefined as unknown,
  load: undefined as unknown as ReturnType<typeof import('vitest')['vi']['fn']>,
  importers: [] as (() => Promise<unknown>)[],
}))

vi.mock('../lazy-import', () => ({
  lazyImport: (importer: () => Promise<unknown>) => {
    lazy.importers.push(importer)
    return {
      get loaded() {
        return lazy.loaded
      },
      load: (...args: unknown[]) => lazy.load(...args),
    }
  },
}))

vi.mock('vue', async () => {
  const mod = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...mod,
    inject: vi.fn((_key, fallback) => fallback),
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
      resourceStackManager: {
        refreshFocusForIri: vi.fn(),
      },
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(cwaComposable, 'useCwa').mockReturnValue(mockCwa)
    mockCwa.auth.isAdmin.value = true
    lazy.loaded = ManageableResource
    lazy.load = vi.fn(() => Promise.resolve(ManageableResource))
  })

  function deferredImport() {
    let resolveImport: (value: unknown) => void = () => {}
    lazy.loaded = undefined
    lazy.load = vi.fn(() => new Promise((resolve) => {
      resolveImport = (value) => {
        lazy.loaded = value
        resolve(value)
      }
    }))
    return () => resolveImport(ManageableResource)
  }

  test('the manageable resource class is imported from the admin module', async () => {
    expect(lazy.importers).toHaveLength(1)
    expect(await lazy.importers[0]()).toBe(ManageableResource)
  })

  test('a visitor never loads or constructs a ManageableResource', async () => {
    vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ proxy: { mock: 'proxy' } })
    mockCwa.auth.isAdmin.value = false
    deferredImport()

    useCwaResourceManageable(mockIri)
    await flushPromises()

    expect(lazy.load).not.toHaveBeenCalled()
    expect(ManageableResource).not.toHaveBeenCalled()
  })

  test('an admin constructs and inits the ManageableResource once its import resolves', async () => {
    const mockProxy = { mock: 'proxy' }
    vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ proxy: mockProxy })
    vi.spyOn(vue, 'onBeforeUnmount').mockImplementationOnce(() => {})
    const resolveImport = deferredImport()
    const initSpy = vi.fn()
    ManageableResource.mockImplementationOnce(function () {
      return { init: initSpy, clear: vi.fn() }
    })

    const ops = ref({})
    const { manager } = useCwaResourceManageable(mockIri, ops)

    expect(lazy.load).toHaveBeenCalledOnce()
    expect(ManageableResource).not.toHaveBeenCalled()
    expect(mockCwa.admin.eventBus.emit).not.toHaveBeenCalledWith('componentMounted', mockIri.value)

    resolveImport()
    await flushPromises()

    expect(ManageableResource).toHaveBeenCalledWith(mockProxy, mockCwa, ops, 0)
    expect(initSpy).toHaveBeenCalledWith(mockIri)
    expect(mockCwa.admin.eventBus.emit).toHaveBeenCalledWith('componentMounted', mockIri.value)
    expect(manager.value?.init).toBe(initSpy)
  })

  test('unmounting before the import resolves never constructs or inits a ManageableResource', async () => {
    vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ proxy: { mock: 'proxy' } })
    let unmount: () => void = () => {}
    vi.spyOn(vue, 'onBeforeUnmount').mockImplementation((fn) => {
      unmount = fn
    })
    const resolveImport = deferredImport()

    useCwaResourceManageable(mockIri)
    unmount()
    resolveImport()
    await flushPromises()

    expect(lazy.load).toHaveBeenCalledOnce()
    expect(ManageableResource).not.toHaveBeenCalled()
    expect(mockCwa.admin.eventBus.emit).not.toHaveBeenCalledWith('componentMounted', mockIri.value)
  })

  test('losing admin before the import resolves never constructs or inits a ManageableResource', async () => {
    vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ proxy: { mock: 'proxy' } })
    let watchCallback: ((val: boolean, prev: boolean) => void) | undefined
    vi.spyOn(vue, 'watch').mockImplementation((_source: any, cb: any) => {
      watchCallback = cb
      return vi.fn()
    })
    const resolveImport = deferredImport()

    useCwaResourceManageable(mockIri)
    watchCallback!(false, true)
    resolveImport()
    await flushPromises()

    expect(ManageableResource).not.toHaveBeenCalled()
  })

  test('the import failing is logged and leaves the component unmanaged', async () => {
    vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ proxy: { mock: 'proxy' } })
    const errorSpy = vi.spyOn(consola, 'error').mockImplementation(() => {})
    lazy.loaded = undefined
    lazy.load = vi.fn(() => Promise.reject(new Error('chunk failed')))

    const { manager } = useCwaResourceManageable(mockIri)
    await flushPromises()

    expect(ManageableResource).not.toHaveBeenCalled()
    expect(manager.value).toBeUndefined()
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  test('hands the ManageableResource the page depth its component renders at', () => {
    const mockProxy = { mock: 'proxy' }
    vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ proxy: mockProxy })
    vi.mocked(vue.inject).mockImplementationOnce((key, fallback) => (key === 'cwa-page-own-depth' ? 2 : fallback))

    const ops = ref({})
    useCwaResourceManageable(mockIri, ops)

    expect(vue.inject).toHaveBeenCalledWith('cwa-page-own-depth', 0)
    expect(ManageableResource).toHaveBeenCalledWith(mockProxy, mockCwa, ops, 2)
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

    expect(ManageableResource).toHaveBeenCalledWith(mockProxy, mockCwa, ops, 0)
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

    expect(result.manager.value).toEqual(mockReference)
  })

  describe('onManageableComponentMounted listener', () => {
    test('calls initNewIri, refreshFocusForIri, and emits componentMounted when iri matches', () => {
      const mockProxy = { mock: 'proxy' }
      vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ proxy: mockProxy })

      const initNewIriSpy = vi.fn()
      const mockElements = ref([])
      ManageableResource.mockImplementationOnce(function () {
        return { init: vi.fn(), clear: vi.fn(), initNewIri: initNewIriSpy, elements: mockElements }
      })

      useCwaResourceManageable(mockIri)

      const listenerCall = mockCwa.admin.eventBus.on.mock.calls.find(([name]) => name === 'manageableComponentMounted')
      const listener = listenerCall?.[1]

      listener(mockIri.value)

      expect(initNewIriSpy).toHaveBeenCalledOnce()
      expect(mockCwa.admin.resourceStackManager.refreshFocusForIri).toHaveBeenCalledWith(mockIri.value, mockElements)
      expect(mockCwa.admin.eventBus.emit).toHaveBeenCalledWith('componentMounted', mockIri.value)
    })

    test('does nothing when iri does not match', () => {
      const mockProxy = { mock: 'proxy' }
      vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ proxy: mockProxy })

      const initNewIriSpy = vi.fn()
      ManageableResource.mockImplementationOnce(function () {
        return { init: vi.fn(), clear: vi.fn(), initNewIri: initNewIriSpy, elements: ref([]) }
      })

      useCwaResourceManageable(mockIri)

      const listenerCall = mockCwa.admin.eventBus.on.mock.calls.find(([name]) => name === 'manageableComponentMounted')
      const listener = listenerCall?.[1]

      listener('/different-iri')

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

  describe('onComponentUpdated listener', () => {
    test('refreshes the recorded elements when the iri matches', () => {
      mockCwa.auth.isAdmin.value = true
      vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ proxy: { mock: 'proxy' } })

      const refreshElementsSpy = vi.fn()
      ManageableResource.mockImplementationOnce(function () {
        return { init: vi.fn(), clear: vi.fn(), initNewIri: vi.fn(), refreshElements: refreshElementsSpy, elements: ref([]) }
      })

      useCwaResourceManageable(mockIri)

      const listener = mockCwa.admin.eventBus.on.mock.calls.find(([name]) => name === 'componentUpdated')?.[1]
      listener(mockIri.value)

      expect(refreshElementsSpy).toHaveBeenCalledOnce()
    })

    test('does nothing when the iri does not match', () => {
      mockCwa.auth.isAdmin.value = true
      vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ proxy: { mock: 'proxy' } })

      const refreshElementsSpy = vi.fn()
      ManageableResource.mockImplementationOnce(function () {
        return { init: vi.fn(), clear: vi.fn(), initNewIri: vi.fn(), refreshElements: refreshElementsSpy, elements: ref([]) }
      })

      useCwaResourceManageable(mockIri)

      const listener = mockCwa.admin.eventBus.on.mock.calls.find(([name]) => name === 'componentUpdated')?.[1]
      listener('/different-iri')

      expect(refreshElementsSpy).not.toHaveBeenCalled()
    })
  })

  test.todo('Watch options')
})
