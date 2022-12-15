import { describe, beforeEach, vi, test, expect } from 'vitest'
import { reactive } from 'vue'
import { ResourcesStore } from '../resources/resources-store'
import { CwaFetcherStateInterface, TopLevelFetchPathInterface } from './state'
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

describe('FetcherStore getters -> primaryFetchPath', () => {
  let state: CwaFetcherStateInterface
  let getterFns: CwaFetcherGettersInterface

  beforeEach(() => {
    state = createState()
    getterFns = getters(state, new ResourcesStore())
    state.fetches = {
      'token-a': {
        path: 'path-a',
        isPrimary: true,
        resources: []
      },
      'token-b': {
        path: 'path-b',
        isPrimary: true,
        resources: []
      }
    }
  })

  test
    .each([
      { fetchingToken: undefined, successToken: undefined, result: undefined },
      { fetchingToken: 'token-a', successToken: 'token-b', result: 'path-a' },
      { fetchingToken: undefined, successToken: 'token-b', result: 'path-b' },
      { fetchingToken: 'token-a', successToken: undefined, result: 'path-a' }
    ])('If the fetching token is $fetchingToken and the success token is $successToken then the path should be $result', ({ fetchingToken, successToken, result }) => {
      state.primaryFetch.successToken = successToken
      state.primaryFetch.fetchingToken = fetchingToken
      expect(getterFns.primaryFetchPath.value).toBe(result)
    })
})

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
    expect(getterFns.isFetchChainComplete.value('some-token')).toBe(false)
  })

  test('Returns true if all resources in a completed state', () => {
    state.fetches = {
      'some-token': {
        path: 'any',
        isPrimary: false,
        resources: ['/success-resource', '/errored-resource']
      }
    }
    expect(getterFns.isFetchChainComplete.value('some-token')).toBe(true)
  })

  test.each([
    { manifest: false, manifestResources: undefined, manifestError: undefined, result: true },
    { manifest: true, manifestResources: undefined, manifestError: undefined, result: false },
    { manifest: true, manifestResources: ['/some-resource'], manifestError: undefined, result: true },
    { manifest: true, manifestResources: undefined, manifestError: { message: 'error' }, result: true }
  ])(
    "If manifest is '$manifest', manifest resources are '$manifestResources' and manifest error is '$manifestError' then the result should be '$result'",
    ({ manifest, manifestResources, manifestError, result }: { manifest: boolean, manifestResources: undefined|string[], manifestError: any|undefined, result: boolean }
    ) => {
      const currentFetch: TopLevelFetchPathInterface = {
        path: 'any',
        isPrimary: false,
        resources: ['/success-resource', '/errored-resource']
      }
      if (manifest) {
        currentFetch.manifest = {
          path: 'any',
          resources: manifestResources,
          error: manifestError
        }
      }
      state.fetches = {
        'some-token': currentFetch
      }
      expect(getterFns.isFetchChainComplete.value('some-token')).toBe(result)
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
    expect(getterFns.isCurrentFetchingToken.value('some-token')).toBe(true)
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
    expect(getterFns.isCurrentFetchingToken.value('some-token')).toBe(true)
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
    expect(getterFns.isCurrentFetchingToken.value('some-token')).toBe(false)
  })
})
