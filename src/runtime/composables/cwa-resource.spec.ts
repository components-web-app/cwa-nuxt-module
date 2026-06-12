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
