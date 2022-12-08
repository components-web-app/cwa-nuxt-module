import { describe, expect, test } from 'vitest'
import { ref } from 'vue'
import state from './state'

describe('Mercure State context', () => {
  test('Initial state is correct', () => {
    const initialState = state()
    expect(initialState).toStrictEqual({
      hub: ref(null)
    })
  })
})
