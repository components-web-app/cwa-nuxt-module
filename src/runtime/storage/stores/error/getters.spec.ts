import { describe, expect, test } from 'vitest'
import state from './state'
import getters from './getters'

describe('Errors -> error', () => {
  const errorsState = state()
  const errorsGetters = getters(errorsState)

  test('no errors', () => {
    expect(errorsGetters.hasErrors.value).toBe(false)
  })

  test('has errors', () => {
    errorsState.allIds = ['0']
    expect(errorsGetters.hasErrors.value).toBe(true)
  })

  test('get errors', () => {
    errorsState.allIds = ['0']
    errorsState.byId = { 0: { hello: 'world' } }

    expect(errorsGetters.getErrors.value).toHaveLength(1)
  })
})
