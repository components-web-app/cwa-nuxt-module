import { afterEach, describe, expect, test, vi } from 'vitest'
import { effectScope, nextTick, reactive } from 'vue'
import { useFreshFlags } from './presence-flags'

function setup(initial: Record<string, string>) {
  const state = reactive({ signatures: initial })
  const scope = effectScope()
  const fresh = scope.run(() => useFreshFlags(() => ({ ...state.signatures })))!
  return { state, scope, fresh }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('useFreshFlags (#429)', () => {
  test('a flag shows as soon as it appears and fades 3 seconds later', () => {
    vi.useFakeTimers()
    const { fresh, scope } = setup({ a: 'selected' })

    expect(fresh.has('a')).toBe(true)
    vi.advanceTimersByTime(2999)
    expect(fresh.has('a')).toBe(true)
    vi.advanceTimersByTime(1)
    expect(fresh.has('a')).toBe(false)
    scope.stop()
  })

  test('a change to its signature shows it again for another 3 seconds', async () => {
    vi.useFakeTimers()
    const { fresh, state, scope } = setup({ a: 'selected' })
    vi.advanceTimersByTime(2000)

    state.signatures = { a: 'editing' }
    await nextTick()
    vi.advanceTimersByTime(2000)
    expect(fresh.has('a')).toBe(true)
    vi.advanceTimersByTime(1000)
    expect(fresh.has('a')).toBe(false)
    scope.stop()
  })

  test('the same signature arriving again, as a heartbeat does, keeps the flag faded', async () => {
    vi.useFakeTimers()
    const { fresh, state, scope } = setup({ a: 'selected', b: 'selected' })
    vi.advanceTimersByTime(3000)

    state.signatures = { a: 'selected', b: 'editing' }
    await nextTick()

    expect(fresh.has('a')).toBe(false)
    expect(fresh.has('b')).toBe(true)
    scope.stop()
  })

  test('a key that leaves and comes back shows again', async () => {
    vi.useFakeTimers()
    const { fresh, state, scope } = setup({ a: 'selected' })
    vi.advanceTimersByTime(3000)

    state.signatures = {}
    await nextTick()
    state.signatures = { a: 'selected' }
    await nextTick()

    expect(fresh.has('a')).toBe(true)
    scope.stop()
  })

  test('stopping the scope cancels the timers', () => {
    vi.useFakeTimers()
    const { scope } = setup({ a: 'selected' })

    scope.stop()

    expect(vi.getTimerCount()).toBe(0)
  })
})
