import { beforeEach, describe, expect, test } from 'vitest'
import { createCwaResourceError, CwaResourceError } from '../../../errors/cwa-resource-error'
import actions, { CwaResourcesActionsInterface } from './actions'
import state, { CwaResourceApiStatuses, CwaResourcesStateInterface } from './state'
import getters from './getters'

describe('Resources -> mergeNewResources', () => {
  const resourcesState = state()
  const resourcesGetters = getters(resourcesState)
  const resourcesActions = actions(resourcesState, resourcesGetters)

  test('An empty resource will be deleted on merge', () => {
    resourcesState.new.byId = {
      '/to-delete': {
        resource: {
          '@id': '/to-delete'
        },
        path: 'any'
      }
    }
    resourcesState.current.byId = {
      '/to-delete': {
        apiState: {
          status: undefined
        },
        data: {
          '@id': '/to-delete',
          '@type': 'MyType'
        }
      }
    }
    resourcesState.new.allIds = ['/to-delete']
    resourcesState.current.allIds = ['/to-delete']
    resourcesState.current.currentIds = ['/to-delete']
    resourcesActions.mergeNewResources()
    expect(resourcesState.current.byId).not.toHaveProperty('/to-delete')
    expect(resourcesState.current.allIds).toStrictEqual([])
    expect(resourcesState.current.currentIds).toStrictEqual([])
  })

  test('Merging a new resource adds to current resources', () => {
    resourcesState.new.byId = {
      '/to-add': {
        resource: {
          '@id': '/to-add',
          something: 'a value'
        },
        path: 'any'
      }
    }
    resourcesState.current.byId = {
      '/resource': {
        apiState: {
          status: undefined
        },
        data: {
          '@id': '/resource',
          '@type': 'MyType'
        }
      }
    }
    resourcesState.new.allIds = ['/to-add']
    resourcesState.current.allIds = ['/resource']
    resourcesState.current.currentIds = ['/resource']
    resourcesActions.mergeNewResources()
    expect(resourcesState.current.byId).toHaveProperty('/resource')
    expect(resourcesState.current.byId['/to-add']).toStrictEqual({
      apiState: {
        status: CwaResourceApiStatuses.SUCCESS,
        headers: {
          path: 'any'
        }
      },
      data: {
        '@id': '/to-add',
        something: 'a value'
      }
    })
    expect(resourcesState.current.allIds).toStrictEqual(['/resource', '/to-add'])
    expect(resourcesState.current.currentIds).toStrictEqual(['/resource', '/to-add'])
  })

  test('Merging an existing resource replaces it', () => {
    resourcesState.new.byId = {
      '/resource': {
        resource: {
          '@id': '/resource',
          something: 'a value'
        },
        path: 'any'
      }
    }
    resourcesState.current.byId = {
      '/resource': {
        apiState: {
          status: undefined
        },
        data: {
          '@id': '/resource',
          '@type': 'MyType'
        }
      }
    }
    resourcesState.new.allIds = ['/resource']
    resourcesState.current.allIds = ['/resource']
    resourcesState.current.currentIds = ['/resource']
    resourcesActions.mergeNewResources()
    expect(resourcesState.current.byId['/resource']).toStrictEqual({
      apiState: {
        status: CwaResourceApiStatuses.SUCCESS,
        headers: {
          path: 'any'
        }
      },
      data: {
        '@id': '/resource',
        something: 'a value'
      }
    })
    expect(resourcesState.current.allIds).toStrictEqual(['/resource'])
    expect(resourcesState.current.currentIds).toStrictEqual(['/resource'])

    expect(resourcesState.new).toStrictEqual({
      byId: {},
      allIds: []
    })
  })
})

