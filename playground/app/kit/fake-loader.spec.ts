import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { KIT_LOAD_NORMAL, KIT_LOAD_ONCE, KIT_LOAD_SLOW, createFakeLoader } from './fake-loader'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

function settledAfter(promise: Promise<void>) {
  let done = false
  promise.then(() => {
    done = true
  })
  return () => done
}

describe('the /kit loading simulation', () => {
  test('slow makes every load take four seconds', async () => {
    const loader = createFakeLoader()
    loader.setMode('slow')
    const done = settledAfter(loader.wait())
    await vi.advanceTimersByTimeAsync(KIT_LOAD_SLOW - 1)
    expect(done()).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(done()).toBe(true)
  })

  test('load once makes only the next load take seven seconds, and choosing it again re-arms it', async () => {
    const loader = createFakeLoader()
    loader.setMode('once')
    const first = settledAfter(loader.wait())
    await vi.advanceTimersByTimeAsync(KIT_LOAD_ONCE - 1)
    expect(first()).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(first()).toBe(true)
    const second = settledAfter(loader.wait())
    await vi.advanceTimersByTimeAsync(KIT_LOAD_NORMAL)
    expect(second()).toBe(true)
    loader.setMode('once')
    const third = settledAfter(loader.wait())
    await vi.advanceTimersByTimeAsync(KIT_LOAD_NORMAL)
    expect(third()).toBe(false)
  })

  test('held keeps every load waiting until released, and leaving held releases them', async () => {
    const loader = createFakeLoader()
    loader.setMode('held')
    const first = settledAfter(loader.wait())
    const second = settledAfter(loader.wait())
    await vi.advanceTimersByTimeAsync(60_000)
    expect([first(), second()]).toEqual([false, false])
    expect(loader.state.holding).toBe(2)
    loader.release()
    await vi.advanceTimersByTimeAsync(0)
    expect([first(), second()]).toEqual([true, true])
    const third = settledAfter(loader.wait())
    loader.setMode('normal')
    await vi.advanceTimersByTimeAsync(0)
    expect(third()).toBe(true)
    expect(loader.state.loads).toBe(3)
  })
})
