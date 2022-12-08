import { describe, expect, test } from 'vitest'
import { reactive } from 'vue'
import state from './state'

describe('Fetcher State context', () => {
  test('Initial state is correct', () => {
    const initialState = state()
    expect(initialState).toStrictEqual({
      status: reactive({
        fetch: {},
        fetched: {}
      })
    })
  })
})
