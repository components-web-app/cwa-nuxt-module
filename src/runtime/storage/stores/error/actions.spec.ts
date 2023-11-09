import { describe, expect, test } from 'vitest'
import { createFetchError } from 'ofetch'
import state, { ErrorType } from './state'
import actions from './actions'

describe('Errors -> error', () => {
  const errorsState = state()
  const errorsActions = actions(errorsState)

  test('no errors', () => {
    expect(errorsState.lastErrorId).toBeNull()
  })

  test('add error in the state', () => {
    errorsActions.error({ endpoint: '/bar', data: {} }, createFetchError({
      options: { method: 'GET' },
      response: { status: 409, statusText: 'Teapot', _data: { '@type': 'hydra:Error', 'hydra:description': 'Hello darkness my old friend' } }
    }))

    expect(errorsState.lastErrorId).not.toBeNull()
    const err = errorsState.byId[errorsState.lastErrorId]
    expect(err.detail).toEqual('Hello darkness my old friend')
    expect(err.statusCode).toEqual(409)
    expect(err.type).toEqual(ErrorType.SERVER)
  })

  test('add javascript error in the state', () => {
    errorsActions.error({ endpoint: '/bar', data: {} }, createFetchError({
      error: new TypeError('Network issue'),
      options: {},
      response: {}
    }))

    const err = errorsState.byId[errorsState.lastErrorId]
    expect(err.type).toEqual(ErrorType.NETWORK)
    expect(err.detail).toEqual('Network issue')
  })

  test('non-json error', () => {
    errorsActions.error({ endpoint: '/bar', data: {} }, createFetchError({
      options: {},
      response: { _data: '<html>', statusCode: 502 }
    }))

    const err = errorsState.byId[errorsState.lastErrorId]
    expect(err.type).toEqual(ErrorType.SERVER)
    expect(err.detail).toEqual('<html>')
  })
})
