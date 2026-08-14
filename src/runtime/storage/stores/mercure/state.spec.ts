import { describe, expect, test } from 'vitest'
import { ref } from 'vue'
import state from './state'

describe('Mercure State context', () => {
  test('Initial state is correct', () => {
    const initialState = state()
    expect(initialState).toStrictEqual({
      hub: ref(null),
      // undefined, not false: it distinguishes "never connected" (an initial connect, nothing has
      // been missed) from "was connected and dropped" (reconnect, revalidate). See #286.
      connected: ref(undefined),
    })
  })
})
