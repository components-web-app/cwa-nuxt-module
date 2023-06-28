import { describe, expect, test, beforeEach, vi } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { AdminStore } from './admin-store'
import state from './state'

vi.mock('./state', () => ({
  default: vi.fn(() => ({ stateKey: 'value' }))
}))

describe('ManagerStore tests', () => {
  beforeEach(() => {
    const pinia = createTestingPinia({
      createSpy: vi.fn
    })
    setActivePinia(pinia)
    vi.clearAllMocks()
  })

  test('State is set in store', () => {
    const store = new AdminStore('storeName')
    const storeDefinition = store.useStore()

    expect(state).toBeCalledTimes(1)
    // @ts-ignore
    expect(storeDefinition.stateKey).toBe('value')
  })
})
