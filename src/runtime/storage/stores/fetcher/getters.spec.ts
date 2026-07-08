import { describe, beforeEach, vi, test, expect, afterEach } from 'vitest'
import { reactive } from 'vue'
import type { CwaFetcherStateInterface } from './state'
import type { CwaFetcherGettersInterface } from './getters'
import getters from './getters'
import { FetcherGetterUtils } from './getter-utils'

const fetcherGetterUtilsMock = {
  getFetchStatusByToken: vi.fn(),
  isFetchResolving: vi.fn(),
}
vi.mock('./getter-utils', () => {
  return {
    FetcherGetterUtils: vi.fn(function () {
      return fetcherGetterUtilsMock
    }),
  }
})

function createState(): CwaFetcherStateInterface {
  return {
    primaryFetch: reactive({}),
    fetches: reactive({}),
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
        resources: [],
      },
      'token-b': {
        path: 'path-b',
        isPrimary: true,
        resources: [],
      },
    }
  })

  test
    .each([
      { fetchingToken: undefined, successToken: undefined, result: undefined },
      { fetchingToken: 'token-a', successToken: 'token-b', result: 'path-a' },
      { fetchingToken: undefined, successToken: 'token-b', result: 'path-b' },
      { fetchingToken: 'token-a', successToken: undefined, result: 'path-a' },
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
    FetcherGetterUtils.mockRestore()
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
    { isFetchResolving: false, returnFetchStatus: false, result: undefined },
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

describe('FetcherStore getters -> resolvedDisplayFetchStatus', () => {
  let state: CwaFetcherStateInterface
  let getterFns: CwaFetcherGettersInterface

  beforeEach(() => {
    state = createState()
    getterFns = getters(state)
    fetcherGetterUtilsMock.getFetchStatusByToken.mockReset()
    fetcherGetterUtilsMock.isFetchResolving.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('Prefers the displayed token status when set', () => {
    state.primaryFetch.displayedToken = 'displayed-token'
    state.primaryFetch.successToken = 'success-token'
    const displayedStatus = { path: '/displayed' }
    fetcherGetterUtilsMock.getFetchStatusByToken.mockImplementation((token: string) => (token === 'displayed-token' ? displayedStatus : { path: '/success' }))
    expect(getterFns.resolvedDisplayFetchStatus.value).toBe(displayedStatus)
    // does not need to consult the success token / resolving state when a displayed token resolves
    expect(fetcherGetterUtilsMock.isFetchResolving).not.toHaveBeenCalled()
  })

  test('Falls back to the resolved success token when nothing is displayed', () => {
    state.primaryFetch.successToken = 'success-token'
    const successStatus = { path: '/success' }
    fetcherGetterUtilsMock.getFetchStatusByToken.mockImplementation(() => successStatus)
    fetcherGetterUtilsMock.isFetchResolving.mockImplementation(() => false)
    expect(getterFns.resolvedDisplayFetchStatus.value).toBe(successStatus)
  })

  test('Falls back to success but returns undefined while the success token is still resolving', () => {
    state.primaryFetch.successToken = 'success-token'
    fetcherGetterUtilsMock.getFetchStatusByToken.mockImplementation(() => ({ path: '/success' }))
    fetcherGetterUtilsMock.isFetchResolving.mockImplementation(() => true)
    expect(getterFns.resolvedDisplayFetchStatus.value).toBeUndefined()
  })

  test('Falls back to success when the displayed token no longer exists', () => {
    state.primaryFetch.displayedToken = 'gone'
    state.primaryFetch.successToken = 'success-token'
    const successStatus = { path: '/success' }
    fetcherGetterUtilsMock.getFetchStatusByToken.mockImplementation((token: string) => (token === 'gone' ? undefined : successStatus))
    fetcherGetterUtilsMock.isFetchResolving.mockImplementation(() => false)
    expect(getterFns.resolvedDisplayFetchStatus.value).toBe(successStatus)
  })

  test('Returns undefined when neither displayed nor success token is set', () => {
    expect(getterFns.resolvedDisplayFetchStatus.value).toBeUndefined()
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
        resolving: {},
      },
      result: false,
    },
    {
      data: {
        something: {},
      },
      result: true,
    },
  ])('If data is $data the fetchesResolved result should be $result', ({
    data,
    result,
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
      resolving: 'isResolving',
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
    }).toThrowError('Failed to check if the token \'some-token\' is current. It does not exist.')
  })

  test('Non-primary fetch tokens return true', () => {
    state.fetches = {
      'some-token': {
        path: 'any',
        isPrimary: false,
        resources: ['/success-resource', '/not-found-resource'],
      },
    }
    expect(getterFns.isCurrentFetchingToken.value('some-token')).toBe(true)
  })

  test('Aborted fetch tokens return false', () => {
    state.fetches = {
      'some-token': {
        path: 'any',
        isPrimary: false,
        resources: ['/success-resource', '/not-found-resource'],
        abort: true,
      },
    }
    expect(getterFns.isCurrentFetchingToken.value('some-token')).toBe(false)
  })

  test('Tokens matching an in progress primary fetching token return true', () => {
    state.primaryFetch.fetchingToken = 'some-token'
    state.fetches = {
      'some-token': {
        path: 'any',
        isPrimary: true,
        resources: ['/success-resource', '/not-found-resource'],
      },
    }
    expect(getterFns.isCurrentFetchingToken.value('some-token')).toBe(true)
  })

  test('Tokens not matching the current primary fetching token return false', () => {
    state.primaryFetch.fetchingToken = 'different-token'
    state.fetches = {
      'some-token': {
        path: 'any',
        isPrimary: true,
        resources: ['/success-resource', '/not-found-resource'],
      },
    }
    expect(getterFns.isCurrentFetchingToken.value('some-token')).toBe(false)
  })
})
