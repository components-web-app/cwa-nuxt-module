import { beforeEach, describe, expect, test } from 'vitest'
import { FetchError } from 'ohmyfetch'
import actions, { CwaResourcesActionsInterface } from './actions'
import state, { CwaResourceError, CwaResourcesStateInterface } from './state'

describe('We can reset current resources', () => {
  const resourcesState = state()
  const resourcesActions = actions(resourcesState)

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
      id: {},
      current: {}
    }
    resourcesState.new.allIds = ['id', 'current']
    resourcesState.current.currentIds = ['current']
    resourcesActions.resetCurrentResources(['id'])
    expect(resourcesState.new.byId).toStrictEqual({})
    expect(resourcesState.new.allIds).toStrictEqual([])
    expect(resourcesState.current.currentIds).toStrictEqual(['id'])
  })

  test('If we try and reset current ids with a resource id that does not exist, we get an error and resources are not reset', () => {
    resourcesState.new.byId = {
      id: {}
    }
    resourcesState.current.byId = {
      id: {},
      current: {}
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

describe('resources action setResourceFetchStatus', () => {
  const resourcesState = state()
  const resourcesActions = actions(resourcesState)
  test('We can set the status on a new resource', () => {
    resourcesActions.setResourceFetchStatus({ iri: 'id', isComplete: false })
    expect(resourcesState.current.byId.id.apiState.status).toBe(0)
    expect(resourcesState.current.allIds).toStrictEqual(['id'])
    expect(resourcesState.current.currentIds).toStrictEqual(['id'])
  })
  test('We can set the status on an existing resource', () => {
    resourcesActions.setResourceFetchStatus({ iri: 'id', isComplete: true })
    expect(resourcesState.current.byId.id.apiState.status).toBe(1)
  })
  test('We clear existing fetch errors when setting a new status', () => {
    resourcesState.current.byId.id.apiState = {
      status: -1,
      error: {
        statusCode: 101,
        message: 'any'
      }
    }
    resourcesActions.setResourceFetchStatus({ iri: 'id', isComplete: true })
    expect(resourcesState.current.byId.id.apiState.status).toBe(1)
    expect(resourcesState.current.byId.id.apiState.error).toBeUndefined()
  })
})

describe('resources action setResourceFetchError', () => {
  let resourcesState: CwaResourcesStateInterface
  let resourcesActions: CwaResourcesActionsInterface

  beforeEach(() => {
    resourcesState = state()
    resourcesActions = actions(resourcesState)
  })

  test('We can set an error on a new resource', () => {
    resourcesActions.setResourceFetchError({ iri: 'id' })
    expect(resourcesState.current.byId.id.apiState.status).toBe(-1)
    expect(resourcesState.current.byId.id.apiState.error).toBeUndefined()
    expect(resourcesState.current.allIds).toStrictEqual(['id'])
    expect(resourcesState.current.currentIds).toStrictEqual(['id'])
  })

  test('We can set an error on a new resource that is no longer current', () => {
    resourcesActions.setResourceFetchError({ iri: 'id', isCurrent: false })
    expect(resourcesState.current.byId.id.apiState.status).toBe(-1)
    expect(resourcesState.current.byId.id.apiState.error).toBeUndefined()
    expect(resourcesState.current.allIds).toStrictEqual(['id'])
    expect(resourcesState.current.currentIds).toStrictEqual([])
  })

  test('We can set an error on a new resource with a fetch error', () => {
    const error: CwaResourceError = { message: 'my error', statusCode: 404 }
    resourcesActions.setResourceFetchError({ iri: 'id', error })
    expect(resourcesState.current.byId.id.apiState.status).toBe(-1)
    expect(resourcesState.current.byId.id.apiState.error).toStrictEqual(error)
  })

  test('We can set the status on an existing resource', () => {
    const error: FetchError = { name: 'FetchError', message: 'my error' }
    resourcesActions.setResourceFetchError({ iri: 'id', error })
    expect(resourcesState.current.byId.id.apiState.status).toBe(-1)
    expect(resourcesState.current.byId.id.apiState.error).toStrictEqual(error)
  })
})

describe('resources action saveResource', () => {
  const resourcesState = state()
  const resourcesActions = actions(resourcesState)

  test('We can save a new resource', () => {
    const resource = {
      '@id': 'id',
      '@type': 'type',
      something: 'value'
    }
    resourcesActions.saveResource({
      resource,
      isNew: true
    })
    expect(resourcesState.new.byId).toStrictEqual({
      id: resource
    })
    expect(resourcesState.new.allIds).toStrictEqual(['id'])
  })

  test('We can overwrite a new resource', () => {
    const resource = {
      '@id': 'id',
      '@type': 'type',
      something: 'else'
    }
    resourcesActions.saveResource({
      resource,
      isNew: true
    })
    expect(resourcesState.new.byId).toStrictEqual({
      id: resource
    })
    expect(resourcesState.new.allIds).toStrictEqual(['id'])
  })

  test('We can save a current resource', () => {
    const resource = {
      '@id': 'id',
      '@type': 'type',
      something: 'value'
    }
    resourcesActions.saveResource({
      resource
    })
    expect(resourcesState.current.byId.id.data).toStrictEqual(resource)
    expect(resourcesState.current.allIds).toStrictEqual(['id'])
    expect(resourcesState.current.currentIds).toStrictEqual(['id'])
  })

  test('We can overwrite a new resource', () => {
    const resource = {
      '@id': 'id',
      '@type': 'type',
      something: 'else'
    }
    resourcesActions.saveResource({
      resource
    })
    expect(resourcesState.current.byId.id.data).toStrictEqual(resource)
    expect(resourcesState.current.allIds).toStrictEqual(['id'])
    expect(resourcesState.current.currentIds).toStrictEqual(['id'])
  })
})
