import { describe, expect, test, beforeEach, vi } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import actions from './actions'
import state from './state'
import { ResourcesStore } from './resources-store'
import getters from './getters'

vi.mock('./state', () => ({
  default: vi.fn(() => ({ stateKey: 'value' }))
}))

vi.mock('./actions', () => ({
  default: vi.fn(() => ({
    someFunction: vi.fn()
  }))
}))

vi.mock('./getters', () => ({
  default: vi.fn(() => ({
    someGetter: vi.fn()
  }))
}))

describe('ResourcesStore tests', () => {
  beforeEach(() => {
    const pinia = createTestingPinia({
      createSpy: vi.fn
    })
    setActivePinia(pinia)
    vi.clearAllMocks()
  })

  test('Store populated with state, getters and actions', () => {
    const store = new ResourcesStore('storeName')
    const storeDefinition = store.useStore()

    expect(state).toBeCalledTimes(1)

    // @ts-ignore
    expect(storeDefinition.stateKey).toBe('value')

    expect(actions).toBeCalledTimes(1)
    expect(actions).toBeCalledWith({ stateKey: 'value' }, getters.mock.results[0].value)
    expect(storeDefinition).toHaveProperty('someFunction')

    expect(getters).toBeCalledTimes(1)
    expect(getters).toBeCalledWith({ stateKey: 'value' })
    expect(storeDefinition).toHaveProperty('someGetter')
  })
})
