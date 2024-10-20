import { v4 as uuidv4 } from 'uuid'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, reactive } from 'vue'
import logger from 'consola'
import { createCwaResourceError } from '../../../errors/cwa-resource-error'
import type { CwaFetcherActionsInterface } from './actions'
import actions, { FinishFetchManifestType } from './actions'
import type { CwaFetcherStateInterface, FetchStatus } from './state'
import state from './state'
import type { CwaFetcherGettersInterface } from './getters'
import getters from './getters'

vi.mock('consola')
vi.mock('uuid', () => {
  return {
    v4: vi.fn(() => ('mock-uuid-token')),
  }
})

describe('Fetcher store action -> abortFetch', () => {
  let fetcherActions: CwaFetcherActionsInterface
  let fetcherState: CwaFetcherStateInterface

  let existingFetchState: FetchStatus
  let currentGetters: CwaFetcherGettersInterface

  beforeEach(() => {
    existingFetchState = {
      path: '/existing-path',
      resources: ['/existing-path', '/errored-resource'],
      isPrimary: false,
    }
    fetcherState = state()
    fetcherState.fetches['existing-token'] = reactive(existingFetchState)
    currentGetters = getters(fetcherState)
    fetcherActions = actions(fetcherState, currentGetters)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('An error is thrown if the token does not exist', () => {
    expect(() => {
      fetcherActions.abortFetch({
        token: 'non-existent',
      })
    }).toThrowError('The fetch chain token \'non-existent\' does not exist')
  })

  test('A fetch token can be marked as aborted', () => {
    fetcherActions.abortFetch({
      token: 'existing-token',
    })
    expect(fetcherState.fetches['existing-token'].abort).toBe(true)
  })
})

describe('Fetcher store action -> startFetch', () => {
  let fetcherActions: CwaFetcherActionsInterface
  let fetcherState: CwaFetcherStateInterface

  let existingIncompletePrimaryFetchState: FetchStatus
  let existingCompletedPrimaryFetchState: FetchStatus
  let existingFetchState: FetchStatus
  let currentGetters: CwaFetcherGettersInterface

  beforeEach(() => {
    existingIncompletePrimaryFetchState = {
      path: '/existing-incomplete-primary-path',
      resources: ['/existing-path', '/in-progress-resource'],
      isPrimary: true,
    }
    existingCompletedPrimaryFetchState = {
      path: '/existing-complete-primary-path',
      resources: ['/existing-primary-path', '/existing-path'],
      isPrimary: true,
    }
    existingFetchState = {
      path: '/existing-path',
      resources: ['/existing-path', '/errored-resource'],
      isPrimary: false,
    }
    fetcherState = state()
    fetcherState.primaryFetch.successToken = 'existing-token'
    fetcherState.fetches['existing-incomplete-primary-token'] = reactive(existingIncompletePrimaryFetchState)
    fetcherState.fetches['existing-complete-primary-token'] = reactive(existingCompletedPrimaryFetchState)
    fetcherState.fetches['existing-token'] = reactive(existingFetchState)
    currentGetters = getters(fetcherState)
    fetcherActions = actions(fetcherState, currentGetters)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('If a token is provided we should return the existing status', () => {
    const response = fetcherActions.startFetch({
      path: 'my-path',
      token: 'existing-token',
    })
    expect(uuidv4).not.toHaveBeenCalled()
    expect(fetcherState.fetches['existing-token']).toStrictEqual(existingFetchState)
    expect(response).toStrictEqual({
      continue: true,
      resources: existingFetchState.resources,
      token: 'existing-token',
    })
  })

  test('If a token is provided that does not exist, we should not continue with the request', () => {
    const response = fetcherActions.startFetch({
      path: 'my-path',
      token: 'non-existent',
    })
    expect(response).toStrictEqual({
      continue: false,
      resources: [],
      token: 'non-existent',
    })
    expect(uuidv4).not.toHaveBeenCalled()
  })

  test('A token is generated to start a new fetch chain', () => {
    const startFetchEvent = {
      path: 'my-path',
    }
    const expectedFetchChain = {
      path: startFetchEvent.path,
      resources: [],
      isPrimary: false,
    }
    const response = fetcherActions.startFetch(startFetchEvent)
    expect(uuidv4).toHaveBeenCalledTimes(1)
    expect(fetcherState.fetches['existing-token']).toStrictEqual(existingFetchState)
    expect(fetcherState.fetches['mock-uuid-token']).toStrictEqual(expectedFetchChain)
    expect(response).toStrictEqual({
      continue: true,
      resources: expectedFetchChain.resources,
      token: 'mock-uuid-token',
    })
  })

  test('A manifest path is populated', () => {
    const startFetchEvent = {
      path: 'my-path',
      manifestPath: '/manifest-path',
    }
    const expectedFetchChain = {
      path: startFetchEvent.path,
      resources: [],
      isPrimary: false,
      manifest: {
        path: '/manifest-path',
      },
    }
    const response = fetcherActions.startFetch(startFetchEvent)
    expect(fetcherState.fetches['mock-uuid-token']).toStrictEqual(expectedFetchChain)
    expect(response).toStrictEqual({
      continue: true,
      resources: expectedFetchChain.resources,
      token: 'mock-uuid-token',
    })
  })

  test('Primary fetches will set primaryFetch.fetchingToken', () => {
    const startFetchEvent = {
      path: 'my-path',
      isPrimary: true,
    }
    const expectedFetchChain = {
      path: startFetchEvent.path,
      resources: [],
      isPrimary: true,
    }
    const response = fetcherActions.startFetch(startFetchEvent)
    expect(response).toStrictEqual({
      continue: true,
      resources: expectedFetchChain.resources,
      token: 'mock-uuid-token',
    })
    expect(fetcherState.primaryFetch.fetchingToken).toBe('mock-uuid-token')
    expect(fetcherState.fetches['mock-uuid-token']).toStrictEqual(expectedFetchChain)
  })

  test('If there is already a successful and completed primary fetch with the same path as a new primary fetch we return the last successful fetch token and clear any possible pending primary fetch', () => {
    const startFetchEvent = {
      path: '/existing-complete-primary-path',
      isPrimary: true,
      isCurrentSuccessResourcesResolved: true,
    }
    fetcherState.primaryFetch.successToken = 'existing-complete-primary-token'
    fetcherState.primaryFetch.fetchingToken = 'any-other-primary-fetch-token'

    const response = fetcherActions.startFetch(startFetchEvent)
    expect(fetcherState.primaryFetch.fetchingToken).toBeUndefined()

    for (const fetcherStateKey of Object.keys(fetcherState.fetches)) {
      if (fetcherStateKey !== 'existing-complete-primary-token') {
        expect(fetcherState.fetches[fetcherStateKey].abort).toBe(true)
      }
    }

    expect(response).toStrictEqual({
      continue: false,
      resources: existingCompletedPrimaryFetchState.resources,
      token: 'existing-complete-primary-token',
    })

    expect.assertions(4)
  })

  test('If there is already a successful and but not completed primary fetch with the same path as a new primary fetch we create a new fetch chain token', () => {
    const startFetchEvent = {
      path: '/existing-incomplete-primary-path',
      isPrimary: true,
    }
    fetcherState.primaryFetch.successToken = 'existing-incomplete-primary-token'
    fetcherState.primaryFetch.fetchingToken = 'any-other-primary-fetch-token'

    const response = fetcherActions.startFetch(startFetchEvent)
    expect(fetcherState.primaryFetch.fetchingToken).toBe('mock-uuid-token')
    expect(response).toStrictEqual({
      continue: true,
      resources: [],
      token: 'mock-uuid-token',
    })
  })
})

describe('Fetcher store action -> finishFetch', () => {
  let fetcherActions: CwaFetcherActionsInterface
  let fetcherState: CwaFetcherStateInterface

  let existingPrimaryFetchState: FetchStatus
  let existingFetchState: FetchStatus

  beforeEach(() => {
    existingPrimaryFetchState = {
      path: '/existing-path',
      resources: ['/existing-path', '/errored-resource'],
      isPrimary: true,
    }
    existingFetchState = {
      path: '/existing-path',
      resources: ['/existing-path', '/errored-resource'],
      isPrimary: false,
    }
    fetcherState = state()
    fetcherState.fetches['existing-primary-token'] = reactive(existingPrimaryFetchState)
    fetcherState.fetches['existing-token'] = reactive(existingFetchState)
    fetcherActions = actions(fetcherState, getters(fetcherState))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('If the token does not exist, an error is thrown', () => {
    expect(() => {
      fetcherActions.finishFetch({
        token: 'non-existent',
      })
    }).toThrowError('The fetch chain token \'non-existent\' does not exist')
  })

  test('If the current fetch chain is not primary, we should delete it', () => {
    fetcherActions.finishFetch({
      token: 'existing-token',
    })
    expect(fetcherState.fetches['existing-token']).toBeUndefined()
  })

  test('If the current fetch chain is primary, but the fetch token does not match we should delete it', () => {
    fetcherState.primaryFetch.fetchingToken = 'another-token'
    fetcherActions.finishFetch({
      token: 'existing-primary-token',
    })
    expect(fetcherState.fetches['existing-primary-token']).toBeUndefined()
  })

  test('If the current fetch chain is primary, and the new token matches, we should not delete it', () => {
    fetcherState.primaryFetch.fetchingToken = 'existing-primary-token'
    fetcherActions.finishFetch({
      token: 'existing-primary-token',
    })
    expect(fetcherState.fetches['existing-primary-token']).toStrictEqual(existingPrimaryFetchState)
  })

  test('Delete the fetch chain for a previously successful fetch if this is a new successful primary fetch', () => {
    fetcherState.primaryFetch.fetchingToken = 'existing-primary-token'
    fetcherState.primaryFetch.successToken = 'existing-token'
    fetcherActions.finishFetch({
      token: 'existing-primary-token',
    })
    expect(fetcherState.fetches['existing-token']).toBeUndefined()
  })

  test('The fetching token should be unset, and the success token should be the new token', () => {
    fetcherState.primaryFetch.fetchingToken = 'existing-primary-token'
    fetcherState.primaryFetch.successToken = 'some-token'
    fetcherActions.finishFetch({
      token: 'existing-primary-token',
    })
    expect(fetcherState.primaryFetch.successToken).toBe('existing-primary-token')
    expect(fetcherState.primaryFetch.fetchingToken).toBeUndefined()
  })
})

describe('Fetcher store action -> addFetchResource', () => {
  let fetcherActions: CwaFetcherActionsInterface
  let fetcherState: CwaFetcherStateInterface
  let currentGetters: CwaFetcherGettersInterface

  let existingIncompletePrimaryFetchState: FetchStatus
  let existingCompletedPrimaryFetchState: FetchStatus
  let existingFetchState: FetchStatus

  beforeEach(() => {
    existingIncompletePrimaryFetchState = {
      path: '/existing-incomplete-primary-path',
      resources: ['/existing-path', '/in-progress-resource'],
      isPrimary: true,
    }
    existingCompletedPrimaryFetchState = {
      path: '/existing-complete-primary-path',
      resources: ['/existing-primary-path', '/existing-path'],
      isPrimary: true,
    }
    existingFetchState = {
      path: '/existing-path',
      resources: ['/existing-path', '/errored-resource'],
      isPrimary: false,
    }
    fetcherState = state()
    fetcherState.fetches['existing-incomplete-primary-token'] = reactive(existingIncompletePrimaryFetchState)
    fetcherState.fetches['existing-complete-primary-token'] = reactive(existingCompletedPrimaryFetchState)
    fetcherState.fetches['existing-token'] = reactive(existingFetchState)
    currentGetters = getters(fetcherState)
    fetcherActions = actions(fetcherState, currentGetters)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('If the token does not exist, an error is thrown', () => {
    expect(() => {
      fetcherActions.addFetchResource({
        token: 'non-existent',
        resource: '/my-resource',
      })
    }).toThrowError('The fetch chain token \'non-existent\' does not exist')
  })

  test('If the fetch chain status already contains this resource, return false to stop the duplicate fetch', () => {
    const result = fetcherActions.addFetchResource({
      token: 'existing-token',
      resource: '/existing-path',
    })
    expect(result).toBe(false)
    expect(fetcherState.fetches['existing-token'].resources).toStrictEqual(existingFetchState.resources)
  })

  test('If the current fetch chain is primary, but no longer being fetched, return false, do not fetch - it has been cancelled', () => {
    fetcherState.primaryFetch.fetchingToken = 'changed-fetching-token'
    const result = fetcherActions.addFetchResource({
      token: 'existing-incomplete-primary-token',
      resource: '/existing-path',
    })
    expect(result).toBe(false)
    expect(fetcherState.fetches['existing-token'].resources).toStrictEqual(existingFetchState.resources)
  })

  test('If the token is for a fetch chain that is not primary, even if there is a primary fetch in progress, continue and add', () => {
    // mock is fetch chain complete as true so that we can spy on the method being called. Functionality is tested in getters anyway
    const isCurrentFetchingToken = vi.fn(() => {
      return true
    })
    currentGetters.isCurrentFetchingToken = computed(() => {
      return isCurrentFetchingToken
    })

    fetcherState.primaryFetch.fetchingToken = 'existing-incomplete-primary-token'
    const result = fetcherActions.addFetchResource({
      token: 'existing-token',
      resource: '/another-path-2',
    })

    expect(currentGetters.isCurrentFetchingToken.value).toHaveBeenCalledWith('existing-token')
    expect(result).toBe(true)
    expect(fetcherState.fetches['existing-token'].resources).toStrictEqual([
      '/existing-path',
      '/errored-resource',
      '/another-path-2',
    ])
  })

  test('If the token is for a fetch chain that is already completed status, we add the resource still', () => {
    fetcherState.primaryFetch.fetchingToken = 'existing-complete-primary-token'
    const result = fetcherActions.addFetchResource({
      token: 'existing-complete-primary-token',
      resource: '/another-path-2',
    })
    expect(result).toBe(true)
    expect(fetcherState.fetches['existing-complete-primary-token'].resources).toStrictEqual([
      '/existing-primary-path',
      '/existing-path',
      '/another-path-2',
    ])
  })

  test('If the token is for a fetch chain that is already completed status, and is no longer the fetching token (finished), we add the resource still', () => {
    fetcherState.primaryFetch.successToken = 'existing-complete-primary-token'
    const result = fetcherActions.addFetchResource({
      token: 'existing-complete-primary-token',
      resource: '/another-path-2',
    })
    expect(result).toBe(false)
    expect(fetcherState.fetches['existing-complete-primary-token'].resources).toStrictEqual([
      '/existing-primary-path',
      '/existing-path',
    ])
  })
})

describe('Fetcher store action -> finishManifestFetch', () => {
  let fetcherActions: CwaFetcherActionsInterface
  let fetcherState: CwaFetcherStateInterface

  beforeEach(() => {
    const existingFetchState: FetchStatus = {
      path: '/existing-path',
      resources: ['/existing-path', '/errored-resource'],
      isPrimary: false,
    }
    const existingManifestFetchState: FetchStatus = {
      path: '/existing-path',
      resources: ['/existing-path', '/errored-resource'],
      isPrimary: false,
      manifest: {
        path: '/some-manifest-path',
      },
    }
    fetcherState = state()
    fetcherState.fetches['existing-token-no-manifest'] = reactive(existingFetchState)
    fetcherState.fetches['existing-token-with-manifest'] = reactive(existingManifestFetchState)
    fetcherActions = actions(fetcherState, getters(fetcherState))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('If the token does not exist, a warning is added to the console. No Error as the manifest will always be out of sync with main fetch chain and could lag behind.', () => {
    fetcherActions.finishManifestFetch({
      type: FinishFetchManifestType.SUCCESS,
      token: 'non-existent',
      resources: ['/any'],
    })
    expect(logger.trace).toHaveBeenCalledTimes(1)
    expect(logger.trace).toHaveBeenCalledWith('The fetch chain token \'non-existent\' does not exist')
    expect(fetcherState.fetches['existing-token-with-manifest'].manifest.resources).toBeUndefined()
  })

  test('If a manifest has not been defined for the fetch chain an error is thrown', () => {
    expect(() => {
      fetcherActions.finishManifestFetch({
        type: FinishFetchManifestType.SUCCESS,
        token: 'existing-token-no-manifest',
        resources: ['/any'],
      })
    }).toThrowError('Cannot set manifest status for \'existing-token-no-manifest\'. The manifest was never started.')
  })

  test('Can set the success status on a manifest', () => {
    fetcherActions.finishManifestFetch({
      type: FinishFetchManifestType.SUCCESS,
      token: 'existing-token-with-manifest',
      resources: ['/any'],
    })
    expect(fetcherState.fetches['existing-token-with-manifest'].manifest.path).toBe('/some-manifest-path')
    expect(fetcherState.fetches['existing-token-with-manifest'].manifest.resources).toStrictEqual(['/any'])
  })

  test('Can set the error state on a manifest', () => {
    const newError = createCwaResourceError(new Error('My error message'))
    fetcherActions.finishManifestFetch({
      type: FinishFetchManifestType.ERROR,
      token: 'existing-token-with-manifest',
      error: newError,
    })
    expect(fetcherState.fetches['existing-token-with-manifest'].manifest.path).toBe('/some-manifest-path')
    expect(fetcherState.fetches['existing-token-with-manifest'].manifest.error).toStrictEqual(newError.asObject)
  })
})
