import { describe, expect, vi, test } from 'vitest'
import * as vue from 'vue'
import * as cwaComposable from '#cwa/runtime/composables/cwa'
import * as cwaResourceManageable from '#cwa/runtime/composables/cwa-resource-manageable'
import { useCwaResource } from '#cwa/runtime/composables/cwa-resource'

describe('CWA resources composable', () => {
  const mockCwa = {
    admin: {
      eventBus: {
        emit: vi.fn()
      }
    },
    resources: {
      getResource: vi.fn()
    }
  }
  const mockManager = { mock: 'manager' }

  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => mockCwa)
  vi.spyOn(vue, 'onMounted').mockImplementation(fn => fn())

  test('should return an object with manager IF no disabling option is provided', () => {
    const spy = vi.spyOn(cwaResourceManageable, 'useCwaResourceManageable').mockImplementation(() => mockManager)
    const mockIri = 'mock-iri'
    const result = useCwaResource(mockIri)

    expect(result.manager).toEqual(mockManager)
    expect(spy).toHaveBeenCalledWith(mockIri, undefined)
  })

  test('should return an object with manager as undefined IF disabling option is provided', () => {
    const spy = vi.spyOn(cwaResourceManageable, 'useCwaResourceManageable').mockImplementation(() => mockManager)
    const mockIri = 'mock-iri'
    const result = useCwaResource(mockIri, { manager: { disabled: true } })

    expect(result).toHaveProperty('manager')
    expect(result.manager).toBeUndefined()
    expect(spy).not.toHaveBeenCalled()
  })

  test('should emit an eventbus event on mounted', () => {
    vi.spyOn(cwaResourceManageable, 'useCwaResourceManageable').mockImplementation(() => mockManager)
    const mockIri = 'mock-iri'

    useCwaResource(mockIri)

    expect(mockCwa.admin.eventBus.emit).toHaveBeenCalledWith('componentMounted', mockIri)
  })

  test('should return object containing function to get resource by iri provided into composable', () => {
    vi.spyOn(cwaResourceManageable, 'useCwaResourceManageable').mockImplementation(() => mockManager)

    const mockIri = 'mock-iri'
    const mockResource = { mock: 'resource' }

    const result = useCwaResource(mockIri)

    mockCwa.resources.getResource.mockReturnValueOnce(mockResource)

    expect(result.getResource).toBeDefined()
    expect(result.getResource()).toEqual(mockResource)
    expect(mockCwa.resources.getResource).toHaveBeenCalledWith(mockIri)
  })
})
