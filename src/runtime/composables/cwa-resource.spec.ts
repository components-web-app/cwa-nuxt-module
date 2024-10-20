import { describe, expect, vi, test } from 'vitest'
import { ref } from 'vue'
import * as cwaComposable from '#cwa/runtime/composables/cwa'
import * as cwaResourceManageable from '#cwa/runtime/composables/cwa-resource-manageable'
import { useCwaResource } from '#cwa/runtime/composables/cwa-resource'

vi.mock('vue', async () => {
  const mod = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...mod,
    onMounted: vi.fn(fn => fn()),
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
})
