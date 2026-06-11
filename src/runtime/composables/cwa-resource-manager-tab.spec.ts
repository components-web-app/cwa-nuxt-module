// @vitest-environment happy-dom
import { describe, expect, test, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useCwaResourceManagerTab } from '#cwa/composables/cwa-resource-manager-tab'

// vi.hoisted runs before imports, so we cannot use `ref` from vue inside it.
// Use a plain object with a .value property to satisfy the ref contract for tests.
const mockCurrentIriObj = vi.hoisted(() => ({ value: '/current/resource' as string | undefined }))
const mockResourceStackManager = vi.hoisted(() => ({
  currentIri: mockCurrentIriObj,
  getState: vi.fn(),
  setState: vi.fn(),
}))
const mockGetResource = vi.hoisted(() => vi.fn())

vi.mock('#cwa/composables/cwa', () => ({
  useCwa: () => ({
    admin: { resourceStackManager: mockResourceStackManager },
    resources: { getResource: mockGetResource },
  }),
}))

describe('useCwaResourceManagerTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCurrentIriObj.value = '/current/resource'
    mockGetResource.mockReturnValue(ref(undefined))
  })

  describe('exposeMeta', () => {
    test('sets name from options', () => {
      const { exposeMeta } = useCwaResourceManagerTab({ name: 'General' })
      expect(exposeMeta.name).toBe('General')
    })

    test('sets order from options', () => {
      const { exposeMeta } = useCwaResourceManagerTab({ name: 'General', order: 10 })
      expect(exposeMeta.order).toBe(10)
    })

    test('disabled defaults to false ref', () => {
      const { exposeMeta } = useCwaResourceManagerTab({ name: 'General' })
      expect(exposeMeta.disabled.value).toBe(false)
    })

    test('disabled is true when options.disabled is true', () => {
      const { exposeMeta } = useCwaResourceManagerTab({ name: 'General', disabled: true })
      expect(exposeMeta.disabled.value).toBe(true)
    })
  })

  describe('iri', () => {
    test('returns the current stack manager IRI', () => {
      mockCurrentIriObj.value = '/current/resource'
      const { iri } = useCwaResourceManagerTab({ name: 'General' })
      expect(iri.value).toBe('/current/resource')
    })
  })

  describe('createComputedState', () => {
    test('reads state from resourceStackManager.getState', () => {
      mockResourceStackManager.getState.mockReturnValue('stored-value')
      const { createComputedState } = useCwaResourceManagerTab({ name: 'General' })
      const state = createComputedState('myProp')
      expect(state.value).toBe('stored-value')
    })

    test('writes to resourceStackManager.setState', () => {
      mockResourceStackManager.getState.mockReturnValue(undefined)
      const { createComputedState } = useCwaResourceManagerTab({ name: 'General' })
      const state = createComputedState('myProp')
      state.value = 'new-value'
      expect(mockResourceStackManager.setState).toHaveBeenCalledWith('myProp', 'new-value')
    })

    test('sets initial value when current state is undefined and initialValue provided', () => {
      mockResourceStackManager.getState.mockReturnValue(undefined)
      const { createComputedState } = useCwaResourceManagerTab({ name: 'General' })
      createComputedState('myProp', 'default')
      expect(mockResourceStackManager.setState).toHaveBeenCalledWith('myProp', 'default')
    })

    test('does not overwrite existing state with initial value', () => {
      mockResourceStackManager.getState.mockReturnValue('existing')
      const { createComputedState } = useCwaResourceManagerTab({ name: 'General' })
      createComputedState('myProp', 'default')
      expect(mockResourceStackManager.setState).not.toHaveBeenCalled()
    })
  })
})
