import { describe, beforeEach, vi, test, expect } from 'vitest'
import { reactive } from 'vue'
import { ResourcesStore } from '../resources/resources-store'
import { CwaFetcherStateInterface } from './state'
import getters, { CwaFetcherGettersInterface } from './getters'

function createState (): CwaFetcherStateInterface {
  return {
    primaryFetch: reactive({}),
    fetches: reactive({})
  }
}

vi.mock('../resources/resources-store', () => ({
  ResourcesStore: vi.fn(() => ({
    useStore: vi.fn(() => ({
      current: {
        byId: {
          '/success-resource': {
            apiState: {
              status: 1
            }
          },
          '/errored-resource': {
            apiState: {
              status: -1
            }
          },
          '/in-progress-resource': {
            apiState: {
              status: 0
            }
          }
        }
      }
    }))
  }))
}))

describe('FetcherStore getters -> isFetchChainComplete', () => {
  let state: CwaFetcherStateInterface
  let getterFns: CwaFetcherGettersInterface
  let resourcesStore: ResourcesStore

  beforeEach(() => {
    resourcesStore = new ResourcesStore()
    state = createState()
    getterFns = getters(state, resourcesStore)
  })

  test('Return undefined if the token does not exist', () => {
    expect(getterFns.isFetchChainComplete.value('no-token')).toBeUndefined()
  })

  test('Return undefined if no resources in the fetch chain', () => {
    state.fetches = {
      'some-token': {
        path: 'any',
        isPrimary: false,
        resources: []
      }
    }
    expect(getterFns.isFetchChainComplete.value('some-token')).toBeUndefined()
  })

  test('Throws an error if the resource does not exist in the resources store', () => {
    state.fetches = {
      'some-token': {
        path: 'any',
        isPrimary: false,
        resources: ['does-not-exist']
      }
    }
    expect(() => {
      getterFns.isFetchChainComplete.value('some-token')
    }).toThrowError('The resource \'does-not-exist\' does not exist but is defined in the fetch chain with token \'some-token\'')
  })

  test('Returns false if a resource in the fetch chain is still in progress', () => {
    state.fetches = {
      'some-token': {
        path: 'any',
        isPrimary: false,
        resources: ['/success-resource', '/errored-resource', '/in-progress-resource']
      }
    }
    expect(getterFns.isFetchChainComplete.value('some-token')).toBeFalsy()
  })

  test('Returns true if all resources in a completed state', () => {
    state.fetches = {
      'some-token': {
        path: 'any',
        isPrimary: false,
        resources: ['/success-resource', '/errored-resource']
      }
    }
    expect(getterFns.isFetchChainComplete.value('some-token')).toBeTruthy()
  })
})

describe('FetcherStore getters -> isCurrentFetchingToken', () => {
  let state: CwaFetcherStateInterface
  let getterFns: CwaFetcherGettersInterface

  beforeEach(() => {
    state = createState()
    getterFns = getters(state, new ResourcesStore())
  })

  test('Throws an error if the token does not exist', () => {
    expect(() => {
      getterFns.isCurrentFetchingToken.value('some-token')
    }).toThrowError("Failed to check if the token 'some-token' is current. It does not exist.")
  })

  test('Non-primary fetch tokens return true', () => {
    state.fetches = {
      'some-token': {
        path: 'any',
        isPrimary: false,
        resources: ['/success-resource', '/errored-resource']
      }
    }
    expect(getterFns.isCurrentFetchingToken.value('some-token')).toBeTruthy()
  })

  test('Tokens matching an in progress primary fetching token return true', () => {
    state.primaryFetch.fetchingToken = 'some-token'
    state.fetches = {
      'some-token': {
        path: 'any',
        isPrimary: true,
        resources: ['/success-resource', '/errored-resource']
      }
    }
    expect(getterFns.isCurrentFetchingToken.value('some-token')).toBeTruthy()
  })

  test('Tokens not matching the current primary fetching token return false', () => {
    state.primaryFetch.fetchingToken = 'different-token'
    state.fetches = {
      'some-token': {
        path: 'any',
        isPrimary: true,
        resources: ['/success-resource', '/errored-resource']
      }
    }
    expect(getterFns.isCurrentFetchingToken.value('some-token')).toBeFalsy()
  })
})
