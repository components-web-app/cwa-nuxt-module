import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { reactive } from 'vue'
import { CwaFetcherStateInterface } from './state'
import getters, { CwaFetcherGettersInterface } from './getters'

function createState (): CwaFetcherStateInterface {
  return {
    primaryFetch: reactive({}),
    fetches: reactive({})
  }
}

describe.todo('FetcherStore getters -> resolvedSuccessFetchStatus', () => {
  let state: CwaFetcherStateInterface
  let getterFns: CwaFetcherGettersInterface

  beforeEach(() => {
    state = createState()
    state.primaryFetch.successToken = 'success-token'
    getterFns = getters(state)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test.todo('Return false if no resources in the fetch status', () => {
    state.fetches = {
      'success-token': {
        path: 'any',
        isPrimary: false,
        resources: []
      }
    }
    expect(getterFns.resolvedSuccessFetchStatus.value).toBe(false)
  })

  test.todo.each([
    { manifest: false, manifestResources: undefined, manifestError: undefined, result: true },
    { manifest: true, manifestResources: undefined, manifestError: undefined, result: false },
    { manifest: true, manifestResources: ['                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      vv                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              /some-resource'], manifestError: undefined, result: true },
    { manifest: true, manifestResources: undefined, manifestError: { message: 'error' }, result: true }
  ])(
    "If manifest exist status is '$manifest', manifest resources are '$manifestResources' and manifest error is '$manifestError' then the result should be '$result'",
    ({ manifest, manifestResources, manifestError, result }: { manifest: boolean, manifestResources: undefined|string[], manifestError: any|undefined, result: boolean }
    ) => {
      const currentFetch: FetchStatus = {
        path: '/success-resource',
        isPrimary: false,
        resources: ['/success-resource', '/not-found-resource']
      }
      if (manifest) {
        currentFetch.manifest = {
          path: 'any',
          resources: manifestResources,
          error: manifestError
        }
      }
      state.fetches = {
        'success-token': currentFetch
      }
      expect(getterFns.resolvedSuccessFetchStatus.value).toBe(result)
    })
})

// utils
describe.todo('FetcherStore getters -> isFetchResolving', () => {
  let state: CwaFetcherStateInterface
  let getterFns: CwaFetcherGettersInterface

  beforeEach(() => {
    state = createState()
    state.primaryFetch.successToken = 'success-token'
    getterFns = getters(state)
  })

  test('Return false if the token does not exist', () => {
    expect(getterFns.isFetchChainComplete.value('no-token')).toBe(false)
  })

  test('Return false if no resources in the fetch chain', () => {
    state.fetches = {
      'some-token': {
        path: 'any',
        isPrimary: false,
        resources: []
      }
    }
    expect(getterFns.isFetchChainComplete.value('some-token')).toBe(false)
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
        resources: ['/success-resource', '/not-found-resource', '/in-progress-resource']
      }
    }
    expect(getterFns.isFetchChainComplete.value('some-token')).toBe(false)
  })

  test('Returns true if the fetch chain is aborted', () => {
    state.fetches = {
      'some-token': {
        path: 'any',
        isPrimary: false,
        resources: ['/success-resource', '/not-found-resource'],
        abort: true
      }
    }
    expect(getterFns.isFetchChainComplete.value('some-token')).toBe(true)
  })

  test('Returns false is the fetch is primary but not a current or successful primary fetch', () => {
    state.fetches = {
      'some-token': {
        path: 'any',
        isPrimary: true,
        resources: ['/success-resource', '/not-found-resource']
      }
    }
    expect(getterFns.isFetchChainComplete.value('some-token')).toBe(false)
  })

  test('Returns true if all resources in a completed state', () => {
    state.fetches = {
      'some-token': {
        path: 'any',
        isPrimary: false,
        resources: ['/success-resource', '/not-found-resource']
      }
    }
    expect(getterFns.isFetchChainComplete.value('some-token')).toBe(true)
  })

  test('Returns true if all resources in a completed state and primary successful token test', () => {
    state.primaryFetch.successToken = 'some-token'
    state.fetches = {
      'some-token': {
        path: 'any',
        isPrimary: true,
        resources: ['/success-resource', '/not-found-resource']
      }
    }
    expect(getterFns.isFetchChainComplete.value('some-token')).toBe(true)
  })

  test('Returns true if all resources in a completed state and primary fetching token test', () => {
    state.primaryFetch.fetchingToken = 'some-token'
    state.fetches = {
      'some-token': {
        path: 'any',
        isPrimary: true,
        resources: ['/success-resource', '/not-found-resource']
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
      const currentFetch: FetchStatus = {
        path: 'any',
        isPrimary: false,
        resources: ['/success-resource', '/not-found-resource']
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
