import { afterEach, describe, test, expect, vi } from 'vitest'
import dayjs from 'dayjs'
import { dateTimeZoneLabel, formatDateTime, fromDateTimeInput, toDateTimeInput } from './date-time-input'

describe('datetime-local conversion', () => {
  test('a wall clock time an editor types is committed as that instant in their own timezone', () => {
    expect(fromDateTimeInput('2026-09-25T09:00')).toBe(new Date('2026-09-25T09:00').toISOString())
  })

  test('a stored instant is shown back as the same wall clock time the editor typed', () => {
    const committed = fromDateTimeInput('2026-09-25T09:00')
    expect(toDateTimeInput(committed)).toBe('2026-09-25T09:00')
  })

  test('clearing the input commits no date rather than an empty string', () => {
    expect(fromDateTimeInput('')).toBeNull()
    expect(fromDateTimeInput(undefined)).toBeNull()
    expect(fromDateTimeInput(null)).toBeNull()
  })

  test('an unparseable input commits no date', () => {
    expect(fromDateTimeInput('not a date')).toBeNull()
  })

  test('no date shows an empty datetime input', () => {
    expect(toDateTimeInput(null)).toBe('')
    expect(toDateTimeInput(undefined)).toBe('')
  })

  test('the committed instant is offset-bearing so the API never has to guess a timezone', () => {
    expect(fromDateTimeInput('2026-09-25T09:00')).toMatch(/Z$/)
  })
})

describe('display', () => {
  test('shows a date in the editor own timezone, not UTC', () => {
    const committed = fromDateTimeInput('2026-09-25T09:00') as string
    expect(formatDateTime(committed)).toBe(dayjs(committed).format('D MMM YYYY, HH:mm'))
  })

  test('shows nothing when there is no date', () => {
    expect(formatDateTime(null)).toBe('')
    expect(formatDateTime(undefined)).toBe('')
  })
})

describe('timezone label', () => {
  test('names the zone and offset the control is committing to', () => {
    const label = dateTimeZoneLabel()
    expect(label).toContain(Intl.DateTimeFormat().resolvedOptions().timeZone)
    expect(label).toMatch(/UTC[+-]\d{2}:\d{2}/)
  })
})

describe('the editor computer timezone, not the server or UTC', () => {
  const originalTz = process.env.TZ

  afterEach(() => {
    process.env.TZ = originalTz
    vi.useRealTimers()
  })

  test.each([
    ['Europe/London', '2026-09-25T09:00', '2026-09-25T08:00:00.000Z'],
    ['Europe/London', '2026-12-25T09:00', '2026-12-25T09:00:00.000Z'],
    ['America/New_York', '2026-09-25T09:00', '2026-09-25T13:00:00.000Z'],
    ['Asia/Kolkata', '2026-09-25T09:00', '2026-09-25T03:30:00.000Z'],
  ])('in %s, %s typed is saved as %s', (timeZone, typed, saved) => {
    process.env.TZ = timeZone
    expect(fromDateTimeInput(typed)).toBe(saved)
  })

  test.each([
    ['Europe/London', '2026-09-25T08:00:00.000Z', '2026-09-25T09:00'],
    ['America/New_York', '2026-09-25T13:00:00+00:00', '2026-09-25T09:00'],
  ])('in %s, the stored %s is shown as %s', (timeZone, stored, shown) => {
    process.env.TZ = timeZone
    expect(toDateTimeInput(stored)).toBe(shown)
  })

  test('names the zone the editor is actually in', () => {
    vi.useFakeTimers({ now: new Date('2026-12-01T12:00:00Z') })
    process.env.TZ = 'America/New_York'
    expect(dateTimeZoneLabel()).toBe('America/New_York, UTC-05:00')
  })
})
