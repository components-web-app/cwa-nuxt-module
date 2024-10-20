import { afterEach, describe, expect, test } from 'vitest'
import { createFetchError } from 'ofetch'
import state, { ErrorType } from './state'
import actions from './actions'

describe('Errors -> error', () => {
  const errorsState = state()
  const errorsActions = actions(errorsState)

  afterEach(() => {
    errorsActions.clear()
  })

  test('no errors', () => {
    expect(errorsState.allIds).toHaveLength(0)
  })

  test('add error in the state', () => {
    errorsActions.error({ endpoint: '/bar', data: {} }, createFetchError({
      options: { method: 'GET' },
      response: { status: 409, statusText: 'Teapot', _data: { '@type': 'hydra:Error', 'hydra:description': 'Hello darkness my old friend' } },
    }))

    const err = errorsState.byId[errorsState.allIds[0]]
    expect(err.detail).toEqual('Hello darkness my old friend')
    expect(err.statusCode).toEqual(409)
    expect(err.type).toEqual(ErrorType.SERVER)
  })

  test('remove error by endpoint', () => {
    errorsActions.error({ endpoint: '/bar', data: {} }, createFetchError({
      options: { method: 'GET' },
      response: { status: 409, statusText: 'Teapot', _data: { '@type': 'hydra:Error', 'hydra:description': 'Hello darkness my old friend' } },
    }))
    expect(errorsState.allEndpoints.has('/bar')).toBeTruthy()
    errorsActions.removeByEndpoint('/bar')
    expect(errorsState.allIds).toHaveLength(0)
    expect(errorsState.allEndpoints.has('/bar')).toBeFalsy()
  })

  test('remove error by id', () => {
    errorsActions.error({ endpoint: '/bar', data: {} }, createFetchError({
      options: { method: 'GET' },
      response: { status: 409, statusText: 'Teapot', _data: { '@type': 'hydra:Error', 'hydra:description': 'Hello darkness my old friend' } },
    }))
    const id = errorsState.allIds[0]
    errorsActions.removeById(id)
    expect(errorsState.byId[id]).toBeUndefined()
    expect(errorsState.allIds).toHaveLength(0)
    expect(errorsState.allEndpoints.has('/bar')).toBeFalsy()
  })

  test('add javascript error in the state', () => {
    errorsActions.error({ endpoint: '/bar', data: {} }, createFetchError({
      error: new TypeError('Network issue'),
      options: {},
      response: {},
    }))

    const err = errorsState.byId[errorsState.allIds[0]]
    expect(err.type).toEqual(ErrorType.NETWORK)
    expect(err.detail).toEqual('Network issue')
  })

  test('non-json error', () => {
    errorsActions.error({ endpoint: '/bar', data: {} }, createFetchError({
      options: {},
      response: { _data: '<html>', statusCode: 502 },
    }))

    const err = errorsState.byId[errorsState.allIds[0]]
    expect(err.type).toEqual(ErrorType.SERVER)
    expect(err.detail).toEqual('<html>')
  })
})
