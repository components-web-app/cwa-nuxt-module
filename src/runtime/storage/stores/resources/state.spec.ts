import { describe, expect, test } from 'vitest'
import { reactive, ref } from 'vue'
import state from './state'

describe('Resources State context', () => {
  test('Initial state is correct', () => {
    const initialState = state()
    expect(initialState).toStrictEqual({
      current: reactive({
        byId: {},
        allIds: [],
        currentIds: [],
        positionsByComponent: {},
        publishableMapping: [],
      }),
      new: reactive({
        byId: {},
        allIds: [],
      }),
      adding: ref(undefined),
    })
  })
})
