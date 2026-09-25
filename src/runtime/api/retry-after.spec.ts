import { afterEach, describe, expect, test, vi } from 'vitest'
import { createFetchError } from 'ofetch'
import { formatCountdown, formatWait, retryAfterSeconds } from './retry-after'

function throttled(headers: Record<string, string>) {
  return createFetchError({
    options: {},
    response: Object.assign(new Response(null, { status: 429, headers }), { _data: {} }),
  } as any)
}

describe('retryAfterSeconds', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  test('reads a number of seconds', () => {
    expect(retryAfterSeconds(throttled({ 'Retry-After': '240' }))).toBe(240)
  })

  test('measures an HTTP date against the response own Date header, not the browser clock', () => {
    vi.useFakeTimers({ now: new Date('2026-09-25T13:00:00Z') })

    expect(retryAfterSeconds(throttled({
      'Date': 'Fri, 25 Sep 2026 12:00:00 GMT',
      'Retry-After': 'Fri, 25 Sep 2026 12:04:00 GMT',
    }))).toBe(240)
  })

  test('gives nothing when there is no usable header', () => {
    expect(retryAfterSeconds(throttled({}))).toBeUndefined()
    expect(retryAfterSeconds(throttled({ 'Retry-After': 'soon' }))).toBeUndefined()
    expect(retryAfterSeconds(throttled({ 'Retry-After': '-5' }))).toBeUndefined()
  })

  test('an HTTP date with no Date header to measure it against gives nothing, rather than trusting the browser clock', () => {
    expect(retryAfterSeconds(throttled({ 'Retry-After': 'Fri, 25 Sep 2026 12:04:00 GMT' }))).toBeUndefined()
  })
})

describe('formatWait', () => {
  test.each([
    [30, 'less than a minute'],
    [60, '1 minute'],
    [61, '2 minutes'],
    [240, '4 minutes'],
    [7200, '2 hours'],
  ])('%i seconds reads as %s', (seconds, text) => {
    expect(formatWait(seconds)).toBe(text)
  })
})

describe('formatCountdown', () => {
  test.each([
    [240, '4:00'],
    [239, '3:59'],
    [5, '0:05'],
    [3725, '1:02:05'],
  ])('%i seconds counts down as %s', (seconds, text) => {
    expect(formatCountdown(seconds)).toBe(text)
  })
})
