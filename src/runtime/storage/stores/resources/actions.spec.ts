// @vitest-environment happy-dom
import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest'
import type { CwaResourceError } from '../../../errors/cwa-resource-error'
import { createCwaResourceError } from '../../../errors/cwa-resource-error'
import * as ResourceUtils from '../../../resources/resource-utils'
import type { CwaResourcesActionsInterface } from './actions'
import actions from './actions'
import type { CwaResourcesStateInterface } from './state'
import state, { CwaResourceApiStatuses } from './state'
import getters from './getters'
import * as app from 'nuxt/app'
import { createError } from 'h3'

vi.mock('../../../resources/resource-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof ResourceUtils>()
  return {
    ...actual,
    isCwaResourceSame: vi.fn(() => false),
  }
})

vi.mock('h3', () => {
  return {
    createError: vi.fn(obj => obj),
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
          status: undefined,
        },
        data: {
          '@id': '/to-delete',
          '@type': 'MyType',
        },
      },
    }
    resourcesState.current.currentIds = ['/to-delete']
    resourcesState.current.allIds = ['/to-delete']
    resourcesActions.deleteResource({
      resource: '/any-id',
    })
    expect(resourcesState.current.byId['/to-delete']).toStrictEqual({
      apiState: {
        status: undefined,
      },
      data: {
        '@id': '/to-delete',
        '@type': 'MyType',
      },
    })
    expect(resourcesState.current.allIds).toStrictEqual(['/to-delete'])
    expect(resourcesState.current.currentIds).toStrictEqual(['/to-delete'])
  })

  test('A resource can be deleted', () => {
    resourcesState.current.byId = {
      '/to-delete': {
        apiState: {
          status: undefined,
        },
        data: {
          '@id': '/to-delete',
          '@type': 'MyType',
        },
      },
    }
    resourcesState.current.currentIds = ['/to-delete']
    resourcesState.current.allIds = ['/to-delete']
    resourcesActions.deleteResource({
      resource: '/to-delete',
    })
    expect(resourcesState.current.byId).not.toHaveProperty('/to-delete')
    expect(resourcesState.current.allIds).toStrictEqual([])
    expect(resourcesState.current.currentIds).toStrictEqual([])
  })

  test('A component position resource will be cleared from all component groups when deleted', () => {
    resourcesState.current.byId = {
      '/_/component_positions/to-delete': {
        apiState: {
          status: undefined,
        },
        data: {
          '@id': '/_/component_positions/to-delete',
          '@type': 'ComponentPosition',
        },
      },
      '/_/component_groups/group': {
        apiState: {
          status: undefined,
        },
        data: {
          '@id': '/_/component_groups/group',
          'componentPositions': [
            '/_/component_positions/to-delete',
            '/_/component_positions/to-keep',
          ],
        },
      },
    }
    resourcesState.current.currentIds = ['/_/component_positions/to-delete', '/_/component_groups/group']
    resourcesState.current.allIds = ['/_/component_positions/to-delete', '/_/component_groups/group']
    resourcesActions.deleteResource({
      resource: '/_/component_positions/to-delete',
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
          status: undefined,
        },
        data: {
          '@id': '/component/to-delete',
          '@type': 'Component',
          'componentPositions': [
            '/_/component_positions/static',
            '/_/component_positions/dynamic',
          ],
          '_metadata': {},
        },
      },
      '/_/component_positions/static': {
        apiState: {
          status: undefined,
        },
        data: {
          '@id': '/_/component_positions/static',
          'component': '/component/to-delete',
        },
      },
      '/_/component_positions/dynamic': {
        apiState: {
          status: undefined,
        },
        data: {
          '@id': '/_/component_positions/dynamic',
          'component': '/component/to-delete',
          'pageDataProperty': 'anything',
        },
      },
    }
    resourcesState.current.currentIds = ['/component/to-delete', '/_/component_positions/static', '/_/component_positions/dynamic']
    resourcesState.current.allIds = ['/component/to-delete', '/_/component_positions/static', '/_/component_positions/dynamic']
    resourcesActions.deleteResource({
      resource: '/component/to-delete',
    })
    expect(resourcesState.current.byId).not.toHaveProperty('/component/to-delete')
    expect(resourcesState.current.byId).not.toHaveProperty('/_/component_positions/static')
    expect(resourcesState.current.allIds).toStrictEqual(['/_/component_positions/dynamic'])
    expect(resourcesState.current.currentIds).toStrictEqual(['/_/component_positions/dynamic'])
    expect(resourcesState.current.byId['/_/component_positions/dynamic'].data.component).toBeUndefined()
  })

  test('Deleting a PAGE_DATA resource silently completes (noop branch)', () => {
    const resourcesState = state()
    const resourcesGetters = getters(resourcesState)
    const resourcesActions = actions(resourcesState, resourcesGetters)

    const iri = '/page_data/1'
    resourcesState.current.byId[iri] = { apiState: { status: undefined } }
    resourcesState.current.allIds.push(iri)

    resourcesActions.deleteResource({ resource: iri })
    expect(resourcesState.current.byId[iri]).toBeUndefined()
  })

  test('Deleting a COMPONENT_POSITION with noCascade skips group update', () => {
    const resourcesState = state()
    const resourcesGetters = getters(resourcesState)
    const resourcesActions = actions(resourcesState, resourcesGetters)

    const groupIri = '/_/component_groups/group-1'
    const positionIri = '/_/component_positions/pos-1'
    resourcesState.current.byId[groupIri] = {
      apiState: { status: undefined },
      data: {
        '@id': groupIri,
        '@type': 'ComponentGroup',
        '_metadata': { persisted: true },
        'componentPositions': [positionIri],
      },
    }
    resourcesState.current.byId[positionIri] = { apiState: { status: undefined } }
    resourcesState.current.allIds.push(groupIri, positionIri)

    resourcesActions.deleteResource({ resource: positionIri, noCascade: true })

    // position deleted, but group componentPositions unchanged
    expect(resourcesState.current.byId[positionIri]).toBeUndefined()
    expect(resourcesState.current.byId[groupIri].data?.componentPositions).toEqual([positionIri])
  })

  test('Deleting a COMPONENT with noCascade skips position cleanup', () => {
    const resourcesState = state()
    const resourcesGetters = getters(resourcesState)
    const resourcesActions = actions(resourcesState, resourcesGetters)

    const componentIri = '/component/comp-1'
    const positionIri = '/_/component_positions/pos-1'
    resourcesState.current.byId[componentIri] = {
      apiState: { status: undefined },
      data: {
        '@id': componentIri,
        '@type': 'Component',
        '_metadata': { persisted: true },
        'componentPositions': [positionIri],
      },
    }
    resourcesState.current.byId[positionIri] = {
      apiState: { status: undefined },
      data: {
        '@id': positionIri,
        '@type': 'ComponentPosition',
        '_metadata': { persisted: true },
        'component': componentIri,
      },
    }
    resourcesState.current.allIds.push(componentIri, positionIri)

    resourcesActions.deleteResource({ resource: componentIri, noCascade: true })

    expect(resourcesState.current.byId[componentIri]).toBeUndefined()
    // position not deleted because noCascade
    expect(resourcesState.current.byId[positionIri]).toBeDefined()
  })

  test('Deleting a COMPONENT with alternative versions updates positions to other version', () => {
    const resourcesState = state()
    const resourcesGetters = getters(resourcesState)
    const resourcesActions = actions(resourcesState, resourcesGetters)

    const draftIri = '/component/draft-1'
    const publishedIri = '/component/published-1'
    const positionIri = '/_/component_positions/pos-1'

    // Set up publishable mapping so findAllPublishableIris returns both IRIs
    resourcesState.current.publishableMapping = [{ publishedIri, draftIri }]
    resourcesState.current.byId[draftIri] = {
      apiState: { status: undefined },
      data: {
        '@id': draftIri,
        '@type': 'Component',
        '_metadata': { persisted: true, publishable: { published: false, publishedAt: '2024-01-01' } },
        'componentPositions': [positionIri],
      },
    }
    resourcesState.current.byId[positionIri] = {
      apiState: { status: undefined },
      data: {
        '@id': positionIri,
        '@type': 'ComponentPosition',
        '_metadata': { persisted: true },
        'component': draftIri,
      },
    }
    resourcesState.current.allIds.push(draftIri, positionIri)

    resourcesActions.deleteResource({ resource: draftIri })

    // Position should now reference the published version
    expect(resourcesState.current.byId[positionIri]?.data?.component).toBe(publishedIri)
    expect(resourcesState.current.byId[draftIri]).toBeUndefined()
  })
})

