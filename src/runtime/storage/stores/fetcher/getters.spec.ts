import { describe, beforeEach, vi, test, expect, afterEach } from 'vitest'
import { reactive } from 'vue'
import { CwaFetcherStateInterface } from './state'
import getters, { CwaFetcherGettersInterface } from './getters'
import { FetcherGetterUtils } from './getter-utils'

vi.mock('./getter-utils', () => {
  return {
    FetcherGetterUtils: vi.fn(() => ({
      getFetchStatusByToken: vi.fn(),
      isFetchResolving: vi.fn()
    }))
  }
})

function createState (): CwaFetcherStateInterface {
  return {
    primaryFetch: reactive({}),
    fetches: reactive({})
  }
}

describe('FetcherStore getters -> primaryFetchPath', () => {
  let state: CwaFetcherStateInterface
  let getterFns: CwaFetcherGettersInterface

  beforeEach(() => {
    state = createState()
    getterFns = getters(state)
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

describe('FetcherStore getters -> resolvedSuccessFetchStatus', () => {
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

  test('Return undefined if there is no primary success token', () => {
    state.primaryFetch.successToken = undefined
    expect(getterFns.resolvedSuccessFetchStatus.value).toBeUndefined()
  })

  test('Return undefined if the token does not exist', () => {
    state.primaryFetch.successToken = 'does-not-exist'
    expect(getterFns.resolvedSuccessFetchStatus.value).toBeUndefined()
  })

  test.each([
    { isFetchResolving: false, returnFetchStatus: true, result: 'result' },
    { isFetchResolving: true, returnFetchStatus: false, result: undefined },
    { isFetchResolving: false, returnFetchStatus: false, result: undefined }
  ])('If isFetchResolving is $isFetchResolving and getFetchStatusByToken is $getFetchStatusByToken return $result', ({ isFetchResolving, returnFetchStatus, result }) => {
    const utils = FetcherGetterUtils.mock.results[0].value
    const expected = returnFetchStatus ? result : undefined
    vi.spyOn(utils, 'getFetchStatusByToken').mockImplementationOnce(() => {
      return expected
    })
    vi.spyOn(utils, 'isFetchResolving').mockImplementationOnce(() => {
      return isFetchResolving
    })
    expect(getterFns.resolvedSuccessFetchStatus.value).toBe(expected)
  })
})

describe('FetcherStore getters -> fetchesResolved', () => {
  let state: CwaFetcherStateInterface
  let getterFns: CwaFetcherGettersInterface

  beforeEach(() => {
    state = createState()
    getterFns = getters(state)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test.each([
    {
      data: {
        something: {},
        resolving: {}
      },
      result: false
    },
    {
      data: {
        something: {}
      },
      result: true
    }
  ])('If data is $data the fetchesResolved result should be $result', ({
    data,
    result
  }) => {
    state.fetches = data
    const utils = FetcherGetterUtils.mock.results[0].value
    vi.spyOn(utils, 'isFetchResolving').mockImplementation((token) => {
      return token === 'resolving'
    })
    expect(getterFns.fetchesResolved.value).toBe(result)
  })
})

describe('FetcherStore getters -> isFetchResolving', () => {
  let state: CwaFetcherStateInterface
  let getterFns: CwaFetcherGettersInterface

  beforeEach(() => {
    state = createState()
    getterFns = getters(state)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('Returns values from utilities', () => {
    const utils = FetcherGetterUtils.mock.results[0].value
    vi.spyOn(utils, 'isFetchResolving').mockImplementation(() => {
      return 'isResolving'
    })
    vi.spyOn(utils, 'getFetchStatusByToken').mockImplementation(() => {
      return 'fetchStatusResult'
    })
    expect(getterFns.isFetchResolving.value('any-token')).toStrictEqual({
      fetchStatus: 'fetchStatusResult',
      resolving: 'isResolving'
    })
    expect(utils.isFetchResolving).toHaveBeenCalledWith('any-token')
    expect(utils.getFetchStatusByToken).toHaveBeenCalledWith('any-token')
  })
})

describe('FetcherStore getters -> isCurrentFetchingToken', () => {
  let state: CwaFetcherStateInterface
  let getterFns: CwaFetcherGettersInterface

  beforeEach(() => {
    state = createState()
    getterFns = getters(state)
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
        resources: ['/success-resource', '/not-found-resource']
      }
    }
    expect(getterFns.isCurrentFetchingToken.value('some-token')).toBe(true)
  })

  test('Aborted fetch tokens return false', () => {
    state.fetches = {
      'some-token': {
        path: 'any',
        isPrimary: false,
        resources: ['/success-resource', '/not-found-resource'],
        abort: true
      }
    }
    expect(getterFns.isCurrentFetchingToken.value('some-token')).toBe(false)
  })

  test('Tokens matching an in progress primary fetching token return true', () => {
    state.primaryFetch.fetchingToken = 'some-token'
    state.fetches = {
      'some-token': {
        path: 'any',
        isPrimary: true,
        resources: ['/success-resource', '/not-found-resource']
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
        resources: ['/success-resource', '/not-found-resource']
      }
    }
    expect(getterFns.isCurrentFetchingToken.value('some-token')).toBe(false)
  })
})
