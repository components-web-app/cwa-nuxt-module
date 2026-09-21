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
    { manifest: false, fetchComplete: false, manifestError: undefined, result: false },
    { manifest: true, fetchComplete: false, manifestError: undefined, result: true },
    { manifest: true, fetchComplete: true, manifestError: undefined, result: false },
    { manifest: true, fetchComplete: false, manifestError: { message: 'error' }, result: false },
  ])(
    'If manifest is \'$manifest\', fetchComplete is \'$fetchComplete\' and manifest error is \'$manifestError\' then the result should be \'$result\'',
    ({ manifest, fetchComplete, manifestError, result }: { manifest: boolean, fetchComplete: boolean, manifestError: any | undefined, result: boolean },
    ) => {
      const currentFetch: FetchStatus = {
        path: 'any',
        isPrimary: false,
        resources: ['/success-resource', '/not-found-resource'],
      }
      if (manifest) {
        currentFetch.manifest = {
          path: 'any',
          fetchComplete: fetchComplete ? true : undefined,
          error: manifestError,
        }
      }
      state.fetches = {
        'some-token': currentFetch,
      }
      expect(getterUtils.isFetchResolving('some-token')).toBe(result)
    })
})
