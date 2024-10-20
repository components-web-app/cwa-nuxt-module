import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { reactive } from 'vue'
import type { CwaFetcherStateInterface, FetchStatus } from './state'
import { FetcherGetterUtils } from './getter-utils'

function createState(): CwaFetcherStateInterface {
  return {
    primaryFetch: reactive({}),
    fetches: reactive({}),
  }
}

describe('FetcherStore getters -> getFetchStatusByToken', () => {
  let state: CwaFetcherStateInterface
  let getterUtils: FetcherGetterUtils

  beforeEach(() => {
    state = createState()
    getterUtils = new FetcherGetterUtils(state)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('Return undefined if the token does not exist', () => {
    expect(getterUtils.getFetchStatusByToken('does-not-exist')).toBeUndefined()
  })

  test('Return the fetch status if it exists', () => {
    const fetchStatus = {
      path: 'any',
      isPrimary: false,
      resources: [],
    }
    state.fetches = {
      'some-token': fetchStatus,
    }
    expect(getterUtils.getFetchStatusByToken('some-token')).toStrictEqual(fetchStatus)
  })
})

// utils
describe('FetcherStore getters -> isFetchResolving', () => {
  let state: CwaFetcherStateInterface
  let getterUtils: FetcherGetterUtils

  beforeEach(() => {
    state = createState()
    state.primaryFetch.successToken = 'success-token'
    getterUtils = new FetcherGetterUtils(state)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('Return false if the token does not exist', () => {
    expect(getterUtils.isFetchResolving('no-token')).toBe(false)
  })

  test('Returns false if the fetch chain is aborted', () => {
    state.fetches = {
      'some-token': {
        path: 'any',
        isPrimary: false,
        resources: ['/success-resource', '/not-found-resource'],
        abort: true,
      },
    }
    expect(getterUtils.isFetchResolving('some-token')).toBe(false)
  })

  test('Return false if no resources in the fetch status', () => {
    state.fetches = {
      'some-token': {
        path: 'any',
        isPrimary: false,
        resources: [],
      },
    }
    expect(getterUtils.isFetchResolving('some-token')).toBe(false)
  })

  test.each([
    { manifest: false, manifestResources: undefined, manifestError: undefined, result: false },
    { manifest: true, manifestResources: undefined, manifestError: undefined, result: true },
    { manifest: true, manifestResources: ['/some-resource'], manifestError: undefined, result: false },
    { manifest: true, manifestResources: undefined, manifestError: { message: 'error' }, result: false },
  ])(
    'If manifest is \'$manifest\', manifest resources are \'$manifestResources\' and manifest error is \'$manifestError\' then the result should be \'$result\'',
    ({ manifest, manifestResources, manifestError, result }: { manifest: boolean, manifestResources: undefined | string[], manifestError: any | undefined, result: boolean },
    ) => {
      const currentFetch: FetchStatus = {
        path: 'any',
        isPrimary: false,
        resources: ['/success-resource', '/not-found-resource'],
      }
      if (manifest) {
        currentFetch.manifest = {
          path: 'any',
          resources: manifestResources,
          error: manifestError,
        }
      }
      state.fetches = {
        'some-token': currentFetch,
      }
      expect(getterUtils.isFetchResolving('some-token')).toBe(result)
    })
})