describe('Resources -> mergeNewResources', () => {
  const resourcesState = state()
  const resourcesGetters = getters(resourcesState)
  const resourcesActions = actions(resourcesState, resourcesGetters)
  const fetchedAtDate = new Date(2000, 1, 1, 13)
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(fetchedAtDate)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('An empty resource will be deleted on merge', () => {
    resourcesState.new.byId = {
      '/to-delete': {
        resource: {
          '@id': '/to-delete',
        },
        path: 'any',
      },
    }
    resourcesState.current.byId = {
      '/to-delete': {
        apiState: {
          status: undefined,
        },
        data: {
          '@id': '/to-delete',
          '@type': 'MyType',
        },
      },
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
          'something': 'a value',
        },
        path: 'any',
      },
    }
    resourcesState.current.byId = {
      '/resource': {
        apiState: {
          status: undefined,
        },
        data: {
          '@id': '/resource',
          '@type': 'MyType',
        },
      },
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
          path: 'any',
        },
        fetchedAt: fetchedAtDate.getTime(),
      },
      data: {
        '@id': '/to-add',
        'something': 'a value',
      },
    })
    expect(resourcesState.current.allIds).toStrictEqual(['/resource', '/to-add'])
    expect(resourcesState.current.currentIds).toStrictEqual(['/resource', '/to-add'])
  })

  test('Merging an existing resource replaces it', () => {
    resourcesState.new.byId = {
      '/resource': {
        resource: {
          '@id': '/resource',
          'something': 'a value',
        },
        path: 'any',
      },
    }
    resourcesState.current.byId = {
      '/resource': {
        apiState: {
          status: undefined,
        },
        data: {
          '@id': '/resource',
          '@type': 'MyType',
        },
      },
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
          path: 'any',
        },
        fetchedAt: date.getTime(),
      },
      data: {
        '@id': '/resource',
        'something': 'a value',
      },
    })
    expect(resourcesState.current.allIds).toStrictEqual(['/resource'])
    expect(resourcesState.current.currentIds).toStrictEqual(['/resource'])

    expect(resourcesState.new).toStrictEqual({
      byId: {},
      allIds: [],
    })
  })
})

