import { describe, expect, test } from 'vitest'
import { reactive } from 'vue'
import actions from './actions'

describe('Admin Store Actions', () => {
  test.each([
    { initial: undefined, arg: true, result: true, disabledResult: true },
    { initial: undefined, arg: false, result: false, disabledResult: false },
    { initial: true, arg: undefined, result: false, disabledResult: false },
    { initial: false, arg: undefined, result: true, disabledResult: true },
  ])('toggleEdit should change isEditing to $result and navigationGuardDisabled to $disabledResult if initially $initial and passed the argument $arg', ({ initial, arg, result, disabledResult }) => {
    const state = {
      state: reactive({
        isEditing: initial,
        navigationGuardDisabled: true,
      }),
    }
    const fns = actions(state)
    fns.toggleEdit(arg)
    expect(state.state.isEditing).toBe(result)
    expect(state.state.navigationGuardDisabled).toBe(disabledResult)
  })
})
