// @vitest-environment happy-dom

import { describe, expect, vi, test, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
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
    const styles = 'styles'
    const name = 'boogieman'
    const result = useCwaResource(mockIri, { styles, name, manager: { disabled: true } })

    expect(result.exposeMeta).toEqual({
      cwaResource: {
        name,
        styles,
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

  describe('auto-apply uiClassNames to root element', () => {
    let mockClassList: { add: ReturnType<typeof vi.fn>, remove: ReturnType<typeof vi.fn>, contains: ReturnType<typeof vi.fn> }
    let mockEl: { nodeType: number, isConnected: boolean, classList: typeof mockClassList }

    beforeEach(() => {
      mockClassList = {
        add: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn(() => false),
      }
      mockEl = { nodeType: 1, isConnected: true, classList: mockClassList }
    })

    test('adds uiClassNames to root element on mount (active mode)', () => {
      vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ proxy: { $el: mockEl } } as any)
      mockCwa.resources.getResource.mockReturnValue(ref({ data: { uiClassNames: ['text-xl', 'font-bold'] } }))

      useCwaResource(ref('mock-iri'))

      expect(mockClassList.add).toHaveBeenCalledWith('text-xl')
      expect(mockClassList.add).toHaveBeenCalledWith('font-bold')
    })

    test('skips add when all uiClassNames already present on element (passive mode)', () => {
      mockClassList.contains.mockReturnValue(true)
      vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ proxy: { $el: mockEl } } as any)
      mockCwa.resources.getResource.mockReturnValue(ref({ data: { uiClassNames: ['text-xl'] } }))

      useCwaResource(ref('mock-iri'))

      expect(mockClassList.add).not.toHaveBeenCalled()
    })

    test('does nothing when uiClassNames is undefined', () => {
      vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ proxy: { $el: mockEl } } as any)
      mockCwa.resources.getResource.mockReturnValue(ref({ data: {} }))

      useCwaResource(ref('mock-iri'))

      expect(mockClassList.add).not.toHaveBeenCalled()
    })

    test('does not apply when autoClass is false', () => {
      vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ proxy: { $el: mockEl } } as any)
      mockCwa.resources.getResource.mockReturnValue(ref({ data: { uiClassNames: ['text-xl'] } }))

      useCwaResource(ref('mock-iri'), { autoClass: false })

      expect(mockClassList.add).not.toHaveBeenCalled()
    })

    test('skips when root element is not an element node (e.g. fragment)', () => {
      const commentNode = { nodeType: 8, isConnected: true }
      vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ proxy: { $el: commentNode } } as any)
      mockCwa.resources.getResource.mockReturnValue(ref({ data: { uiClassNames: ['text-xl'] } }))

      expect(() => useCwaResource(ref('mock-iri'))).not.toThrow()
      expect(mockClassList.add).not.toHaveBeenCalled()
    })

    test('on change: removes old CWA-applied classes and adds new ones', async () => {
      vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ proxy: { $el: mockEl } } as any)
      const resourceRef = ref({ data: { uiClassNames: ['text-xl'] } })
      mockCwa.resources.getResource.mockReturnValue(resourceRef)

      useCwaResource(ref('mock-iri'))

      // simulate style change: new classes not yet on element
      resourceRef.value = { data: { uiClassNames: ['font-bold'] } }
      await nextTick()

      expect(mockClassList.remove).toHaveBeenCalledWith('text-xl')
      expect(mockClassList.add).toHaveBeenCalledWith('font-bold')
    })

    test('on change: only adds classes not already on element', async () => {
      // persisting class stays, new one is added, dropped one is removed
      const appliedClasses = new Set<string>()
      mockClassList.add.mockImplementation((cls: string) => appliedClasses.add(cls))
      mockClassList.remove.mockImplementation((cls: string) => appliedClasses.delete(cls))
      mockClassList.contains.mockImplementation((cls: string) => appliedClasses.has(cls))

      vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ proxy: { $el: mockEl } } as any)
      const resourceRef = ref({ data: { uiClassNames: ['text-xl', 'font-bold'] } })
      mockCwa.resources.getResource.mockReturnValue(resourceRef)

      useCwaResource(ref('mock-iri'))

      // Reset call history (not implementation) so we only assert on the change-phase calls
      mockClassList.add.mockClear()
      mockClassList.remove.mockClear()

      // 'font-bold' persists, 'text-xl' dropped, 'p-4' added
      resourceRef.value = { data: { uiClassNames: ['font-bold', 'p-4'] } }
      await nextTick()

      expect(mockClassList.remove).toHaveBeenCalledWith('text-xl')
      expect(mockClassList.remove).not.toHaveBeenCalledWith('font-bold')
      expect(mockClassList.add).toHaveBeenCalledWith('p-4')
      // font-bold already on element — not re-added during the change
      expect(mockClassList.add).not.toHaveBeenCalledWith('font-bold')
    })

    test('on change: stays passive when all new classes already present (user binding updated)', async () => {
      // Simulate user has :class binding — all classes already present after Vue re-render
      mockClassList.contains.mockReturnValue(true)
      vi.spyOn(vue, 'getCurrentInstance').mockReturnValue({ proxy: { $el: mockEl } } as any)
      const resourceRef = ref({ data: { uiClassNames: ['text-xl'] } })
      mockCwa.resources.getResource.mockReturnValue(resourceRef)

      useCwaResource(ref('mock-iri'))

      // Style changes, Vue re-renders (:class updates element before our post-flush watcher fires)
      resourceRef.value = { data: { uiClassNames: ['font-bold'] } }
      await nextTick()

      // Neither remove nor add — passive mode the whole time
      expect(mockClassList.remove).not.toHaveBeenCalled()
      // add was not called after the change (contains always returns true)
      expect(mockClassList.add).not.toHaveBeenCalled()
    })

    test('returns uiClassNames computed', () => {
      mockCwa.resources.getResource.mockReturnValue(ref({ data: { uiClassNames: ['text-xl'] } }))

      const { uiClassNames } = useCwaResource(ref('mock-iri'))

      expect(uiClassNames.value).toEqual(['text-xl'])
    })
  })

  describe('getCurrentStyleName', () => {
    test('returns undefined when uiStyles has no classes', () => {
      const mockIri = ref('mock-iri')
      const { getCurrentStyleName } = useCwaResource(mockIri, {})
      const result = getCurrentStyleName({ uiClassNames: ['a', 'b'] } as any)
      expect(result).toBeUndefined()
    })

    test('returns style name when uiClassNames match a class entry', () => {
      const mockIri = ref('mock-iri')
      const { getCurrentStyleName } = useCwaResource(mockIri, {
        styles: { classes: { small: ['text-sm', 'p-2'], large: ['text-lg', 'p-4'] } },
      })
      const result = getCurrentStyleName({ uiClassNames: ['text-lg', 'p-4'] } as any)
      expect(result).toBe('large')
    })

    test('returns undefined when no class entry matches', () => {
      const mockIri = ref('mock-iri')
      const { getCurrentStyleName } = useCwaResource(mockIri, {
        styles: { classes: { small: ['text-sm'] } },
      })
      const result = getCurrentStyleName({ uiClassNames: ['text-xl'] } as any)
      expect(result).toBeUndefined()
    })
  })
})