describe('Resources -> resetCurrentResources', () => {
  const resourcesState = state()
  const resourcesGetters = getters(resourcesState)
  const resourcesActions = actions(resourcesState, resourcesGetters)
  const fetchedAtDate = new Date(2000, 1, 1, 13)
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(fetchedAtDate)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('We can reset current resources', () => {
    resourcesState.new.byId = {
      id: {},
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
      id: {},
    }
    resourcesState.current.byId = {
      id: {
        apiState: {
          status: undefined,
        },
      },
      current: {
        apiState: {
          status: undefined,
        },
      },
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
      id: {},
    }
    resourcesState.current.byId = {
      errored: {
        apiState: {
          status: CwaResourceApiStatuses.ERROR,
        },
      },
      inProgress: {
        apiState: {
          status: CwaResourceApiStatuses.IN_PROGRESS,
          headers: { path: '1' },
          path: 'inProgress', // match the ID to set it as successful again.
        },
      },
      current: {
        apiState: {
          status: CwaResourceApiStatuses.SUCCESS,
          headers: {},
          responseIri: '/sample-different-response',
          iri: '/user-provided-iri',
        },
      },
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
      path: 'inProgress',
      ssr: undefined,
      fetchedAt: fetchedAtDate.getTime(),
      iri: undefined,
      responseIri: undefined,
    })
  })

  test('If we try and reset current ids with a resource id that does not exist, we get an error and resources are not reset', () => {
    resourcesState.new.byId = {
      id: {},
    }
    resourcesState.current.byId = {
      id: {
        apiState: {
          status: undefined,
        },
      },
      current: {
        apiState: {
          status: undefined,
        },
      },
    }
    resourcesState.new.allIds = ['id', 'current']
    resourcesState.current.currentIds = ['current']
    expect(() => {
      resourcesActions.resetCurrentResources(['id', 'something-else'])
    }).toThrowError('Cannot set current resource ID \'something-else\'. It does not exist.')
    expect(resourcesState.new.byId).toStrictEqual({
      id: {},
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
    resourcesActions.setResourceFetchStatus({ iri: 'id', isComplete: false, path: '/hello' })
    expect(resourcesState.current.byId.id.apiState).toStrictEqual({
      status: CwaResourceApiStatuses.IN_PROGRESS,
      headers: { path: 'my-path' },
      path: '/hello',
      ssr: false,
    })
  })

  test('We clear existing fetch errors when setting a new status', () => {
    resourcesState.current.byId.id.apiState = {
      status: CwaResourceApiStatuses.ERROR,
      error: {
        statusCode: 101,
        primaryMessage: 'any',
      },
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
      error: null,
    },
    {
      showErrorPage: true,
      error: null,
    },
    {
      showErrorPage: false,
      error: createCwaResourceError({}),
    },
  ])('If the isPrimary param is $isPrimary and error is $error then we should NOT show an error page', ({ showErrorPage, error }) => {
    vi.spyOn(app, 'showError').mockImplementationOnce(() => {})
    resourcesActions.setResourceFetchError({ showErrorPage, iri: 'id', error })
    expect(app.showError).not.toHaveBeenCalled()
  })

  test('is isPrimary is true and there is an error then showError should be called', () => {
    vi.spyOn(app, 'showError').mockImplementationOnce(() => {})
    const error = createCwaResourceError({ statusMessage: 'teapot', statusCode: 418 })
    resourcesActions.setResourceFetchError({ showErrorPage: true, iri: 'id', error })

    const createErrorObj = {
      name: 'cwa-resource-error',
      statusCode: 418,
      statusMessage: 'teapot',
      message: 'teapot',
      cause: 'Resource store returned a bad status code on a primary fetch',
      data: error,
    }

    expect(createError).toHaveBeenCalledWith(createErrorObj)
    expect(app.showError).toHaveBeenCalledWith(createErrorObj)
  })
})

describe('resources action -> setResourceFetchStatus dynamic position', () => {
  test('clears data when dynamic position path changes', () => {
    const resourcesState = state()
    const resourcesGetters = getters(resourcesState)
    const resourcesActions = actions(resourcesState, resourcesGetters)

    const iri = '/_/component_positions/dynamic-pos'
    resourcesState.current.byId[iri] = {
      apiState: {
        status: CwaResourceApiStatuses.SUCCESS,
        headers: { path: '/page-a' },
        fetchedAt: 1000,
      },
      data: {
        '@id': iri,
        '@type': 'ComponentPosition',
        '_metadata': { persisted: true, isDynamicPosition: true },
      },
    }
    resourcesState.current.allIds.push(iri)

    resourcesActions.setResourceFetchStatus({ iri, isComplete: false, path: '/page-b' })
    expect(resourcesState.current.byId[iri].data).toBeUndefined()
  })

  test('retains data when dynamic position headers path matches', () => {
    const resourcesState = state()
    const resourcesGetters = getters(resourcesState)
    const resourcesActions = actions(resourcesState, resourcesGetters)

    const iri = '/_/component_positions/dynamic-pos'
    const originalData = {
      '@id': iri,
      '@type': 'ComponentPosition',
      '_metadata': { persisted: true, isDynamicPosition: true },
    }
    resourcesState.current.byId[iri] = {
      apiState: {
        status: CwaResourceApiStatuses.SUCCESS,
        headers: { path: '/page-a' },
        fetchedAt: 1000,
      },
      data: originalData,
    }
    resourcesState.current.allIds.push(iri)

    // Pass matching headers so getHeaders(event).path === getHeaders(originalApiState).path
    resourcesActions.setResourceFetchStatus({ iri, isComplete: false, path: '/page-a', headers: { path: '/page-a' } })
    expect(resourcesState.current.byId[iri].data).toBeDefined()
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
      '_metadata': {
        persisted: false,
      },
      action,
    }
    resourcesActions.saveResource({
      resource,
      isNew: true,
      path: '/my-path',
    })
    expect(resourcesState.new.byId).toStrictEqual({
      id: {
        path: '/my-path',
        resource,
      },
    })
    expect(resourcesState.new.allIds).toStrictEqual(['id'])
  })

  test.each([{ action: 'save' }, { action: 'overwrite' }])('We can $action a current resource', ({ action }) => {
    const resource = {
      '@id': 'id',
      '@type': 'type',
      '_metadata': {
        persisted: false,
      },
      action,
    }
    resourcesActions.saveResource({
      resource,
    })
    expect(resourcesState.current.byId.id.data).toStrictEqual(resource)
    expect(resourcesState.current.allIds).toStrictEqual(['id'])
    // resource was not already in currentIds — CRUD saves must not add to currentIds (#198)
    expect(resourcesState.current.currentIds).toStrictEqual([])
  })

  test('saveResource does not add a newly created resource to currentIds (#198: prevents OutdatedContentNotice on admin CRUD)', () => {
    resourcesState.current.currentIds = []
    const resource = { '@id': '/_/pages/new-uuid', '@type': 'Page', '_metadata': { persisted: true } }
    resourcesActions.saveResource({ resource })
    expect(resourcesState.current.byId['/_/pages/new-uuid'].data).toStrictEqual(resource)
    expect(resourcesState.current.allIds).toContain('/_/pages/new-uuid')
    expect(resourcesState.current.currentIds).toStrictEqual([])
  })

  test('saveResource keeps resource in currentIds when it was already present (PATCH on currently-displayed resource)', () => {
    resourcesState.current.byId['already-current'] = { apiState: { status: undefined } }
    resourcesState.current.allIds.push('already-current')
    resourcesState.current.currentIds = ['already-current']
    const resource = { '@id': 'already-current', '@type': 'type', '_metadata': { persisted: true }, 'title': 'updated' }
    resourcesActions.saveResource({ resource })
    expect(resourcesState.current.byId['already-current'].data).toStrictEqual(resource)
    expect(resourcesState.current.currentIds).toStrictEqual(['already-current'])
  })

  test('A new resource will not be saved if it is the same as an existing resource', () => {
    vi.spyOn(ResourceUtils, 'isCwaResourceSame').mockImplementationOnce(() => {
      return true
    })

    resourcesState.new = {
      byId: {},
      allIds: [],
    }
    resourcesState.current.byId = {
      id: {
        apiState: {
          status: undefined,
        },
        data: {
          '@id': 'id',
          '@type': 'MyType',
        },
      },
    }
    resourcesState.current.currentIds = ['id']
    const resource = {
      '@id': 'id',
      '@type': 'type',
      '_metadata': {
        persisted: false,
      },
      'action': 'something new',
    }
    resourcesActions.saveResource({
      resource,
      isNew: true,
      path: '/my-path',
    })
    expect(resourcesState.new).toStrictEqual({
      byId: {},
      allIds: [],
    })
  })

  test('saveResource does not map when resource has no publishable metadata', () => {
    const resourcesState = state()
    const resourcesGetters = getters(resourcesState)
    const resourcesActions = actions(resourcesState, resourcesGetters)

    const resource = {
      '@id': '/component/comp-1',
      '@type': 'Component',
      '_metadata': { persisted: true },
    }
    resourcesActions.saveResource({ resource })
    expect(resourcesState.current.publishableMapping).toEqual([])
  })

  test('saveResource does not map when published component has no draftResource', () => {
    const resourcesState = state()
    const resourcesGetters = getters(resourcesState)
    const resourcesActions = actions(resourcesState, resourcesGetters)

    const resource = {
      '@id': '/component/published-1',
      '@type': 'Component',
      '_metadata': { persisted: true, publishable: { published: true, publishedAt: '2024-01-01' } },
    }
    resourcesActions.saveResource({ resource })
    expect(resourcesState.current.publishableMapping).toEqual([])
  })

  test('saveResource does not map when draft component has no publishedResource', () => {
    const resourcesState = state()
    const resourcesGetters = getters(resourcesState)
    const resourcesActions = actions(resourcesState, resourcesGetters)

    const resource = {
      '@id': '/component/draft-1',
      '@type': 'Component',
      '_metadata': { persisted: true, publishable: { published: false, publishedAt: '2024-01-01' } },
    }
    resourcesActions.saveResource({ resource })
    expect(resourcesState.current.publishableMapping).toEqual([])
  })

  test('saveResource maps a published component to its draft', () => {
    const resourcesState = state()
    const resourcesGetters = getters(resourcesState)
    const resourcesActions = actions(resourcesState, resourcesGetters)

    const publishedIri = '/component/published-1'
    const draftIri = '/component/draft-1'
    const resource = {
      '@id': publishedIri,
      '@type': 'Component',
      '_metadata': { persisted: true, publishable: { published: true, publishedAt: '2024-01-01' } },
      'draftResource': draftIri,
    }
    resourcesActions.saveResource({ resource })

    expect(resourcesState.current.publishableMapping).toEqual([{ publishedIri, draftIri }])
  })

  test('saveResource maps a draft component to its published version', () => {
    const resourcesState = state()
    const resourcesGetters = getters(resourcesState)
    const resourcesActions = actions(resourcesState, resourcesGetters)

    const publishedIri = '/component/published-1'
    const draftIri = '/component/draft-1'
    const resource = {
      '@id': draftIri,
      '@type': 'Component',
      '_metadata': { persisted: true, publishable: { published: false, publishedAt: '2024-01-01' } },
      'publishedResource': publishedIri,
    }
    resourcesActions.saveResource({ resource })

    expect(resourcesState.current.publishableMapping).toEqual([{ publishedIri, draftIri }])
  })

  test('saveResource maps a position to its component', () => {
    const resourcesState = state()
    const resourcesGetters = getters(resourcesState)
    const resourcesActions = actions(resourcesState, resourcesGetters)

    const positionIri = '/_/component_positions/pos-1'
    const componentIri = '/component/comp-1'
    const resource = {
      '@id': positionIri,
      '@type': 'ComponentPosition',
      '_metadata': { persisted: true },
      'component': componentIri,
    }
    resourcesActions.saveResource({ resource })

    expect(resourcesState.current.positionsByComponent[componentIri]).toContain(positionIri)
  })
})