describe('We can reset current resources', () => {
  const resourcesState = state()
  const resourcesGetters = getters(resourcesState)
  const resourcesActions = actions(resourcesState, resourcesGetters)

  test('We can reset current resources', () => {
    resourcesState.new.byId = {
      id: {}
    }
    resourcesState.new.allIds = ['id']
    resourcesState.current.currentIds = ['current']
    resourcesActions.resetCurrentResources()
    expect(resourcesState.new.byId).toStrictEqual({})
    expect(resourcesState.new.allIds).toStrictEqual([])
    expect(resourcesState.current.currentIds).toStrictEqual([])
  })

  test('We can reset current resources with new current IDs state', () => {
    resourcesState.new.byId = {
      id: {}
    }
    resourcesState.current.byId = {
      id: {
        apiState: {
          status: undefined
        }
      },
      current: {
        apiState: {
          status: undefined
        }
      }
    }
    resourcesState.new.allIds = ['id', 'current']
    resourcesState.current.currentIds = ['current']
    resourcesActions.resetCurrentResources(['id'])
    expect(resourcesState.new.byId).toStrictEqual({})
    expect(resourcesState.new.allIds).toStrictEqual([])
    expect(resourcesState.current.currentIds).toStrictEqual(['id'])
  })

  test('When we reset resources with new current IDs, non-errored resources and path reset', () => {
    resourcesState.new.byId = {
      id: {}
    }
    resourcesState.current.byId = {
      errored: {
        apiState: {
          status: CwaResourceApiStatuses.ERROR
        }
      },
      inProgress: {
        apiState: {
          status: CwaResourceApiStatuses.IN_PROGRESS,
          headers: { path: '1' }
        }
      },
      current: {
        apiState: {
          status: CwaResourceApiStatuses.SUCCESS,
          headers: {}
        }
      }
    }
    resourcesState.new.allIds = ['errored', 'inProgress']
    resourcesState.current.currentIds = ['current']
    resourcesActions.resetCurrentResources(['errored', 'inProgress'])
    expect(resourcesState.new.byId).toStrictEqual({})
    expect(resourcesState.new.allIds).toStrictEqual([])
    expect(resourcesState.current.currentIds).toStrictEqual(['errored', 'inProgress'])
    expect(resourcesState.current.byId.errored.apiState.status).toBe(CwaResourceApiStatuses.ERROR)
    expect(resourcesState.current.byId.inProgress.apiState).toStrictEqual({
      status: CwaResourceApiStatuses.SUCCESS,
      headers: { path: '1' }
    })
  })

  test('If we try and reset current ids with a resource id that does not exist, we get an error and resources are not reset', () => {
    resourcesState.new.byId = {
      id: {}
    }
    resourcesState.current.byId = {
      id: {
        apiState: {
          status: undefined
        }
      },
      current: {
        apiState: {
          status: undefined
        }
      }
    }
    resourcesState.new.allIds = ['id', 'current']
    resourcesState.current.currentIds = ['current']
    expect(() => {
      resourcesActions.resetCurrentResources(['id', 'something-else'])
    }).toThrowError('Cannot set current resource ID \'something-else\'. It does not exist.')
    expect(resourcesState.new.byId).toStrictEqual({
      id: {}
    })
    expect(resourcesState.new.allIds).toStrictEqual(['id', 'current'])
    expect(resourcesState.current.currentIds).toStrictEqual(['current'])
  })
})

describe('resources action -> setResourceFetchStatus', () => {
  const resourcesState = state()
  const resourcesGetters = getters(resourcesState)
  const resourcesActions = actions(resourcesState, resourcesGetters)

  test('We can set the status on a new resource', () => {
    resourcesActions.setResourceFetchStatus({ iri: 'id', isComplete: false })
    expect(resourcesState.current.byId.id.apiState.status).toBe(CwaResourceApiStatuses.IN_PROGRESS)
    expect(resourcesState.current.allIds).toStrictEqual(['id'])
    expect(resourcesState.current.currentIds).toStrictEqual(['id'])
  })

  test('We can set the status on an existing resource', () => {
    resourcesActions.setResourceFetchStatus({ iri: 'id', isComplete: true, headers: { path: 'my-path' } })
    expect(resourcesState.current.byId.id.apiState.status).toBe(CwaResourceApiStatuses.SUCCESS)
  })

  test('If we set a successful status to in progress, we retain the headers and path data', () => {
    resourcesActions.setResourceFetchStatus({ iri: 'id', isComplete: false })
    expect(resourcesState.current.byId.id.apiState).toStrictEqual({
      status: CwaResourceApiStatuses.IN_PROGRESS,
      headers: { path: 'my-path' }
    })
  })

  test('We clear existing fetch errors when setting a new status', () => {
    resourcesState.current.byId.id.apiState = {
      status: CwaResourceApiStatuses.ERROR,
      error: {
        statusCode: 101,
        primaryMessage: 'any'
      }
    }
    resourcesActions.setResourceFetchStatus({ iri: 'id', isComplete: true })
    expect(resourcesState.current.byId.id.apiState.status).toBe(CwaResourceApiStatuses.SUCCESS)
    expect(resourcesState.current.byId.id.apiState.error).toBeUndefined()
  })
})

