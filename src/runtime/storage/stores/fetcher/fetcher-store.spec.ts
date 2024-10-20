import { describe, expect, test, beforeEach, vi } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { FetcherStore } from './fetcher-store'
import actions from './actions'
import state from './state'
import getters from './getters'

vi.mock('./state', () => ({
  default: vi.fn(() => ({ stateKey: 'value' })),
}))

vi.mock('./actions', () => ({
  default: vi.fn(() => ({
    someFunction: vi.fn(),
  })),
}))

vi.mock('./getters')

describe('ApiDocumentationStore tests', () => {
  const returnGetters = {
    someGetter: vi.fn(),
  }
  // @ts-expect-error
  getters.mockImplementation(() => (returnGetters))

  beforeEach(() => {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
    })
    setActivePinia(pinia)
    vi.clearAllMocks()
  })

  test('Store populated with state and actions', () => {
    const store = new FetcherStore('storeName')
    const storeDefinition = store.useStore()

    expect(state).toBeCalledTimes(1)

    // @ts-expect-error
    expect(storeDefinition.stateKey).toBe('value')

    expect(actions).toBeCalledTimes(1)
    expect(actions).toBeCalledWith({ stateKey: 'value' }, returnGetters)
    expect(storeDefinition).toHaveProperty('someFunction')

    expect(getters).toBeCalledTimes(1)
    expect(getters).toBeCalledWith({ stateKey: 'value' })
    expect(storeDefinition).toHaveProperty('someGetter')
  })
})
