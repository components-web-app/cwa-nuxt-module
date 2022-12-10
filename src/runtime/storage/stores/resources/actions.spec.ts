import { describe, expect, test } from 'vitest'
import { FetchError } from 'ohmyfetch'
import actions from './actions'
import state from './state'

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
})

describe('resources action setResourceFetchStatus', () => {
  const resourcesState = state()
  const resourcesActions = actions(resourcesState)
  test('We can set the status on a new resource', () => {
    resourcesActions.setResourceFetchStatus({ iri: 'id', status: 0 })
    expect(resourcesState.current.byId.id.apiState.status).toBe(0)
    expect(resourcesState.current.allIds).toStrictEqual(['id'])
    expect(resourcesState.current.currentIds).toStrictEqual(['id'])
  })
  test('We can set the status on an existing resource', () => {
    resourcesActions.setResourceFetchStatus({ iri: 'id', status: 1 })
    expect(resourcesState.current.byId.id.apiState.status).toBe(1)
  })
  test('We clear existing fetch errors when setting a new status', () => {
    resourcesState.current.byId.id.apiState = {
      status: -1,
      fetchError: {
        statusCode: 101,
        path: 'any'
      }
    }
    resourcesActions.setResourceFetchStatus({ iri: 'id', status: 1 })
    expect(resourcesState.current.byId.id.apiState.status).toBe(1)
    expect(resourcesState.current.byId.id.apiState.fetchError).toBeUndefined()
  })
})

describe('resources action setResourceFetchError', () => {
  const resourcesState = state()
  const resourcesActions = actions(resourcesState)
  test('We can set an error on a new resource', () => {
    resourcesActions.setResourceFetchError({ iri: 'id' })
    expect(resourcesState.current.byId.id.apiState.status).toBe(-1)
    expect(resourcesState.current.byId.id.apiState.fetchError).toBeUndefined()
    expect(resourcesState.current.allIds).toStrictEqual(['id'])
    expect(resourcesState.current.currentIds).toStrictEqual(['id'])
  })
  test('We can set an error on a new resource with a fetch error', () => {
    const fetchError: FetchError = { name: 'FetchError', message: 'my error', statusCode: 404, request: 'request-url' }
    resourcesActions.setResourceFetchError({ iri: 'id', fetchError })
    expect(resourcesState.current.byId.id.apiState.status).toBe(-1)
    expect(resourcesState.current.byId.id.apiState.fetchError).toStrictEqual({
      statusCode: 404,
      path: 'request-url'
    })
  })
  test('We can set the status on an existing resource', () => {
    const fetchError: FetchError = { name: 'FetchError', message: 'my error' }
    resourcesActions.setResourceFetchError({ iri: 'id', fetchError })
    expect(resourcesState.current.byId.id.apiState.status).toBe(-1)
    expect(resourcesState.current.byId.id.apiState.fetchError).toStrictEqual({
      statusCode: undefined,
      path: undefined
    })
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
