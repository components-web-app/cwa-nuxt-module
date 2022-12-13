import { v4 as uuidv4 } from 'uuid'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { reactive } from 'vue'
import { ResourcesStore } from '../resources/resources-store'
import actions, { CwaFetcherActionsInterface } from './actions'
import state, { CwaFetcherStateInterface } from './state'
import getters from './getters'

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
          '/another-resource': {
            apiState: {
              status: -1
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

  const existingFetchState = {
    path: '/existing-path',
    resources: ['/existing-path', '/another-resource'],
    isPrimary: false,
    isServerFetch: true
  }

  beforeEach(() => {
    fetcherState = state()
    fetcherState.primaryFetch.successToken = 'existing-token'
    fetcherState.fetches['existing-token'] = reactive(existingFetchState)
    const resourcesStore = new ResourcesStore()
    fetcherActions = actions(fetcherState, getters(fetcherState, resourcesStore))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('If a token is provided we should return the existing status', () => {
    const status = fetcherActions.startFetch({
      path: 'my-path',
      token: 'existing-token'
    })
    expect(uuidv4).not.toHaveBeenCalled()
    expect(fetcherState.fetches['existing-token']).toStrictEqual(existingFetchState)
    expect(status).toBe('existing-token')
  })

  test('If a token is provided that does not exist, we should throw an error', () => {
    expect(() => {
      fetcherActions.startFetch({
        path: 'my-path',
        token: 'non-existent'
      })
    }).toThrowError("Cannot start the fetch: The token 'non-existent' does not exist")
    expect(uuidv4).not.toHaveBeenCalled()
  })

  test('A token is generated to start a new fetch chain', () => {
    const startFetchEvent = {
      path: 'my-path'
    }
    const expectedStatus = {
      path: startFetchEvent.path,
      resources: [],
      isServerFetch: true,
      isPrimary: false
    }
    const status = fetcherActions.startFetch(startFetchEvent)
    expect(uuidv4).toHaveBeenCalledTimes(1)
    expect(fetcherState.fetches['existing-token']).toStrictEqual(existingFetchState)
    expect(fetcherState.fetches['mock-uuid-token']).toStrictEqual(expectedStatus)
    expect(status).toBe('mock-uuid-token')
  })

  test('A manifest path is populated', () => {
    const startFetchEvent = {
      path: 'my-path',
      manifestPath: '/manifest-path'
    }
    const expectedStatus = {
      path: startFetchEvent.path,
      resources: [],
      isPrimary: false,
      isServerFetch: true,
      manifest: {
        path: '/manifest-path'
      }
    }
    const status = fetcherActions.startFetch(startFetchEvent)
    expect(fetcherState.fetches['mock-uuid-token']).toStrictEqual(expectedStatus)
    expect(status).toBe('mock-uuid-token')
  })

  test('Primary fetches will populate the primary fetch status and clear the resources store', () => {
    const startFetchEvent = {
      path: 'my-path',
      manifestPath: '/manifest-path',
      isPrimary: true
    }
    const expectedStatus = {
      path: startFetchEvent.path,
      resources: [],
      isPrimary: true,
      isServerFetch: true,
      manifest: {
        path: '/manifest-path'
      }
    }
    const status = fetcherActions.startFetch(startFetchEvent)
    expect(status).toBe('mock-uuid-token')
    expect(fetcherState.primaryFetch.fetchingToken).toBe('mock-uuid-token')
    expect(fetcherState.fetches['mock-uuid-token']).toStrictEqual(expectedStatus)
  })

  test('If there is an existing primary fetch, that was server-side, and we are client-side now, and the fetcher chain is complete, we should return false to abort', () => {
    process.client = true
    const startFetchEvent = {
      path: '/existing-path',
      manifestPath: '/manifest-path',
      isPrimary: true
    }

    const status = fetcherActions.startFetch(startFetchEvent)
    expect(status).toBeUndefined()
  })
})

describe.todo('finishFetch')

describe.todo('addFetchResource')
