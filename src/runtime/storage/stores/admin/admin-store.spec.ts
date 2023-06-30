import { describe, expect, test, beforeEach, vi } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { AdminStore } from './admin-store'
import state from './state'
import actions from './actions'
vi.mock('./state', () => ({
  default: vi.fn(() => ({ stateKey: 'value' }))
}))

vi.mock('./actions', () => ({
  default: vi.fn(() => ({
    someFunction: vi.fn()
  }))
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

    expect(actions).toBeCalledTimes(1)
    expect(actions).toBeCalledWith({ stateKey: 'value' })
    expect(storeDefinition).toHaveProperty('someFunction')
  })
})
