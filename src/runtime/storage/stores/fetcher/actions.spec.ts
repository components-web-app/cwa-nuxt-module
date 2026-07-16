import { v4 as uuidv4 } from 'uuid'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, reactive } from 'vue'
import { consola as logger } from 'consola'
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
      timestamp: 0,
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
    expect(fetcherState.fetches['existing-token'].abortReason).toBeUndefined()
  })

  test('A fetch token can be marked as aborted with a reason', () => {
    fetcherActions.abortFetch({
      token: 'existing-token',
      reason: 'redirect',
    })
    expect(fetcherState.fetches['existing-token'].abort).toBe(true)
    expect(fetcherState.fetches['existing-token'].abortReason).toBe('redirect')
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
      timestamp: 0,
    }
    existingCompletedPrimaryFetchState = {
      path: '/existing-complete-primary-path',
      resources: ['/existing-primary-path', '/existing-path'],
      isPrimary: true,
      timestamp: 0,
    }
    existingFetchState = {
      path: '/existing-path',
      resources: ['/existing-path', '/errored-resource'],
      isPrimary: false,
      timestamp: 0,
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
    vi.useFakeTimers()
    const startFetchEvent = {
      path: 'my-path',
    }
    const expectedFetchChain = {
      path: startFetchEvent.path,
      resources: [],
      isPrimary: false,
      timestamp: (vi.getMockedSystemTime()).getTime(),
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
    vi.useRealTimers()
  })

  test('A manifest path is populated', () => {
    vi.useFakeTimers()
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
      timestamp: (vi.getMockedSystemTime()).getTime(),
    }
    const response = fetcherActions.startFetch(startFetchEvent)
    expect(fetcherState.fetches['mock-uuid-token']).toStrictEqual(expectedFetchChain)
    expect(response).toStrictEqual({
      continue: true,
      resources: expectedFetchChain.resources,
      token: 'mock-uuid-token',
    })
    vi.useRealTimers()
  })

  test('Primary fetches will set primaryFetch.fetchingToken', () => {
    vi.useFakeTimers()
    const startFetchEvent = {
      path: 'my-path',
      isPrimary: true,
    }
    const expectedFetchChain = {
      path: startFetchEvent.path,
      resources: [],
      isPrimary: true,
      timestamp: (vi.getMockedSystemTime()).getTime(),
    }
    const response = fetcherActions.startFetch(startFetchEvent)
    expect(response).toStrictEqual({
      continue: true,
      resources: expectedFetchChain.resources,
      token: 'mock-uuid-token',
    })
    expect(fetcherState.primaryFetch.fetchingToken).toBe('mock-uuid-token')
    expect(fetcherState.fetches['mock-uuid-token']).toStrictEqual(expectedFetchChain)
    vi.useRealTimers()
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
      timestamp: 0,
    }
    existingFetchState = {
      path: '/existing-path',
      resources: ['/existing-path', '/errored-resource'],
      isPrimary: false,
      timestamp: 0,
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

  describe('displayed token (last-displayed retention #256)', () => {
    test('On promotion the displayed token advances to the new success token', () => {
      fetcherState.primaryFetch.fetchingToken = 'existing-primary-token'
      fetcherActions.finishFetch({ token: 'existing-primary-token' })
      expect(fetcherState.primaryFetch.displayedToken).toBe('existing-primary-token')
    })

    test('On promotion a previously-displayed superseded fetch is cleaned up', () => {
      fetcherState.fetches['held-token'] = reactive({ path: '/held', resources: ['/held'], isPrimary: true, timestamp: 0 })
      fetcherState.primaryFetch.fetchingToken = 'existing-primary-token'
      fetcherState.primaryFetch.displayedToken = 'held-token'
      fetcherActions.finishFetch({ token: 'existing-primary-token' })
      expect(fetcherState.primaryFetch.displayedToken).toBe('existing-primary-token')
      expect(fetcherState.fetches['held-token']).toBeUndefined()
    })

    test('A held displayed fetch is NOT deleted when it is also the finishing success token being retained', () => {
      // displayed = the currently shown page; a non-primary chain finishing must not remove it
      fetcherState.primaryFetch.displayedToken = 'existing-token'
      fetcherActions.finishFetch({ token: 'existing-token' })
      expect(fetcherState.fetches['existing-token']).toStrictEqual(existingFetchState)
    })
  })

  describe('redirect retention (flash fix)', () => {
    test('A primary fetch aborted as a redirect does not become the success token and the previous success page is retained', () => {
      // page A is currently displayed
      fetcherState.primaryFetch.successToken = 'existing-token'
      // the redirect fetch is the current fetching token and was aborted as a redirect
      fetcherState.primaryFetch.fetchingToken = 'existing-primary-token'
      existingPrimaryFetchState.abort = true
      existingPrimaryFetchState.abortReason = 'redirect'

      fetcherActions.finishFetch({
        token: 'existing-primary-token',
      })

      // previous success page A is kept on screen, untouched
      expect(fetcherState.primaryFetch.successToken).toBe('existing-token')
      expect(fetcherState.fetches['existing-token']).toStrictEqual(existingFetchState)
      // the redirect fetch is cleared out and never displayed
      expect(fetcherState.primaryFetch.fetchingToken).toBeUndefined()
      expect(fetcherState.fetches['existing-primary-token']).toBeUndefined()
    })

    test('A primary fetch aborted WITHOUT a redirect reason (e.g. superseded/stale) still promotes normally — only redirects are retained', () => {
      fetcherState.primaryFetch.successToken = 'existing-token'
      fetcherState.primaryFetch.fetchingToken = 'existing-primary-token'
      // aborted but not a redirect — the generic abort flag must NOT trigger retention
      existingPrimaryFetchState.abort = true

      fetcherActions.finishFetch({
        token: 'existing-primary-token',
      })

      expect(fetcherState.primaryFetch.successToken).toBe('existing-primary-token')
      expect(fetcherState.primaryFetch.fetchingToken).toBeUndefined()
      // previous success A is deleted as part of normal promotion
      expect(fetcherState.fetches['existing-token']).toBeUndefined()
    })

    test('A redirect-aborted fetch that is no longer the fetching token (superseded) is simply deleted, leaving the success token untouched', () => {
      fetcherState.primaryFetch.successToken = 'existing-token'
      fetcherState.primaryFetch.fetchingToken = 'a-newer-token'
      existingPrimaryFetchState.abort = true
      existingPrimaryFetchState.abortReason = 'redirect'

      fetcherActions.finishFetch({
        token: 'existing-primary-token',
      })

      expect(fetcherState.primaryFetch.successToken).toBe('existing-token')
      expect(fetcherState.primaryFetch.fetchingToken).toBe('a-newer-token')
      expect(fetcherState.fetches['existing-primary-token']).toBeUndefined()
    })

    test('A redirect on first load (no previous success token) leaves nothing displayed rather than a page-less redirect', () => {
      fetcherState.primaryFetch.successToken = undefined
      fetcherState.primaryFetch.fetchingToken = 'existing-primary-token'
      existingPrimaryFetchState.abort = true
      existingPrimaryFetchState.abortReason = 'redirect'

      fetcherActions.finishFetch({
        token: 'existing-primary-token',
      })

      expect(fetcherState.primaryFetch.successToken).toBeUndefined()
      expect(fetcherState.primaryFetch.fetchingToken).toBeUndefined()
      expect(fetcherState.fetches['existing-primary-token']).toBeUndefined()
    })
  })
})