describe('resources action -> clearResources', () => {
  test('clears all current and new resource state', () => {
    const resourcesState = state()
    const resourcesGetters = getters(resourcesState)
    const resourcesActions = actions(resourcesState, resourcesGetters)

    resourcesState.current.byId = {
      '/some/resource': { apiState: { status: undefined }, data: { '@id': '/some/resource', '@type': 'Component', '_metadata': { persisted: true } } },
    }
    resourcesState.current.allIds = ['/some/resource']
    resourcesState.current.currentIds = ['/some/resource']
    resourcesState.current.publishableMapping = [{ publishedIri: '/component/a', draftIri: '/component/b' }]
    resourcesState.current.positionsByComponent = { '/component/a': ['/_/component_positions/1'] }
    resourcesState.new.byId = { '/some/new': { resource: { '@id': '/some/new', '@type': 'Component', '_metadata': { persisted: false } } } }
    resourcesState.new.allIds = ['/some/new']

    resourcesActions.clearResources()

    expect(resourcesState.current.byId).toEqual({})
    expect(resourcesState.current.allIds).toEqual([])
    expect(resourcesState.current.currentIds).toEqual([])
    expect(resourcesState.current.publishableMapping).toEqual([])
    expect(resourcesState.current.positionsByComponent).toEqual({})
    expect(resourcesState.new.byId).toEqual({})
    expect(resourcesState.new.allIds).toEqual([])
  })
})

