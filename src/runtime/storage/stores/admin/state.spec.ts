import { describe, expect, test } from 'vitest'
import { reactive } from 'vue'
import state from './state'

describe('Manager State context', () => {
  test('Initial state is correct', () => {
    const initialState = state()
    expect(initialState).toStrictEqual({
      state: reactive({
        isEditing: false,
        navigationGuardDisabled: false
      })
    })
  })
})