describe('Fetcher store action -> setDisplayedToken', () => {
  let fetcherActions: CwaFetcherActionsInterface
  let fetcherState: CwaFetcherStateInterface

  beforeEach(() => {
    fetcherState = state()
    fetcherState.fetches['old-displayed'] = reactive({ path: '/old', resources: ['/old'], isPrimary: true, timestamp: 0 })
    fetcherState.fetches['new-displayed'] = reactive({ path: '/new', resources: ['/new'], isPrimary: true, timestamp: 0 })
    fetcherActions = actions(fetcherState, getters(fetcherState))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('Sets the displayed token', () => {
    fetcherActions.setDisplayedToken('new-displayed')
    expect(fetcherState.primaryFetch.displayedToken).toBe('new-displayed')
  })

  test('Cleans up the previously displayed fetch when it is replaced', () => {
    fetcherState.primaryFetch.displayedToken = 'old-displayed'
    fetcherActions.setDisplayedToken('new-displayed')
    expect(fetcherState.primaryFetch.displayedToken).toBe('new-displayed')
    expect(fetcherState.fetches['old-displayed']).toBeUndefined()
  })

  test('Does NOT clean up the previously displayed fetch if it is still the success token', () => {
    fetcherState.primaryFetch.displayedToken = 'old-displayed'
    fetcherState.primaryFetch.successToken = 'old-displayed'
    fetcherActions.setDisplayedToken('new-displayed')
    expect(fetcherState.fetches['old-displayed']).toBeDefined()
  })
})

describe('Fetcher store action -> clearFetches', () => {
  test('Resets the displayed token along with fetching and success tokens', () => {
    const fetcherState = state()
    fetcherState.primaryFetch.fetchingToken = 'f'
    fetcherState.primaryFetch.successToken = 's'
    fetcherState.primaryFetch.displayedToken = 'd'
    fetcherState.fetches['f'] = reactive({ path: '/f', resources: [], isPrimary: true, timestamp: 0 })
    const fetcherActions = actions(fetcherState, getters(fetcherState))
    fetcherActions.clearFetches()
    expect(fetcherState.primaryFetch.displayedToken).toBeUndefined()
    expect(fetcherState.primaryFetch.fetchingToken).toBeUndefined()
    expect(fetcherState.primaryFetch.successToken).toBeUndefined()
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
      timestamp: 0,
    }
    existingCompletedPrimaryFetchState = {
      path: '/existing-complete-primary-path',
      resources: ['/existing-primary-path', '/existing-path'],
      isPrimary: true,
      timestamp: 0,
    }
    existingFetchState = {
      path: '/existing-path',
      resources: ['/existing-path', '/errored-resource'],
      isPrimary: false,
      timestamp: 0,
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
      timestamp: 0,
    }
    const existingManifestFetchState: FetchStatus = {
      path: '/existing-path',
      resources: ['/existing-path', '/errored-resource'],
      isPrimary: false,
      timestamp: 0,
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
    })
    expect(logger.trace).toHaveBeenCalledTimes(1)
    expect(logger.trace).toHaveBeenCalledWith('The fetch chain token \'non-existent\' does not exist')
    expect(fetcherState.fetches['existing-token-with-manifest'].manifest.fetchComplete).toBeUndefined()
  })

  test('If a manifest has not been defined for the fetch chain an error is thrown', () => {
    expect(() => {
      fetcherActions.finishManifestFetch({
        type: FinishFetchManifestType.SUCCESS,
        token: 'existing-token-no-manifest',
      })
    }).toThrowError('Cannot set manifest status for \'existing-token-no-manifest\'. The manifest was never started.')
  })

  test('Can set the success status on a manifest', () => {
    fetcherActions.finishManifestFetch({
      type: FinishFetchManifestType.SUCCESS,
      token: 'existing-token-with-manifest',
    })
    expect(fetcherState.fetches['existing-token-with-manifest'].manifest.path).toBe('/some-manifest-path')
    expect(fetcherState.fetches['existing-token-with-manifest'].manifest.fetchComplete).toBe(true)
    expect(fetcherState.fetches['existing-token-with-manifest'].manifest.irisByDepth).toBeUndefined()
  })

  test('setManifestIrisByDepth retains the raw tree and stores the flattened depth groups on the manifest', () => {
    // Each depth is a nested tree; flattening a depth (node iri + descendants, depth-first) yields
    // the flat per-depth IRI list existing consumers read.
    const resourceIris = [
      { iri: '/parent-route', children: [{ iri: '/parent-page', children: [] }] },
      { iri: '/child-route', children: [{ iri: '/child-page', children: [] }] },
    ]
    fetcherActions.setManifestIrisByDepth({
      token: 'existing-token-with-manifest',
      resourceIris,
    })
    expect(fetcherState.fetches['existing-token-with-manifest'].manifest.resourceTree).toStrictEqual(resourceIris)
    expect(fetcherState.fetches['existing-token-with-manifest'].manifest.irisByDepth).toStrictEqual([
      ['/parent-route', '/parent-page'],
      ['/child-route', '/child-page'],
    ])
    expect(fetcherState.fetches['existing-token-with-manifest'].manifest.fetchComplete).toBeUndefined()
  })

  test('setManifestIrisByDepth throws if token does not exist', () => {
    expect(() => {
      fetcherActions.setManifestIrisByDepth({ token: 'non-existent', resourceIris: [] })
    }).toThrowError('The fetch chain token \'non-existent\' does not exist')
  })

  test('setManifestIrisByDepth throws if manifest was never started', () => {
    expect(() => {
      fetcherActions.setManifestIrisByDepth({ token: 'existing-token-no-manifest', resourceIris: [] })
    }).toThrowError('Cannot set manifest IRIs by depth for \'existing-token-no-manifest\'. The manifest was never started.')
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

/**
 * Depth tracking drives the depth-aware `path` request header: a depth-0 resource must be requested
 * with the depth-0 route path so the API resolves a dynamic position's `pageDataProperty` against
 * the correct page data.
 *
 * These behaviours previously lived on `FetchStatusManager` as in-memory Maps. They were moved here
 * because in-memory state does not survive the SSR→client payload — the client builds a fresh
 * manager, runs no manifest fetch, and every client-side re-fetch after a server-side load then sent
 * the current (child) route path, so the parent data page's components silently vanished.
 * See `api/fetcher/nested-page-hydration.spec.ts` for the end-to-end reproduction.
 */
describe('Fetcher store action -> depth tracking (setManifestIrisByDepth / registerIriDepth / resetIriDepths)', () => {
  let fetcherActions: CwaFetcherActionsInterface
  let fetcherState: CwaFetcherStateInterface
  let currentGetters: CwaFetcherGettersInterface

  // Build a depth tree node from a flat IRI list (first = root, rest = direct children); it flattens
  // back to the same flat list the depth-tracking logic receives.
  const depthNode = (iris: string[]) => ({ iri: iris[0], children: iris.slice(1).map(iri => ({ iri, children: [] })) })

  function setManifest(resourceIris: ReturnType<typeof depthNode>[]) {
    fetcherActions.setManifestIrisByDepth({ token: 'existing-token', resourceIris })
  }

  beforeEach(() => {
    fetcherState = state()
    fetcherState.fetches['existing-token'] = reactive({
      path: '/existing-path',
      resources: [],
      isPrimary: true,
      timestamp: 0,
      manifest: { path: '/some-manifest-path' },
    })
    currentGetters = getters(fetcherState)
    fetcherActions = actions(fetcherState, currentGetters)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('depth tracking is empty before any manifest is set', () => {
    expect(fetcherState.iriDepths['/_/routes//topic-1']).toBeUndefined()
    expect(fetcherState.depthPaths[0]).toBeUndefined()
  })

  test('setManifestIrisByDepth maps every IRI in each depth group to its depth index', () => {
    setManifest([
      depthNode(['/_/routes//topic-1', '/_/pages/parent-template', '/_/component_positions/parent-cp']),
      depthNode(['/_/routes//topic-1/chapter-one', '/_/pages/child-template', '/_/component_positions/child-cp']),
    ])
    expect(fetcherState.iriDepths['/_/routes//topic-1']).toBe(0)
    expect(fetcherState.iriDepths['/_/pages/parent-template']).toBe(0)
    expect(fetcherState.iriDepths['/_/component_positions/parent-cp']).toBe(0)
    expect(fetcherState.iriDepths['/_/routes//topic-1/chapter-one']).toBe(1)
    expect(fetcherState.iriDepths['/_/pages/child-template']).toBe(1)
    expect(fetcherState.iriDepths['/_/component_positions/child-cp']).toBe(1)
    expect(fetcherState.iriDepths['/unknown']).toBeUndefined()
  })

  test('the path for each depth is derived from the ROUTE IRI in that depth group', () => {
    setManifest([
      depthNode(['/_/pages/parent-template', '/_/routes//topic-1']),
      depthNode(['/_/routes//topic-1/chapter-one', '/_/pages/child-template']),
    ])
    expect(fetcherState.depthPaths[0]).toBe('/topic-1')
    expect(fetcherState.depthPaths[1]).toBe('/topic-1/chapter-one')
    expect(fetcherState.depthPaths[2]).toBeUndefined()
  })

  test('setManifestIrisByDepth replaces previous depth tracking data', () => {
    setManifest([depthNode(['/_/routes//old', '/_/pages/old-page'])])
    setManifest([depthNode(['/_/routes//new', '/_/pages/new-page'])])
    expect(fetcherState.iriDepths['/_/pages/old-page']).toBeUndefined()
    expect(fetcherState.iriDepths['/_/pages/new-page']).toBe(0)
    expect(fetcherState.depthPaths[0]).toBe('/new')
  })

  test('registerIriDepth adds an IRI the manifest did not contain', () => {
    fetcherActions.registerIriDepth({ iri: '/component/some-uuid', depth: 0 })
    expect(fetcherState.iriDepths['/component/some-uuid']).toBe(0)
  })

  test('resetIriDepths clears all depth tracking', () => {
    setManifest([depthNode(['/_/routes//topic-1', '/_/pages/parent'])])
    fetcherActions.registerIriDepth({ iri: '/component/some-uuid', depth: 0 })
    fetcherActions.resetIriDepths()
    expect(fetcherState.iriDepths['/_/pages/parent']).toBeUndefined()
    expect(fetcherState.iriDepths['/component/some-uuid']).toBeUndefined()
    expect(fetcherState.depthPaths[0]).toBeUndefined()
  })

  test('clearFetches clears depth tracking', () => {
    setManifest([depthNode(['/_/routes//topic-1', '/_/pages/parent'])])
    fetcherActions.clearFetches()
    expect(fetcherState.iriDepths['/_/pages/parent']).toBeUndefined()
    expect(fetcherState.depthPaths[0]).toBeUndefined()
  })
})
