import { describe, test, expect } from 'vitest'
import { reactive } from 'vue'
import getters from './getters'
import { CwaFetcherStateInterface } from './state'

function createState (): CwaFetcherStateInterface {
  return {
    status: reactive({})
  }
}

describe('Fetcher::inProgress', () => {
  const state = createState()
  const getterFns = getters(state)

  test('returns false if fetch not set', () => {
    expect(getterFns.inProgress.value).toBe(false)
  })

  test('returns true if there is a fetch path but no result', () => {
    state.status.fetch = { path: 'my-path', token: 'my-token' }
    expect(getterFns.inProgress.value).toBe(true)
  })

  test('returns false is we have a success result as true', () => {
    state.status.fetch = { path: 'my-path', token: 'my-token', success: true }
    expect(getterFns.inProgress.value).toBe(false)
  })

  test('returns false is we have a success result as false', () => {
    state.status.fetch = { path: 'my-path', token: 'my-token', success: false }
    expect(getterFns.inProgress.value).toBe(false)
  })
})
