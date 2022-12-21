import { describe, beforeEach, vi, test, expect } from 'vitest'
import { reactive } from 'vue'
import { ResourcesStore } from '../resources/resources-store'
import { CwaResourceApiStatuses } from '../resources/state'
import { CwaResourceTypes } from '../../../resources/resource-utils'
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
              status: CwaResourceApiStatuses.SUCCESS,
              headers: {
                path: '/success-resource'
              }
            },
            data: {
              '@type': CwaResourceTypes.COMPONENT
            }
          },
          '/not-found-resource': {
            apiState: {
              status: CwaResourceApiStatuses.ERROR,
              error: {
                statusCode: 404
              },
              headers: {
                path: '/success-resource'
              }
            },
            data: {
              '@type': CwaResourceTypes.COMPONENT
            }
          },
          '/errored-resource': {
            apiState: {
              status: CwaResourceApiStatuses.ERROR,
              error: {
                statusCode: 500
              },
              headers: {
                path: '/success-resource'
              }
            },
            data: {
              '@type': CwaResourceTypes.COMPONENT
            }
          },
          '/in-progress-resource': {
            apiState: {
              status: CwaResourceApiStatuses.IN_PROGRESS,
              headers: {
                path: '/success-resource'
              }
            },
            data: {
              '@type': CwaResourceTypes.COMPONENT
            }
          },
          '/in-progress-resource-no-data': {
            apiState: {
              status: CwaResourceApiStatuses.IN_PROGRESS
            }
          },
          '/component-position-different-path': {
            apiState: {
              status: CwaResourceApiStatuses.SUCCESS,
              headers: {
                path: '/another-path'
              }
            },
            data: {
              '@type': CwaResourceTypes.COMPONENT_POSITION
            }
          },
          '/component-different-path': {
            apiState: {
              status: CwaResourceApiStatuses.SUCCESS,
              headers: {
                path: '/another-path'
              }
            },
            data: {
              '@type': CwaResourceTypes.COMPONENT
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

describe('FetcherStore getters -> isSuccessfulPrimaryFetchValid', () => {
  let state: CwaFetcherStateInterface
  let getterFns: CwaFetcherGettersInterface
  let resourcesStore: ResourcesStore

  beforeEach(() => {
    resourcesStore = new ResourcesStore()
    state = createState()
    state.primaryFetch.successToken = 'success-token'
    getterFns = getters(state, resourcesStore)
  })

  test('Return false if there is no primary success token', () => {
    state.primaryFetch.successToken = undefined
    expect(getterFns.isSuccessfulPrimaryFetchValid.value).toBe(false)
  })

  test('Return false if the token does not exist', () => {
    state.primaryFetch.successToken = 'does-not-exist'
    expect(getterFns.isSuccessfulPrimaryFetchValid.value).toBe(false)
  })

  test('Return false if no resources in the fetch chain', () => {
    state.fetches = {
      'success-token': {
        path: 'any',
        isPrimary: false,
        resources: []
      }
    }
    expect(getterFns.isSuccessfulPrimaryFetchValid.value).toBe(false)
  })

  test.each([
    { manifest: false, manifestResources: undefined, manifestError: undefined, result: true },
    { manifest: true, manifestResources: undefined, manifestError: undefined, result: false },
    { manifest: true, manifestResources: ['/some-resource'], manifestError: undefined, result: true },
    { manifest: true, manifestResources: undefined, manifestError: { message: 'error' }, result: true }
  ])(
    "If manifest exist status is '$manifest', manifest resources are '$manifestResources' and manifest error is '$manifestError' then the result should be '$result'",
    ({ manifest, manifestResources, manifestError, result }: { manifest: boolean, manifestResources: undefined|string[], manifestError: any|undefined, result: boolean }
    ) => {
      const currentFetch: TopLevelFetchPathInterface = {
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
      expect(getterFns.isSuccessfulPrimaryFetchValid.value).toBe(result)
    })

  test('If the primary fetch path resource does not exist, return false', () => {
    const currentFetch: TopLevelFetchPathInterface = {
      path: '/does-not-exist',
      isPrimary: false,
      resources: ['/success-resource', '/not-found-resource']
    }
    state.fetches = {
      'success-token': currentFetch
    }
    expect(getterFns.isSuccessfulPrimaryFetchValid.value).toBe(false)
  })

  test('If the primary fetch path resource is in an error state, return false', () => {
    const currentFetch: TopLevelFetchPathInterface = {
      path: '/errored-resource',
      isPrimary: false,
      resources: ['/success-resource', '/not-found-resource']
    }
    state.fetches = {
      'success-token': currentFetch
    }
    expect(getterFns.isSuccessfulPrimaryFetchValid.value).toBe(false)
  })

  test('Returns false if a resource in the fetch chain is-errored', () => {
    state.fetches = {
      'success-token': {
        path: 'any',
        isPrimary: false,
        resources: ['/success-resource', '/errored-resource']
      }
    }
    expect(getterFns.isSuccessfulPrimaryFetchValid.value).toBe(false)
  })

  test('Returns true if a resource in the fetch chain is-errored with non-critical', () => {
    state.fetches = {
      'success-token': {
        path: '/success-resource',
        isPrimary: false,
        resources: ['/success-resource', '/not-found-resource']
      }
    }
    expect(getterFns.isSuccessfulPrimaryFetchValid.value).toBe(true)
  })

  test('Returns true if a resource in the fetch chain has a different path but is not a component position', () => {
    state.fetches = {
      'success-token': {
        path: '/success-resource',
        isPrimary: false,
        resources: ['/success-resource', '/component-different-path']
      }
    }
    expect(getterFns.isSuccessfulPrimaryFetchValid.value).toBe(true)
  })

  test('Returns false if a resource in the fetch chain has a different path and is a component position', () => {
    state.fetches = {
      'success-token': {
        path: '/success-resource',
        isPrimary: false,
        resources: ['/success-resource', '/component-position-different-path']
      }
    }
    expect(getterFns.isSuccessfulPrimaryFetchValid.value).toBe(false)
  })

  test.each([
    { path: '/not-found-resource', resources: ['/success-resource', '/not-found-resource'], result: false },
    { path: '/does-not-exist', resources: ['/success-resource', '/not-found-resource'], result: false },
    { path: '/success-resource', resources: ['/success-resource', '/not-found-resource'], result: true },
    { path: '/success-resource', resources: ['/success-resource', '/not-found-resource', '/errored-resource'], result: false },
    { path: '/success-resource', resources: ['/success-resource', '/not-found-resource', '/in-progress-resource'], result: true },
    { path: '/success-resource', resources: ['/success-resource', '/not-found-resource', '/in-progress-resource-no-data'], result: false }
  ])('If we only want successful fetch chains, we check the main path. If the main path is $path with the resources $resources the result should be $result', ({
    path,
    resources,
    result
  }) => {
    state.fetches = {
      'success-token': {
        path,
        isPrimary: true,
        resources
      }
    }
    expect(getterFns.isSuccessfulPrimaryFetchValid.value).toBe(result)
  })
})

describe('FetcherStore getters -> isFetchChainComplete', () => {
  let state: CwaFetcherStateInterface
  let getterFns: CwaFetcherGettersInterface
  let resourcesStore: ResourcesStore

  beforeEach(() => {
    resourcesStore = new ResourcesStore()
    state = createState()
    state.primaryFetch.successToken = 'success-token'
    getterFns = getters(state, resourcesStore)
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
