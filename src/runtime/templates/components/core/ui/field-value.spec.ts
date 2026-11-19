import { describe, expect, test } from 'vitest'
import { shownValue } from './field-value'

describe('shownValue (#461)', () => {
  test.each([
    [null, 'Empty'],
    [undefined, 'Empty'],
    ['', 'Empty'],
    ['Hello', 'Hello'],
    [{ a: 1 }, '{"a":1}'],
  ])('without a format, %j reads %s', (value, expected) => {
    expect(shownValue(value)).toBe(expected)
  })

  test('a field\'s own format names a set value, and an empty one is still Empty', () => {
    const format = (value: unknown) => `formatted ${String(value)}`
    expect(shownValue('2026-11-20T09:00:00.000Z', format)).toBe('formatted 2026-11-20T09:00:00.000Z')
    expect(shownValue(null, format)).toBe('Empty')
  })

  test('falls back to the raw value when the format gives nothing', () => {
    expect(shownValue('not a date', () => '')).toBe('not a date')
  })
})
