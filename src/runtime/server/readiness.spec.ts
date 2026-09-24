// @vitest-environment node

import { describe, expect, test } from 'vitest'
import { READINESS_DEFAULTS, classifyReadiness, resolveReadinessSettings } from './readiness'

const url = 'https://api.example.com/_api/_/health'

describe('classifyReadiness', () => {
  test.each([200, 204])('the API answering %i is ready with nothing to report', (status) => {
    expect(classifyReadiness(url, { status })).toEqual({ ready: true })
  })

  test.each([401, 403])('a %i is ready because the API answered', (status) => {
    const verdict = classifyReadiness(url, { status })

    expect(verdict.ready).toBe(true)
    expect(verdict.reason).toContain(url)
  })

  test('a 404 is ready but reported, because the API may predate the health endpoint', () => {
    const verdict = classifyReadiness(url, { status: 404 })

    expect(verdict.ready).toBe(true)
    expect(verdict.reason).toContain(url)
  })

  test('a redirect is not ready and says where it was sent', () => {
    expect(classifyReadiness(url, { status: 308, location: 'https://elsewhere.example.com/' })).toEqual({
      ready: false,
      reason: `${url} responded 308, redirecting to https://elsewhere.example.com/`,
    })
  })

  test('a redirect without a location is still not ready', () => {
    const verdict = classifyReadiness(url, { status: 302 })

    expect(verdict.ready).toBe(false)
    expect(verdict.reason).toContain('302')
  })

  test.each([500, 502, 503, 504])('a %i is not ready and reports the status', (status) => {
    const verdict = classifyReadiness(url, { status })

    expect(verdict.ready).toBe(false)
    expect(verdict.reason).toContain(String(status))
    expect(verdict.reason).toContain(url)
  })

  test('a connection failure is not ready and reports the error code', () => {
    expect(classifyReadiness(url, { error: { code: 'ECONNREFUSED' } })).toEqual({
      ready: false,
      reason: `${url} could not be reached (ECONNREFUSED)`,
    })
  })

  test('a connection failure with no code is still reported', () => {
    const verdict = classifyReadiness(url, { error: {} })

    expect(verdict.ready).toBe(false)
    expect(verdict.reason).toContain(url)
  })

  test('a timeout is not ready and is distinguished from a connection failure', () => {
    const verdict = classifyReadiness(url, { error: { timeout: true, code: 'ABORT_ERR' } })

    expect(verdict.ready).toBe(false)
    expect(verdict.reason).toContain('did not respond within')
    expect(verdict.reason).not.toContain('ABORT_ERR')
  })
})

describe('resolveReadinessSettings', () => {
  test('falls back to the built in defaults', () => {
    expect(resolveReadinessSettings({})).toEqual(READINESS_DEFAULTS)
  })

  test('takes a configured path and timeout', () => {
    expect(resolveReadinessSettings({ readiness: { path: '/up', timeout: 750 } })).toEqual({ path: '/up', timeout: 750 })
  })

  test.each([['0', 0], ['not a number', Number.NaN], ['negative', -1]])('ignores a %s timeout', (_name, timeout) => {
    expect(resolveReadinessSettings({ readiness: { timeout } }).timeout).toBe(READINESS_DEFAULTS.timeout)
  })

  test('reads a timeout supplied as a string by an environment variable', () => {
    expect(resolveReadinessSettings({ readiness: { timeout: '900' } }).timeout).toBe(900)
  })

  test('ignores an empty path', () => {
    expect(resolveReadinessSettings({ readiness: { path: '' } }).path).toBe(READINESS_DEFAULTS.path)
  })
})
