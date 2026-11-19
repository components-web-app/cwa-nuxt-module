// @vitest-environment happy-dom

import { describe, expect, vi, test, beforeEach } from 'vitest'
import { ref } from 'vue'
import * as vue from 'vue'
import * as cwaComposable from '#cwa/composables/cwa'
import * as cwaResourceManageable from '#cwa/composables/cwa-resource-manageable'
import { useCwaResource } from '#cwa/composables/cwa-resource'

vi.mock('vue', async () => {
  const mod = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...mod,
    onMounted: vi.fn(fn => fn()),
    getCurrentInstance: vi.fn(() => null),
  }
})

describe('CWA resources composable', () => {
  const mockManager = { mock: 'manager' }
  const mockCwa = {
    auth: {
      isAdmin: ref(true),
    },
    admin: {
      eventBus: {
        emit: vi.fn(),
      },
    },
    resources: {
      getResource: vi.fn(),
    },
  }
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => mockCwa)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => mockCwa)
  })

  test('should return an object for exposing vars', () => {
    const mockIri = 'mock-iri'
    const name = 'boogieman'
    const result = useCwaResource(mockIri, { name, manager: { disabled: true } })

    expect(result.exposeMeta).toEqual({
      cwaResource: {
        name,
      },
      disableManager: true,
    })
  })

  test.each([
    {
      disabled: true,
      eventName: 'componentMounted',
    },
    {
      disabled: false,
      eventName: 'manageableComponentMounted',
    },
  ])('should emit correct eventbus event on mounted if manager is disabled', ({ disabled, eventName }) => {
    vi.spyOn(cwaResourceManageable, 'useCwaResourceManageable').mockImplementation(() => mockManager)
    const mockIri = ref('mock-iri')

    useCwaResource(mockIri, { manager: { disabled } })

    expect(mockCwa.admin.eventBus.emit).toHaveBeenCalledWith(eventName, mockIri.value)
  })

  test('should return object containing function to get resource by iri provided into composable', () => {
    vi.spyOn(cwaResourceManageable, 'useCwaResourceManageable').mockImplementation(() => mockManager)

    const mockIri = ref('mock-iri')
    const mockResource = ref({ mock: 'resource' })

    const result = useCwaResource(mockIri)

    mockCwa.resources.getResource.mockReturnValueOnce(mockResource)

    expect(result.getResource).toBeDefined()
    expect(result.getResource().value).toEqual(mockResource.value)
    expect(mockCwa.resources.getResource).toHaveBeenCalledWith(mockIri.value)
  })

  test('does not emit when element is detached from DOM', () => {
    vi.spyOn(cwaResourceManageable, 'useCwaResourceManageable').mockImplementation(() => mockManager)
    vi.spyOn(vue, 'getCurrentInstance').mockReturnValueOnce({
      proxy: { $el: { isConnected: false } },
    } as any)

    const mockIri = ref('mock-iri')
    useCwaResource(mockIri, { manager: { disabled: false } })

    expect(mockCwa.admin.eventBus.emit).not.toHaveBeenCalled()
  })

  describe('uiClassNames', () => {
    test('returns uiClassNames computed', () => {
      mockCwa.resources.getResource.mockReturnValue(ref({ data: { uiClassNames: ['text-xl'] } }))

      const { uiClassNames } = useCwaResource(ref('mock-iri'))

      expect(uiClassNames.value).toEqual(['text-xl'])
    })
  })

  describe('styleKeys', () => {
    test('lists every selected style key in stored order (#453)', () => {
      mockCwa.resources.getResource.mockReturnValue(ref({ data: { uiClassNames: ['style:outlined', 'style:filled'] } }))
      const { styleKeys } = useCwaResource(ref('mock-iri'))
      expect(styleKeys.value).toEqual(['outlined', 'filled'])
    })

    test('updates when uiClassNames changes', () => {
      const resource = ref<{ data: { uiClassNames: string[] | null } }>({ data: { uiClassNames: ['style:filled'] } })
      mockCwa.resources.getResource.mockReturnValue(resource)
      const { styleKeys } = useCwaResource(ref('mock-iri'))
      expect(styleKeys.value).toEqual(['filled'])
      resource.value = { data: { uiClassNames: ['style:outlined'] } }
      expect(styleKeys.value).toEqual(['outlined'])
      resource.value = { data: { uiClassNames: null } }
      expect(styleKeys.value).toEqual([])
    })

    test('leaves out entries without the style prefix', () => {
      mockCwa.resources.getResource.mockReturnValue(ref({ data: { uiClassNames: ['legacy classes', 'style:filled', 'filled'] } }))
      const { styleKeys } = useCwaResource(ref('mock-iri'))
      expect(styleKeys.value).toEqual(['filled'])
    })
  })

  describe('root element changes after mounting', () => {
    test('emits componentUpdated so the admin selection follows the new element', () => {
      vi.spyOn(cwaResourceManageable, 'useCwaResourceManageable').mockImplementation(() => mockManager)
      mockCwa.auth.isAdmin.value = true
      let updatedCallback: (() => void) | undefined
      vi.spyOn(vue, 'onUpdated').mockImplementation((fn: any) => {
        updatedCallback = fn
      })
      const mockIri = ref('mock-iri')

      useCwaResource(mockIri)
      mockCwa.admin.eventBus.emit.mockClear()
      updatedCallback!()

      expect(mockCwa.admin.eventBus.emit).toHaveBeenCalledWith('componentUpdated', mockIri.value)
    })

    test('emits nothing when the visitor is not an admin', () => {
      vi.spyOn(cwaResourceManageable, 'useCwaResourceManageable').mockImplementation(() => mockManager)
      mockCwa.auth.isAdmin.value = false
      let updatedCallback: (() => void) | undefined
      vi.spyOn(vue, 'onUpdated').mockImplementation((fn: any) => {
        updatedCallback = fn
      })

      useCwaResource(ref('mock-iri'))
      mockCwa.admin.eventBus.emit.mockClear()
      updatedCallback!()

      expect(mockCwa.admin.eventBus.emit).not.toHaveBeenCalled()
      mockCwa.auth.isAdmin.value = true
    })

    test('emits nothing when the element is detached from the DOM', () => {
      vi.spyOn(cwaResourceManageable, 'useCwaResourceManageable').mockImplementation(() => mockManager)
      mockCwa.auth.isAdmin.value = true
      vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({
        proxy: { $el: { isConnected: false } },
      } as any)
      let updatedCallback: (() => void) | undefined
      vi.spyOn(vue, 'onUpdated').mockImplementation((fn: any) => {
        updatedCallback = fn
      })

      useCwaResource(ref('mock-iri'))
      mockCwa.admin.eventBus.emit.mockClear()
      updatedCallback!()

      expect(mockCwa.admin.eventBus.emit).not.toHaveBeenCalled()
    })
  })
})