describe('resources action -> resetNewResource', () => {
  test('does nothing when adding.value is undefined', () => {
    const resourcesState = state()
    const resourcesGetters = getters(resourcesState)
    const resourcesActions = actions(resourcesState, resourcesGetters)

    resourcesState.adding.value = undefined
    resourcesActions.resetNewResource()
    expect(resourcesState.adding.value).toBeUndefined()
  })

  test('handles clearPositionFromGroup when position resource has no data', () => {
    const resourcesState = state()
    const resourcesGetters = getters(resourcesState)
    const resourcesActions = actions(resourcesState, resourcesGetters)

    const resourceIri = '__new__'
    // Resource exists in byId but has no data
    resourcesState.current.byId[resourceIri] = { apiState: { status: undefined } }
    resourcesState.current.allIds.push(resourceIri)
    resourcesState.adding.value = { resource: resourceIri }

    resourcesActions.resetNewResource()
    expect(resourcesState.adding.value).toBeUndefined()
  })

  test('handles clearPositionFromGroup when position resource has no componentGroup', () => {
    const resourcesState = state()
    const resourcesGetters = getters(resourcesState)
    const resourcesActions = actions(resourcesState, resourcesGetters)

    const resourceIri = '__new__'
    resourcesState.current.byId[resourceIri] = {
      apiState: { status: undefined },
      data: {
        '@id': resourceIri,
        '@type': 'ComponentPosition',
        '_metadata': { persisted: false },
        // no componentGroup
      },
    }
    resourcesState.current.allIds.push(resourceIri)
    resourcesState.adding.value = { resource: resourceIri }

    resourcesActions.resetNewResource()
    expect(resourcesState.adding.value).toBeUndefined()
  })

  test('handles clearPositionFromGroup when componentGroup has no data', () => {
    const resourcesState = state()
    const resourcesGetters = getters(resourcesState)
    const resourcesActions = actions(resourcesState, resourcesGetters)

    const groupIri = '/_/component_groups/group-1'
    const resourceIri = '__new__'
    resourcesState.current.byId[groupIri] = { apiState: { status: undefined } } // no data
    resourcesState.current.byId[resourceIri] = {
      apiState: { status: undefined },
      data: {
        '@id': resourceIri,
        '@type': 'ComponentPosition',
        '_metadata': { persisted: false },
        'componentGroup': groupIri,
      },
    }
    resourcesState.current.allIds.push(groupIri, resourceIri)
    resourcesState.adding.value = { resource: resourceIri }

    resourcesActions.resetNewResource()
    expect(resourcesState.adding.value).toBeUndefined()
  })

  test('deletes the resource and clears adding when adding.value.resource is set (no position)', () => {
    const resourcesState = state()
    const resourcesGetters = getters(resourcesState)
    const resourcesActions = actions(resourcesState, resourcesGetters)

    const groupIri = '/_/component_groups/group-1'
    const resourceIri = '__new__'
    resourcesState.current.byId[groupIri] = {
      apiState: { status: undefined },
      data: {
        '@id': groupIri,
        '@type': 'ComponentGroup',
        '_metadata': { persisted: true },
        'componentPositions': [resourceIri],
      },
    }
    resourcesState.current.allIds.push(groupIri)

    resourcesState.current.byId[resourceIri] = {
      apiState: { status: undefined },
      data: {
        '@id': resourceIri,
        '@type': 'ComponentPosition',
        '_metadata': { persisted: false },
        'componentGroup': groupIri,
      },
    }
    resourcesState.current.allIds.push(resourceIri)
    resourcesState.adding.value = { resource: resourceIri }

    resourcesActions.resetNewResource()

    expect(resourcesState.adding.value).toBeUndefined()
    expect(resourcesState.current.byId[resourceIri]).toBeUndefined()
  })

  test('deletes both position and resource when adding.value.position is set', () => {
    const resourcesState = state()
    const resourcesGetters = getters(resourcesState)
    const resourcesActions = actions(resourcesState, resourcesGetters)

    const groupIri = '/_/component_groups/group-1'
    const positionIri = '/_/component_positions/__new__'
    const resourceIri = '__new__'

    resourcesState.current.byId[groupIri] = {
      apiState: { status: undefined },
      data: {
        '@id': groupIri,
        '@type': 'ComponentGroup',
        '_metadata': { persisted: true },
        'componentPositions': [positionIri],
      },
    }
    resourcesState.current.allIds.push(groupIri)

    resourcesState.current.byId[positionIri] = {
      apiState: { status: undefined },
      data: {
        '@id': positionIri,
        '@type': 'ComponentPosition',
        '_metadata': { persisted: false },
        'componentGroup': groupIri,
      },
    }
    resourcesState.current.allIds.push(positionIri)

    resourcesState.current.byId[resourceIri] = {
      apiState: { status: undefined },
      data: {
        '@id': resourceIri,
        '@type': 'Component',
        '_metadata': { persisted: false },
      },
    }
    resourcesState.current.allIds.push(resourceIri)
    resourcesState.adding.value = { resource: resourceIri, position: positionIri }

    resourcesActions.resetNewResource()

    expect(resourcesState.adding.value).toBeUndefined()
    expect(resourcesState.current.byId[positionIri]).toBeUndefined()
    expect(resourcesState.current.byId[resourceIri]).toBeUndefined()
  })
})

