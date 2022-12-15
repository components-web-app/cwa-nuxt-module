import { v4 as uuidv4 } from 'uuid'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { reactive } from 'vue'
import { ResourcesStore } from '../resources/resources-store'
import actions, { CwaFetcherActionsInterface, FinishFetchManifestType } from './actions'
import state, { CwaFetcherStateInterface, TopLevelFetchPathInterface } from './state'
import getters from './getters'
import { createCwaResourceError } from '../../../errors/cwa-resource-error'

vi.mock('uuid', () => {
  return {
    v4: vi.fn(() => ('mock-uuid-token'))
  }
})
vi.mock('../resources/resources-store', () => ({
  ResourcesStore: vi.fn(() => ({
    useStore: vi.fn(() => ({
      current: {
        byId: {
          '/existing-path': {
            apiState: {
              status: 1
            }
          },
          '/errored-resource': {
            apiState: {
              status: -1
            }
          },
          '/existing-primary-path': {
            apiState: {
              status: 1
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

describe('Fetcher store action -> startFetch', () => {
  let fetcherActions: CwaFetcherActionsInterface
  let fetcherState: CwaFetcherStateInterface

  let existingIncompletePrimaryFetchState: TopLevelFetchPathInterface
  let existingCompletedPrimaryFetchState: TopLevelFetchPathInterface
  let existingFetchState: TopLevelFetchPathInterface

  beforeEach(() => {
    existingIncompletePrimaryFetchState = {
      path: '/existing-incomplete-primary-path',
      resources: ['/existing-path', '/in-progress-resource'],
      isPrimary: true
    }
    existingCompletedPrimaryFetchState = {
      path: '/existing-complete-primary-path',
      resources: ['/existing-primary-path', '/existing-path'],
      isPrimary: true
    }
    existingFetchState = {
      path: '/existing-path',
      resources: ['/existing-path', '/errored-resource'],
      isPrimary: false
    }
    fetcherState = state()
    fetcherState.primaryFetch.successToken = 'existing-token'
    fetcherState.fetches['existing-incomplete-primary-token'] = reactive(existingIncompletePrimaryFetchState)
    fetcherState.fetches['existing-complete-primary-token'] = reactive(existingCompletedPrimaryFetchState)
    fetcherState.fetches['existing-token'] = reactive(existingFetchState)
    const resourcesStore = new ResourcesStore()
    fetcherActions = actions(fetcherState, getters(fetcherState, resourcesStore))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('If a token is provided we should return the existing status', () => {
    const response = fetcherActions.startFetch({
      path: 'my-path',
      token: 'existing-token'
    })
    expect(uuidv4).not.toHaveBeenCalled()
    expect(fetcherState.fetches['existing-token']).toStrictEqual(existingFetchState)
    expect(response).toStrictEqual({
      continue: true,
      resources: existingFetchState.resources,
      token: 'existing-token'
    })
  })

  test('If a token is provided that does not exist, we should throw an error', () => {
    expect(() => {
      fetcherActions.startFetch({
        path: 'my-path',
        token: 'non-existent'
      })
    }).toThrowError("The fetch chain token 'non-existent' does not exist")
    expect(uuidv4).not.toHaveBeenCalled()
  })

  test('A token is generated to start a new fetch chain', () => {
    const startFetchEvent = {
      path: 'my-path'
    }
    const expectedFetchChain = {
      path: startFetchEvent.path,
      resources: [],
      isPrimary: false
    }
    const response = fetcherActions.startFetch(startFetchEvent)
    expect(uuidv4).toHaveBeenCalledTimes(1)
    expect(fetcherState.fetches['existing-token']).toStrictEqual(existingFetchState)
    expect(fetcherState.fetches['mock-uuid-token']).toStrictEqual(expectedFetchChain)
    expect(response).toStrictEqual({
      continue: true,
      resources: expectedFetchChain.resources,
      token: 'mock-uuid-token'
    })
  })

  test('A manifest path is populated', () => {
    const startFetchEvent = {
      path: 'my-path',
      manifestPath: '/manifest-path'
    }
    const expectedFetchChain = {
      path: startFetchEvent.path,
      resources: [],
      isPrimary: false,
      manifest: {
        path: '/manifest-path'
      }
    }
    const response = fetcherActions.startFetch(startFetchEvent)
    expect(fetcherState.fetches['mock-uuid-token']).toStrictEqual(expectedFetchChain)
    expect(response).toStrictEqual({
      continue: true,
      resources: expectedFetchChain.resources,
      token: 'mock-uuid-token'
    })
  })

  test('Primary fetches will set primaryFetch.fetchingToken', () => {
    const startFetchEvent = {
      path: 'my-path',
      isPrimary: true
    }
    const expectedFetchChain = {
      path: startFetchEvent.path,
      resources: [],
      isPrimary: true
    }
    const response = fetcherActions.startFetch(startFetchEvent)
    expect(response).toStrictEqual({
      continue: true,
      resources: expectedFetchChain.resources,
      token: 'mock-uuid-token'
    })
    expect(fetcherState.primaryFetch.fetchingToken).toBe('mock-uuid-token')
    expect(fetcherState.fetches['mock-uuid-token']).toStrictEqual(expectedFetchChain)
  })

  test('If there is already a successful and completed primary fetch with the same path as a new primary fetch we return the last successful fetch token and clear any possible pending primary fetch', () => {
    const startFetchEvent = {
      path: '/existing-complete-primary-path',
      isPrimary: true
    }
    fetcherState.primaryFetch.successToken = 'existing-complete-primary-token'
    fetcherState.primaryFetch.fetchingToken = 'any-other-primary-fetch-token'

    const response = fetcherActions.startFetch(startFetchEvent)
    expect(fetcherState.primaryFetch.fetchingToken).toBeUndefined()
    expect(response).toStrictEqual({
      continue: false,
      resources: existingCompletedPrimaryFetchState.resources,
      token: 'existing-complete-primary-token'
    })
  })

  test('If there is already a successful and but not completed primary fetch with the same path as a new primary fetch we create a new fetch chain token', () => {
    const startFetchEvent = {
      path: '/existing-incomplete-primary-path',
      isPrimary: true
    }
    fetcherState.primaryFetch.successToken = 'existing-incomplete-primary-token'
    fetcherState.primaryFetch.fetchingToken = 'any-other-primary-fetch-token'

    const response = fetcherActions.startFetch(startFetchEvent)
    expect(fetcherState.primaryFetch.fetchingToken).toBe('mock-uuid-token')
    expect(response).toStrictEqual({
      continue: true,
      resources: [],
      token: 'mock-uuid-token'
    })
  })
})

describe('Fetcher store action -> finishFetch', () => {
  let fetcherActions: CwaFetcherActionsInterface
  let fetcherState: CwaFetcherStateInterface

  let existingPrimaryFetchState: TopLevelFetchPathInterface
  let existingFetchState: TopLevelFetchPathInterface

  beforeEach(() => {
    existingPrimaryFetchState = {
      path: '/existing-path',
      resources: ['/existing-path', '/errored-resource'],
      isPrimary: true
    }
    existingFetchState = {
      path: '/existing-path',
      resources: ['/existing-path', '/errored-resource'],
      isPrimary: false
    }
    fetcherState = state()
    fetcherState.fetches['existing-primary-token'] = reactive(existingPrimaryFetchState)
    fetcherState.fetches['existing-token'] = reactive(existingFetchState)
    const resourcesStore = new ResourcesStore()
    fetcherActions = actions(fetcherState, getters(fetcherState, resourcesStore))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('If the token does not exist, an error is thrown', () => {
    expect(() => {
      fetcherActions.finishFetch({
        token: 'non-existent'
      })
    }).toThrowError("The fetch chain token 'non-existent' does not exist")
  })

  test('If the current fetch chain is not primary, we should delete it', () => {
    fetcherActions.finishFetch({
      token: 'existing-token'
    })
    expect(fetcherState.fetches['existing-token']).toBeUndefined()
  })

  test('If the current fetch chain is primary, but the fetch token does not match we should delete it', () => {
    fetcherState.primaryFetch.fetchingToken = 'another-token'
    fetcherActions.finishFetch({
      token: 'existing-primary-token'
    })
    expect(fetcherState.fetches['existing-primary-token']).toBeUndefined()
  })

  test('If the current fetch chain is primary, and the new token matches, we should not delete it', () => {
    fetcherState.primaryFetch.fetchingToken = 'existing-primary-token'
    fetcherActions.finishFetch({
      token: 'existing-primary-token'
    })
    expect(fetcherState.fetches['existing-primary-token']).toStrictEqual(existingPrimaryFetchState)
  })

  test('Delete the fetch chain for a previously successful fetch if this is a new successful primary fetch', () => {
    fetcherState.primaryFetch.fetchingToken = 'existing-primary-token'
    fetcherState.primaryFetch.successToken = 'existing-token'
    fetcherActions.finishFetch({
      token: 'existing-primary-token'
    })
    expect(fetcherState.fetches['existing-token']).toBeUndefined()
  })

  test('The fetching token should be unset, and the success token should be the new token', () => {
    fetcherState.primaryFetch.fetchingToken = 'existing-primary-token'
    fetcherState.primaryFetch.successToken = 'some-token'
    fetcherActions.finishFetch({
      token: 'existing-primary-token'
    })
    expect(fetcherState.primaryFetch.successToken).toBe('existing-primary-token')
    expect(fetcherState.primaryFetch.fetchingToken).toBeUndefined()
  })
})

describe('Fetcher store action -> addFetchResource', () => {
  let fetcherActions: CwaFetcherActionsInterface
  let fetcherState: CwaFetcherStateInterface

  let existingIncompletePrimaryFetchState: TopLevelFetchPathInterface
  let existingCompletedPrimaryFetchState: TopLevelFetchPathInterface
  let existingFetchState: TopLevelFetchPathInterface

  beforeEach(() => {
    existingIncompletePrimaryFetchState = {
      path: '/existing-incomplete-primary-path',
      resources: ['/existing-path', '/in-progress-resource'],
      isPrimary: true
    }
    existingCompletedPrimaryFetchState = {
      path: '/existing-complete-primary-path',
      resources: ['/existing-primary-path', '/existing-path'],
      isPrimary: true
    }
    existingFetchState = {
      path: '/existing-path',
      resources: ['/existing-path', '/errored-resource'],
      isPrimary: false
    }
    fetcherState = state()
    fetcherState.fetches['existing-incomplete-primary-token'] = reactive(existingIncompletePrimaryFetchState)
    fetcherState.fetches['existing-complete-primary-token'] = reactive(existingCompletedPrimaryFetchState)
    fetcherState.fetches['existing-token'] = reactive(existingFetchState)
    const resourcesStore = new ResourcesStore()
    fetcherActions = actions(fetcherState, getters(fetcherState, resourcesStore))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('If the token does not exist, an error is thrown', () => {
    expect(() => {
      fetcherActions.addFetchResource({
        token: 'non-existent',
        resource: '/my-resource'
      })
    }).toThrowError("The fetch chain token 'non-existent' does not exist")
  })

  test('If the fetch chain status already contains this resource, return false to stop the duplicate fetch', () => {
    const result = fetcherActions.addFetchResource({
      token: 'existing-token',
      resource: '/existing-path'
    })
    expect(result).toBe(false)
    expect(fetcherState.fetches['existing-token'].resources).toStrictEqual(existingFetchState.resources)
  })

  test('If the current fetch chain is primary, but no longer being fetched, return false, do not fetch - it has been cancelled', () => {
    fetcherState.primaryFetch.fetchingToken = 'changed-fetching-token'
    const result = fetcherActions.addFetchResource({
      token: 'existing-incomplete-primary-token',
      resource: '/existing-path'
    })
    expect(result).toBe(false)
    expect(fetcherState.fetches['existing-token'].resources).toStrictEqual(existingFetchState.resources)
  })

  test('If the token is for a fetch chain that is not primary, even if there is a primary fetch in progress, continue and add', () => {
    fetcherState.primaryFetch.fetchingToken = 'existing-incomplete-primary-token'
    const result = fetcherActions.addFetchResource({
      token: 'existing-token',
      resource: '/another-path-2'
    })
    expect(result).toBe(true)
    expect(fetcherState.fetches['existing-token'].resources).toStrictEqual([
      '/existing-path',
      '/errored-resource',
      '/another-path-2'
    ])
  })

  test('If the token is for a fetch chain that is already completed status, we add the resource still', () => {
    fetcherState.primaryFetch.fetchingToken = 'existing-complete-primary-token'
    const result = fetcherActions.addFetchResource({
      token: 'existing-complete-primary-token',
      resource: '/another-path-2'
    })
    expect(result).toBe(true)
    expect(fetcherState.fetches['existing-complete-primary-token'].resources).toStrictEqual([
      '/existing-primary-path',
      '/existing-path',
      '/another-path-2'
    ])
  })

  test('If the token is for a fetch chain that is already completed status, and is no longer the fetching token (finished), we add the resource still', () => {
    fetcherState.primaryFetch.successToken = 'existing-complete-primary-token'
    const result = fetcherActions.addFetchResource({
      token: 'existing-complete-primary-token',
      resource: '/another-path-2'
    })
    expect(result).toBe(false)
    expect(fetcherState.fetches['existing-complete-primary-token'].resources).toStrictEqual([
      '/existing-primary-path',
      '/existing-path'
    ])
  })
})

describe('Fetcher store action -> finishManifestFetch', () => {
  let fetcherActions: CwaFetcherActionsInterface
  let fetcherState: CwaFetcherStateInterface

  beforeEach(() => {
    const existingFetchState: TopLevelFetchPathInterface = {
      path: '/existing-path',
      resources: ['/existing-path', '/errored-resource'],
      isPrimary: false
    }
    const existingManifestFetchState: TopLevelFetchPathInterface = {
      path: '/existing-path',
      resources: ['/existing-path', '/errored-resource'],
      isPrimary: false,
      manifest: {
        path: '/some-manifest-path'
      }
    }
    fetcherState = state()
    fetcherState.fetches['existing-token-no-manifest'] = reactive(existingFetchState)
    fetcherState.fetches['existing-token-with-manifest'] = reactive(existingManifestFetchState)
    const resourcesStore = new ResourcesStore()
    fetcherActions = actions(fetcherState, getters(fetcherState, resourcesStore))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('If the token does not exist, an error is thrown', () => {
    expect(() => {
      fetcherActions.finishManifestFetch({
        type: FinishFetchManifestType.SUCCESS,
        token: 'non-existent',
        resources: ['/any']
      })
    }).toThrowError("The fetch chain token 'non-existent' does not exist")
  })

  test('If a manifest has not been defined for the fetch chain an error is thrown', () => {
    expect(() => {
      fetcherActions.finishManifestFetch({
        type: FinishFetchManifestType.SUCCESS,
        token: 'existing-token-no-manifest',
        resources: ['/any']
      })
    }).toThrowError("Cannot set manifest status for 'existing-token-no-manifest'. The manifest was never started.")
  })

  test('Can set the success status on a manifest', () => {
    fetcherActions.finishManifestFetch({
      type: FinishFetchManifestType.SUCCESS,
      token: 'existing-token-with-manifest',
      resources: ['/any']
    })
    expect(fetcherState.fetches['existing-token-with-manifest'].manifest.path).toBe('/some-manifest-path')
    expect(fetcherState.fetches['existing-token-with-manifest'].manifest.resources).toStrictEqual(['/any'])
  })

  test('Can set the error state on a manifest', () => {
    const newError = createCwaResourceError(new Error('My error message'))
    fetcherActions.finishManifestFetch({
      type: FinishFetchManifestType.ERROR,
      token: 'existing-token-with-manifest',
      error: newError
    })
    expect(fetcherState.fetches['existing-token-with-manifest'].manifest.path).toBe('/some-manifest-path')
    expect(fetcherState.fetches['existing-token-with-manifest'].manifest.error).toStrictEqual(newError.asObject)
  })
})
