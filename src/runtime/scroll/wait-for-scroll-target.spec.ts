import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { SCROLL_TARGET_TIMEOUT, waitForScrollTarget } from './wait-for-scroll-target'
import type { WaitForScrollTargetOps } from './wait-for-scroll-target'

function createHarness(overrides: Partial<WaitForScrollTargetOps> = {}) {
  const state = {
    loading: true,
    height: 0,
    elements: [] as string[],
  }
  let tick: (() => void) | undefined
  const unsubscribe = vi.fn()

  const ops: WaitForScrollTargetOps = {
    target: { height: 1000 },
    isLoading: () => state.loading,
    readHeight: () => state.height,
    onHeightChange: (cb) => {
      tick = cb
      return unsubscribe
    },
    findElement: selector => state.elements.includes(selector),
    timeout: SCROLL_TARGET_TIMEOUT,
    ...overrides,
  }

  return {
    state,
    unsubscribe,
    ops,
    ticks(count = 1) {
      for (let i = 0; i < count; i++) {
        tick?.()
      }
    },
  }
}

describe('waitForScrollTarget', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('the timeout is one second', () => {
    expect(SCROLL_TARGET_TIMEOUT).toBe(1000)
  })

  test('a target already met resolves without deferring and never subscribes', async () => {
    const harness = createHarness()
    harness.state.height = 1200

    const result = waitForScrollTarget(harness.ops)
    await vi.advanceTimersByTimeAsync(0)

    await expect(result).resolves.toBe(false)
    expect(harness.unsubscribe).not.toHaveBeenCalled()
  })

  test('an unmet target does not resolve while the content is still loading', async () => {
    const harness = createHarness()
    let resolved = false
    waitForScrollTarget(harness.ops).then(() => {
      resolved = true
    })

    harness.state.height = 400
    harness.ticks(5)
    await vi.advanceTimersByTimeAsync(500)

    expect(resolved).toBe(false)
  })

  test('it resolves as deferred once the height reaches the target', async () => {
    const harness = createHarness()
    const result = waitForScrollTarget(harness.ops)

    harness.state.height = 1000
    harness.ticks()
    await vi.advanceTimersByTimeAsync(0)

    await expect(result).resolves.toBe(true)
    expect(harness.unsubscribe).toHaveBeenCalled()
  })

  test('a target that is never met resolves on the timeout', async () => {
    const harness = createHarness()
    const result = waitForScrollTarget(harness.ops)

    harness.ticks(3)
    await vi.advanceTimersByTimeAsync(SCROLL_TARGET_TIMEOUT)

    await expect(result).resolves.toBe(true)
    expect(harness.unsubscribe).toHaveBeenCalled()
  })

  test('a height that has never changed does not resolve once loading ends, because components render after it', async () => {
    const harness = createHarness()
    let resolved = false
    waitForScrollTarget(harness.ops).then(() => {
      resolved = true
    })

    harness.state.loading = false
    harness.ticks(10)
    await vi.advanceTimersByTimeAsync(900)

    expect(resolved).toBe(false)
  })

  test('a height that grew but fell short resolves once it is stable and loading has ended', async () => {
    const harness = createHarness()
    const result = waitForScrollTarget(harness.ops)

    harness.state.height = 300
    harness.ticks()
    harness.state.loading = false
    harness.ticks(3)
    await vi.advanceTimersByTimeAsync(0)

    await expect(result).resolves.toBe(true)
  })

  test('a height that grew but fell short keeps waiting while loading continues', async () => {
    const harness = createHarness()
    let resolved = false
    waitForScrollTarget(harness.ops).then(() => {
      resolved = true
    })

    harness.state.height = 300
    harness.ticks(10)
    await vi.advanceTimersByTimeAsync(900)

    expect(resolved).toBe(false)
  })

  test('an element target resolves when the element appears', async () => {
    const harness = createHarness({ target: { selector: '#contact' } })
    const result = waitForScrollTarget(harness.ops)

    harness.ticks(3)
    harness.state.elements.push('#contact')
    harness.ticks()
    await vi.advanceTimersByTimeAsync(0)

    await expect(result).resolves.toBe(true)
  })

  test('an element target resolves on the timeout when the element never appears', async () => {
    const harness = createHarness({ target: { selector: '#missing' } })
    const result = waitForScrollTarget(harness.ops)

    await vi.advanceTimersByTimeAsync(SCROLL_TARGET_TIMEOUT)

    await expect(result).resolves.toBe(true)
  })

  test('an element target present from the start resolves without deferring', async () => {
    const harness = createHarness({ target: { selector: '#contact' } })
    harness.state.elements.push('#contact')

    await expect(waitForScrollTarget(harness.ops)).resolves.toBe(false)
  })

  test('the timeout cannot resolve a wait that already ended', async () => {
    const harness = createHarness()
    const resolutions: boolean[] = []
    waitForScrollTarget(harness.ops).then(value => resolutions.push(value))

    harness.state.height = 1000
    harness.ticks()
    await vi.advanceTimersByTimeAsync(SCROLL_TARGET_TIMEOUT * 2)
    harness.ticks(5)
    await vi.advanceTimersByTimeAsync(0)

    expect(resolutions).toEqual([true])
    expect(harness.unsubscribe).toHaveBeenCalledTimes(1)
  })
})