describe('resources action setResourceFetchError', () => {
  let resourcesState: CwaResourcesStateInterface
  let resourcesActions: CwaResourcesActionsInterface

  beforeEach(() => {
    resourcesState = state()
    const resourcesGetters = getters(resourcesState)
    resourcesActions = actions(resourcesState, resourcesGetters)
  })

  test('We can set an error on a new resource', () => {
    resourcesActions.setResourceFetchError({ iri: 'id' })
    expect(resourcesState.current.byId.id.apiState.status).toBe(CwaResourceApiStatuses.ERROR)
    expect(resourcesState.current.byId.id.apiState.error).toBeUndefined()
    expect(resourcesState.current.allIds).toStrictEqual(['id'])
    expect(resourcesState.current.currentIds).toStrictEqual(['id'])
  })

  test('We can set an error on a new resource that is no longer current', () => {
    resourcesActions.setResourceFetchError({ iri: 'id', isCurrent: false })
    expect(resourcesState.current.byId.id.apiState.status).toBe(CwaResourceApiStatuses.ERROR)
    expect(resourcesState.current.byId.id.apiState.error).toBeUndefined()
    expect(resourcesState.current.allIds).toStrictEqual(['id'])
    expect(resourcesState.current.currentIds).toStrictEqual([])
  })

  test('We can set an error on a new resource with a fetch error', () => {
    const error: CwaResourceError = createCwaResourceError(new Error('Any error'))
    resourcesActions.setResourceFetchError({ iri: 'id', error })
    expect(resourcesState.current.byId.id.apiState.status).toBe(CwaResourceApiStatuses.ERROR)
    expect(resourcesState.current.byId.id.apiState.error).toStrictEqual(error.asObject)
  })

  test('We can set the status on an existing resource', () => {
    const error: CwaResourceError = createCwaResourceError(new Error('Any error'))
    resourcesActions.setResourceFetchError({ iri: 'id', error })
    expect(resourcesState.current.byId.id.apiState.status).toBe(CwaResourceApiStatuses.ERROR)
    expect(resourcesState.current.byId.id.apiState.error).toStrictEqual(error.asObject)
  })
})

describe('resources action saveResource', () => {
  const resourcesState = state()
  const resourcesGetters = getters(resourcesState)
  const resourcesActions = actions(resourcesState, resourcesGetters)

  test.each([{ action: 'save' }, { action: 'overwrite' }])('We can $action a new resource', ({ action }) => {
    const resource = {
      '@id': 'id',
      '@type': 'type',
      _metadata: {
        persisted: false
      },
      action
    }
    resourcesActions.saveResource({
      resource,
      isNew: true,
      path: '/my-path'
    })
    expect(resourcesState.new.byId).toStrictEqual({
      id: {
        path: '/my-path',
        resource
      }
    })
    expect(resourcesState.new.allIds).toStrictEqual(['id'])
  })

  test.each([{ action: 'save' }, { action: 'overwrite' }])('We can $action a current resource', ({ action }) => {
    const resource = {
      '@id': 'id',
      '@type': 'type',
      _metadata: {
        persisted: false
      },
      action
    }
    resourcesActions.saveResource({
      resource
    })
    expect(resourcesState.current.byId.id.data).toStrictEqual(resource)
    expect(resourcesState.current.allIds).toStrictEqual(['id'])
    expect(resourcesState.current.currentIds).toStrictEqual(['id'])
  })
})
