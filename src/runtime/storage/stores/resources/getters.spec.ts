import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { reactive } from 'vue'
import { CwaResourceTypes } from '../../../resources/resource-utils'
import { FetchStatus } from '../fetcher/state'
import getters, { CwaResourcesGettersInterface } from './getters'
import { CwaResourceApiStatuses, CwaResourcesStateInterface } from './state'
import { ResourcesGetterUtils } from './getter-utils'

vi.mock('./getter-utils', () => {
  return {
    ResourcesGetterUtils: vi.fn(() => ({
      resourcesApiStateIsPending: vi.fn(),
      totalResourcesPending: vi.fn()
    }))
  }
})

function createState (): CwaResourcesStateInterface {
  return {
    current: reactive({
      byId: {},
      allIds: [],
      currentIds: []
    }),
    new: reactive({
      byId: {},
      allIds: []
    })
  }
}

describe('ResourcesStore Getters -> resourcesByType', () => {
  let state: CwaResourcesStateInterface
  let getterFns: CwaResourcesGettersInterface

  beforeEach(() => {
    state = createState()
    getterFns = getters(state)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('returns current resources with their type as the object key', () => {
    state.current.currentIds = ['/_/routes/id', '/random-to-exclude']
    state.current.byId = {
      '/_/routes/id': {
        apiState: {
          status: CwaResourceApiStatuses.IN_PROGRESS
        },
        data: {
          '@id': '/_/routes/id'
        }
      },
      '/random-to-exclude': {
        apiState: {
          status: CwaResourceApiStatuses.IN_PROGRESS
        },
        data: {
          '@id': '/random-to-exclude'
        }
      }
    }
    expect(getterFns.resourcesByType.value).toStrictEqual({
      [CwaResourceTypes.ROUTE]: [{
        '@id': '/_/routes/id'
      }],
      [CwaResourceTypes.PAGE]: [],
      [CwaResourceTypes.PAGE_DATA]: [],
      [CwaResourceTypes.LAYOUT]: [],
      [CwaResourceTypes.COMPONENT_GROUP]: [],
      [CwaResourceTypes.COMPONENT_POSITION]: [],
      [CwaResourceTypes.COMPONENT]: []
    })
  })
})

describe('ResourcesStore Getters -> totalResourcesPending', () => {
  let state: CwaResourcesStateInterface
  let getterFns: CwaResourcesGettersInterface

  beforeEach(() => {
    state = createState()
    getterFns = getters(state)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('A computed value is returned from the utils', () => {
    vi.spyOn(ResourcesGetterUtils.mock.results[0].value, 'totalResourcesPending', 'get').mockImplementationOnce(() => {
      return 999
    })
    expect(getterFns.totalResourcesPending.value).toBe(999)
  })
})

describe('ResourcesStore Getters -> currentResourcesApiStateIsPending', () => {
  let state: CwaResourcesStateInterface
  let getterFns: CwaResourcesGettersInterface

  beforeEach(() => {
    state = createState()
    getterFns = getters(state)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('Returns the result of utils resourcesApiStateIsPending with current ids', () => {
    state.current.byId = {
      id: {}
    }
    vi.spyOn(ResourcesGetterUtils.mock.results[0].value, 'resourcesApiStateIsPending').mockImplementationOnce(() => {
      return false
    })
    const result = getterFns.currentResourcesApiStateIsPending.value
    const spy = ResourcesGetterUtils.mock.results[0].value.resourcesApiStateIsPending
    expect(result).toBe(spy.mock.results[0].value)
    expect(spy).toHaveBeenCalledOnce()
    expect(spy).toHaveBeenCalledWith(['id'])
  })
})

describe('ResourcesStore Getters -> resourcesApiStateIsPending', () => {
  let state: CwaResourcesStateInterface
  let getterFns: CwaResourcesGettersInterface

  beforeEach(() => {
    state = createState()
    getterFns = getters(state)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('Returns the result of utils resourcesApiStateIsPending with current ids', () => {
    const fn = getterFns.resourcesApiStateIsPending.value
    const spy = ResourcesGetterUtils.mock.results[0].value.resourcesApiStateIsPending
    expect(spy).not.toHaveBeenCalled()
    const result = fn(['resource'])
    expect(result).toBe(ResourcesGetterUtils.mock.results[0].value.resourcesApiStateIsPending.mock.results[0].value)
    expect(spy).toHaveBeenCalledTimes(1)
  })
})

describe('ResourcesStore Getters -> isFetchStatusResourcesResolved', () => {
  let state: CwaResourcesStateInterface
  let getterFns: CwaResourcesGettersInterface

  beforeEach(() => {
    state = createState()
    getterFns = getters(state)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('If the primary fetch path resource does not exist, return false', () => {
    const currentFetch: FetchStatus = {
      path: '/does-not-exist',
      isPrimary: false,
      resources: []
    }
    state.current.byId = {}
    expect(getterFns.isFetchStatusResourcesResolved.value(currentFetch)).toBe(false)
  })

  test('If the primary fetch path resource is in an error state, return false', () => {
    const currentFetch: FetchStatus = {
      path: '/errored-resource',
      isPrimary: false,
      resources: ['/success-resource', '/not-found-resource']
    }
    state.current.byId = {
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
      }
    }
    expect(getterFns.isFetchStatusResourcesResolved.value(currentFetch)).toBe(false)
  })

  test('Throws an error if the resource does not exist in the resources store', () => {
    const currentFetch: FetchStatus = {
      path: '/success-resource',
      isPrimary: true,
      resources: ['does-not-exist']
    }
    state.current.byId = {
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
      }
    }
    expect(() => {
      return getterFns.isFetchStatusResourcesResolved.value(currentFetch)
    }).toThrowError('The resource \'does-not-exist\' does not exist')
  })

  test('Returns false if a resource in the fetch chain is-errored', () => {
    const currentFetch: FetchStatus = {
      path: '/success-resource',
      isPrimary: false,
      resources: ['/success-resource', '/errored-resource']
    }
    state.current.byId = {
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
      }
    }
    expect(getterFns.isFetchStatusResourcesResolved.value(currentFetch)).toBe(false)
  })

  test('Returns true if a resource in the fetch chain is-errored with non-critical', () => {
    const currentFetch: FetchStatus = {
      path: '/success-resource',
      isPrimary: false,
      resources: ['/success-resource', '/not-found-resource']
    }
    state.current.byId = {
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
      }
    }
    expect(getterFns.isFetchStatusResourcesResolved.value(currentFetch)).toBe(true)
  })

  test('Returns true if a resource in the fetch chain has a different path but is not a component position', () => {
    state.current.byId = {
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
    const currentFetch: FetchStatus = {
      path: '/success-resource',
      isPrimary: false,
      resources: ['/success-resource', '/component-different-path']
    }
    expect(getterFns.isFetchStatusResourcesResolved.value(currentFetch)).toBe(true)
  })

  test('Returns false if a resource in the fetch chain has a different path and is a component position', () => {
    const currentFetch: FetchStatus = {
      path: '/success-resource',
      isPrimary: false,
      resources: ['/success-resource', '/component-position-different-path']
    }
    state.current.byId = {
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
      }
    }
    expect(getterFns.isFetchStatusResourcesResolved.value(currentFetch)).toBe(false)
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
    const currentFetch: FetchStatus = {
      path,
      isPrimary: false,
      resources
    }
    state.current.byId = {
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
      }
    }
    expect(getterFns.isFetchStatusResourcesResolved.value(currentFetch)).toBe(result)
  })
})

describe('ResourcesStore Getters -> resourceLoadStatus', () => {
  let state: CwaResourcesStateInterface
  let getterFns: CwaResourcesGettersInterface

  beforeEach(() => {
    state = createState()
    getterFns = getters(state)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test.each([
    { total: 0, complete: 0, expectedPercent: 100 },
    { total: 1, complete: 0, expectedPercent: 0 },
    { total: 2, complete: 1, expectedPercent: 50 },
    { total: 3, complete: 1, expectedPercent: 33 },
    { total: 3, complete: 3, expectedPercent: 100 }
  ])('If the total to fetch is $total and we have loaded $complete the percentage should be $expectedPercent', ({ total, complete, expectedPercent }) => {
    const pending = total - complete
    vi.spyOn(ResourcesGetterUtils.mock.results[0].value, 'totalResourcesPending', 'get').mockImplementationOnce(() => {
      return pending
    })
    const currentIds = Array.from(Array(total).keys())
    state.current = reactive({
      allIds: currentIds,
      currentIds,
      byId: {}
    })
    for (const id of currentIds) {
      state.current.byId[id] = {
        apiState: {
          status: id < complete ? CwaResourceApiStatuses.SUCCESS : CwaResourceApiStatuses.IN_PROGRESS
        }
      }
    }
    expect(getterFns.resourceLoadStatus.value).toStrictEqual({
      complete,
      pending,
      percent: expectedPercent,
      total
    })
  })
})
