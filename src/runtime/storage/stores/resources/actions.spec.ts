// @vitest-environment happy-dom
import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest'
import * as app from '#app'
import { createCwaResourceError, CwaResourceError } from '../../../errors/cwa-resource-error'
import * as ResourceUtils from '../../../resources/resource-utils'
import type { CwaResourcesActionsInterface } from './actions'
import actions from './actions'
import type { CwaResourcesStateInterface } from './state'
import state, { CwaResourceApiStatuses } from './state'
import getters from './getters'

vi.mock('../../../resources/resource-utils', async () => {
  const actual = await vi.importActual<any>('../../../resources/resource-utils')
  return {
    ...actual,
    isCwaResourceSame: vi.fn(() => false)
  }
})

describe('Resources -> deleteResource', () => {
  const resourcesState = state()
  const resourcesGetters = getters(resourcesState)
  const resourcesActions = actions(resourcesState, resourcesGetters)

  test('Deleting a non-extent resource will silently fail', () => {
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
    resourcesState.current.currentIds = ['/to-delete']
    resourcesState.current.allIds = ['/to-delete']
    resourcesActions.deleteResource({
      resource: '/any-id'
    })
    expect(resourcesState.current.byId['/to-delete']).toStrictEqual({
      apiState: {
        status: undefined
      },
      data: {
        '@id': '/to-delete',
        '@type': 'MyType'
      }
    })
    expect(resourcesState.current.allIds).toStrictEqual(['/to-delete'])
    expect(resourcesState.current.currentIds).toStrictEqual(['/to-delete'])
  })

  test('A resource can be deleted', () => {
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
    resourcesState.current.currentIds = ['/to-delete']
    resourcesState.current.allIds = ['/to-delete']
    resourcesActions.deleteResource({
      resource: '/to-delete'
    })
    expect(resourcesState.current.byId).not.toHaveProperty('/to-delete')
    expect(resourcesState.current.allIds).toStrictEqual([])
    expect(resourcesState.current.currentIds).toStrictEqual([])
  })

  test('A component position resource will be cleared from all component groups when deleted', () => {
    resourcesState.current.byId = {
      '/_/component_positions/to-delete': {
        apiState: {
          status: undefined
        },
        data: {
          '@id': '/_/component_positions/to-delete',
          '@type': 'ComponentPosition'
        }
      },
      '/_/component_groups/group': {
        apiState: {
          status: undefined
        },
        data: {
          '@id': '/_/component_groups/group',
          componentPositions: [
            '/_/component_positions/to-delete',
            '/_/component_positions/to-keep'
          ]
        }
      }
    }
    resourcesState.current.currentIds = ['/_/component_positions/to-delete', '/_/component_groups/group']
    resourcesState.current.allIds = ['/_/component_positions/to-delete', '/_/component_groups/group']
    resourcesActions.deleteResource({
      resource: '/_/component_positions/to-delete'
    })
    expect(resourcesState.current.byId).not.toHaveProperty('/_/component_positions/to-delete')
    expect(resourcesState.current.allIds).toStrictEqual(['/_/component_groups/group'])
    expect(resourcesState.current.currentIds).toStrictEqual(['/_/component_groups/group'])
    expect(resourcesState.current.byId['/_/component_groups/group'].data.componentPositions).toStrictEqual(['/_/component_positions/to-keep'])
  })

  test('When deleting a component, the positions it is within should be deleted only when it is not a dynamic position', () => {
    resourcesState.current.byId = {
      '/component/to-delete': {
        apiState: {
          status: undefined
        },
        data: {
          '@id': '/component/to-delete',
          '@type': 'Component',
          componentPositions: [
            '/_/component_positions/static',
            '/_/component_positions/dynamic'
          ]
        }
      },
      '/_/component_positions/static': {
        apiState: {
          status: undefined
        },
        data: {
          '@id': '/_/component_positions/static',
          component: '/component/to-delete'
        }
      },
      '/_/component_positions/dynamic': {
        apiState: {
          status: undefined
        },
        data: {
          '@id': '/_/component_positions/dynamic',
          component: '/component/to-delete',
          pageDataProperty: 'anything'
        }
      }
    }
    resourcesState.current.currentIds = ['/component/to-delete', '/_/component_positions/static', '/_/component_positions/dynamic']
    resourcesState.current.allIds = ['/component/to-delete', '/_/component_positions/static', '/_/component_positions/dynamic']
    resourcesActions.deleteResource({
      resource: '/component/to-delete'
    })
    expect(resourcesState.current.byId).not.toHaveProperty('/component/to-delete')
    expect(resourcesState.current.byId).not.toHaveProperty('/_/component_positions/static')
    expect(resourcesState.current.allIds).toStrictEqual(['/_/component_positions/dynamic'])
    expect(resourcesState.current.currentIds).toStrictEqual(['/_/component_positions/dynamic'])
    expect(resourcesState.current.byId['/_/component_positions/dynamic'].data.component).toBeUndefined()
  })
})

