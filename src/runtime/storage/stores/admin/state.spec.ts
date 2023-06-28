import { describe, expect, test } from 'vitest'
import { ref } from 'vue'
import state from './state'

describe('Manager State context', () => {
  test('Initial state is correct', () => {
    const initialState = state()
    expect(initialState).toStrictEqual({
      isEditing: ref(false),
      navigationGuardDisabled: ref(false),
      editResourceStack: ref(null)
    })
  })
})