describe('resources action -> initNewResource', () => {
  test('creates a new component resource and sets adding state (addAfter null, no pageDataProperty)', () => {
    const resourcesState = state()
    const resourcesGetters = getters(resourcesState)
    const resourcesActions = actions(resourcesState, resourcesGetters)

    const addResourceEvent = {
      addAfter: null,
      targetIri: '/_/component_groups/group-1',
      closest: { group: '/_/component_groups/group-1', position: '/_/component_positions/pos-1' },
    }

    resourcesActions.initNewResource(addResourceEvent, 'Component', '/components', false, false)

    expect(resourcesState.adding.value?.resource).toBe('__new__')
    expect(resourcesState.adding.value?.position).toBeUndefined()
  })

  test('creates position resource when addAfter is set', () => {
    const resourcesState = state()
    const resourcesGetters = getters(resourcesState)
    const resourcesActions = actions(resourcesState, resourcesGetters)

    const addResourceEvent = {
      addAfter: true,
      targetIri: '/_/component_positions/pos-1',
      closest: { group: '/_/component_groups/group-1', position: '/_/component_positions/pos-1' },
    }

    resourcesActions.initNewResource(addResourceEvent, 'Component', '/components', false, false)

    expect(resourcesState.adding.value?.resource).toBe('__new__')
    expect(resourcesState.adding.value?.position).toBe('/_/component_positions/__new__')
  })

  test('adds new resource to existing group componentPositions when closestGroup has data', () => {
    const resourcesState = state()
    const resourcesGetters = getters(resourcesState)
    const resourcesActions = actions(resourcesState, resourcesGetters)

    const groupIri = '/_/component_groups/group-1'
    const existingPositionIri = '/_/component_positions/existing-1'
    resourcesState.current.byId[groupIri] = {
      apiState: { status: undefined },
      data: {
        '@id': groupIri,
        '@type': 'ComponentGroup',
        '_metadata': { persisted: true },
        'componentPositions': [existingPositionIri],
      },
    }
    resourcesState.current.allIds.push(groupIri)

    const addResourceEvent = {
      addAfter: true,
      targetIri: existingPositionIri,
      closest: { group: groupIri, position: existingPositionIri },
    }
    resourcesActions.initNewResource(addResourceEvent, 'Component', '/components', false, false)

    const groupData = resourcesState.current.byId[groupIri].data
    expect(groupData?.componentPositions).toContain('/_/component_positions/__new__')
  })

  test('creates a ComponentPosition resource (type ComponentPosition)', () => {
    const resourcesState = state()
    const resourcesGetters = getters(resourcesState)
    const resourcesActions = actions(resourcesState, resourcesGetters)

    const addResourceEvent = {
      addAfter: null,
      targetIri: '/_/component_groups/group-1',
      closest: { group: '/_/component_groups/group-1' },
    }

    resourcesActions.initNewResource(addResourceEvent, 'ComponentPosition', '/component_positions', false, false)

    const newResource = resourcesState.current.byId['__new__']
    expect(newResource?.data?.['@type']).toBe('ComponentPosition')
    expect(newResource?.data?.componentGroup).toBe('/_/component_groups/group-1')
  })
})
