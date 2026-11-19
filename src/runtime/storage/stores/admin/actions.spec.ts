import { describe, expect, test } from 'vitest'
import { reactive } from 'vue'
import actions from './actions'

describe('Admin Store Actions', () => {
  test.each([
    { initial: undefined, arg: true, result: true },
    { initial: undefined, arg: false, result: false },
    { initial: true, arg: undefined, result: false },
    { initial: false, arg: undefined, result: true },
  ])('toggleEdit should change isEditing to $result if initially $initial and passed the argument $arg', ({ initial, arg, result }) => {
    const state = {
      state: reactive({
        isEditing: initial,
      }),
    }
    const fns = actions(state)
    fns.toggleEdit(arg)
    expect(state.state.isEditing).toBe(result)
  })
})
