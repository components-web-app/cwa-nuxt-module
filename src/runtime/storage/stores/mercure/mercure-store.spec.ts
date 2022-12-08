import { describe, expect, test, beforeEach, vi } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { MercureStore } from './mercure-store'

describe('MercureStore tests', () => {
  beforeEach(() => {
    const pinia = createTestingPinia({
      createSpy: vi.fn
    })
    setActivePinia(pinia)
    vi.clearAllMocks()
  })

  test('Initial state', () => {
    const store = new MercureStore('storeName')
    const storeDefinition = store.useStore()
    expect(storeDefinition.hub).toBeNull()
    expect(storeDefinition.$state).toStrictEqual({
      hub: null
    })
  })
})
