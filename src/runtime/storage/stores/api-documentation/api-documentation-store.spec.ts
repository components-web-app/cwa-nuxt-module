import { describe, expect, test, beforeEach, vi } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { ApiDocumentationStore } from './api-documentation-store'
import state from './state'

vi.mock('./state', () => ({
  default: vi.fn(() => ({ stateKey: 'value' })),
}))

describe('ApiDocumentationStore tests', () => {
  beforeEach(() => {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
    })
    setActivePinia(pinia)
    vi.clearAllMocks()
  })

  test('Initial state', () => {
    const store = new ApiDocumentationStore('storeName')
    const storeDefinition = store.useStore()

    expect(state).toBeCalledTimes(1)
    // @ts-expect-error
    expect(storeDefinition.stateKey).toBe('value')
  })
})
