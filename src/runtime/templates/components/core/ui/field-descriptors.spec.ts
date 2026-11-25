import { afterEach, describe, expect, test, vi } from 'vitest'
import { consola } from 'consola'
import { controlFor } from './field-descriptors'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('controlFor (#494)', () => {
  test.each([
    ['bool', 'toggle'],
    ['int', 'number'],
    ['text', 'textarea'],
    ['string', 'input'],
  ])('maps %s to the %s control', (type, control) => {
    expect(controlFor({ name: 'field', label: 'Field', type })).toBe(control)
  })

  test('a secret is a secret field whatever its type', () => {
    expect(controlFor({ name: 'key', label: 'Key', type: 'string', secret: true })).toBe('secret')
    expect(controlFor({ name: 'key', label: 'Key', type: 'text', secret: true })).toBe('secret')
  })

  test('an unknown type falls back to Input and warns once per type in development', () => {
    const warn = vi.spyOn(consola, 'warn').mockImplementation(() => {})
    vi.stubEnv('DEV', true)

    expect(controlFor({ name: 'a', label: 'A', type: 'colour' })).toBe('input')
    expect(controlFor({ name: 'b', label: 'B', type: 'colour' })).toBe('input')
    expect(controlFor({ name: 'c', label: 'C', type: 'date' })).toBe('input')

    expect(warn).toHaveBeenCalledTimes(2)
    expect(warn.mock.calls[0]![0]).toContain('"colour"')
    expect(warn.mock.calls[1]![0]).toContain('"date"')
  })

  test('an unknown type warns nothing in production', () => {
    const warn = vi.spyOn(consola, 'warn').mockImplementation(() => {})
    vi.stubEnv('DEV', false)

    expect(controlFor({ name: 'a', label: 'A', type: 'never-seen' })).toBe('input')

    expect(warn).not.toHaveBeenCalled()
  })
})
