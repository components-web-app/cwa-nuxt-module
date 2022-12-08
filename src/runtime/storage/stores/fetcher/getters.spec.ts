import { describe, test, expect } from 'vitest'
import { reactive } from 'vue'
import getters from './getters'
import { CwaFetcherStateInterface } from './state'

function createState (): CwaFetcherStateInterface {
  return {
    status: reactive({
      fetch: {
        paths: {}
      },
      fetched: {}
    })
  }
}

describe('Fetcher::inProgress', () => {
  const state = createState()
  const getterFns = getters(state)

  test('returns false if path not set', () => {
    expect(getterFns.inProgress.value).toBe(false)
  })

  test('returns true if the path is set', () => {
    state.status.fetch.path = 'some-path'
    expect(getterFns.inProgress.value).toBe(true)
  })
})
