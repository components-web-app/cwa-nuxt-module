import { describe, expect, test, beforeEach, vi } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { MercureStore } from './mercure-store'
import state from './state'

vi.mock('./state', () => ({
  default: vi.fn(() => ({ stateKey: 'value' })),
}))

describe('MercureStore tests', () => {
  beforeEach(() => {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
    })
    setActivePinia(pinia)
    vi.clearAllMocks()
  })

  test('State is set in store', () => {
    const store = new MercureStore('storeName')
    const storeDefinition = store.useStore()

    expect(state).toBeCalledTimes(1)
    // @ts-expect-error
    expect(storeDefinition.stateKey).toBe('value')
  })
})