describe('Resources -> mergeNewResources', () => {
  const resourcesState = state()
  const resourcesGetters = getters(resourcesState)
  const resourcesActions = actions(resourcesState, resourcesGetters)

  beforeEach(() => {
    vi.useFakeTimers()
    const date = new Date(2000, 1, 1, 13)
    vi.setSystemTime(date)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

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
        },
        fetchedAt: 949410000000
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

    const date = new Date(2004, 1, 1, 13)
    vi.setSystemTime(date)

    resourcesActions.mergeNewResources()
    expect(resourcesState.current.byId['/resource']).toStrictEqual({
      apiState: {
        status: CwaResourceApiStatuses.SUCCESS,
        headers: {
          path: 'any'
        },
        fetchedAt: 1075640400000
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

describe('Resources -> resetCurrentResources', () => {
  const resourcesState = state()
  const resourcesGetters = getters(resourcesState)
  const resourcesActions = actions(resourcesState, resourcesGetters)

  beforeEach(() => {
    vi.useFakeTimers()
    const date = new Date(2000, 1, 1, 13)
    vi.setSystemTime(date)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

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
      headers: { path: '1' },
      ssr: undefined,
      fetchedAt: 949410000000
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
      headers: { path: 'my-path' },
      ssr: false
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

  test.each([
    {
      showErrorPage: false,
      error: null
    },
    {
      showErrorPage: true,
      error: null
    },
    {
      showErrorPage: false,
      error: createCwaResourceError({})
    }
  ])('If the isPrimary param is $isPrimary and error is $error then we should NOT show an error page', ({ showErrorPage, error }) => {
    vi.spyOn(app, 'showError').mockImplementationOnce(() => {})
    resourcesActions.setResourceFetchError({ showErrorPage, iri: 'id', error })
    expect(app.showError).not.toHaveBeenCalled()
  })

  test('is isPrimary is true and there is an error then showError should be called', () => {
    vi.spyOn(app, 'showError').mockImplementationOnce(() => {})
    const error = createCwaResourceError({ message: 'my message' })
    resourcesActions.setResourceFetchError({ showErrorPage: true, iri: 'id', error })
    expect(app.showError).toHaveBeenCalledWith({ statusCode: error.statusCode, message: error.message })
  })
})

describe('resources action -> saveResource', () => {
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

  test('A new resource will not be saved if it is the same as an existing resource', () => {
    vi.spyOn(ResourceUtils, 'isCwaResourceSame').mockImplementationOnce(() => {
      return true
    })

    resourcesState.new = {
      byId: {},
      allIds: []
    }
    resourcesState.current.byId = {
      id: {
        apiState: {
          status: undefined
        },
        data: {
          '@id': 'id',
          '@type': 'MyType'
        }
      }
    }
    resourcesState.current.currentIds = ['id']
    const resource = {
      '@id': 'id',
      '@type': 'type',
      _metadata: {
        persisted: false
      },
      action: 'something new'
    }
    resourcesActions.saveResource({
      resource,
      isNew: true,
      path: '/my-path'
    })
    expect(resourcesState.new).toStrictEqual({
      byId: {},
      allIds: []
    })
  })
})
