import { describe, expect, test } from 'vitest'
import { ref } from 'vue'
import state from './state'

describe('ApiDocumentation State context', () => {
  test('Initial state is correct', () => {
    const initialState = state()
    expect(initialState).toStrictEqual({
      docsPath: ref(null),
    })
  })
})
