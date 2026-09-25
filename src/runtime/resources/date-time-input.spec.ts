import { afterEach, describe, test, expect, vi } from 'vitest'
import dayjs from 'dayjs'
import { CalendarDateTime, resetLocalTimeZone } from '@internationalized/date'
import { dateTimeZoneLabel, earliestSelectable, formatDateTime, fromLocalDateTime, toLocalDateTime } from './date-time-input'

describe('display', () => {
  test('shows a date in the editor own timezone, not UTC', () => {
    const committed = '2026-09-25T08:00:00.000Z'
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
    resetLocalTimeZone()
    vi.useRealTimers()
  })

  test.each([
    ['Europe/London', [2026, 9, 25, 9, 0], '2026-09-25T08:00:00.000Z'],
    ['Europe/London', [2026, 12, 25, 9, 0], '2026-12-25T09:00:00.000Z'],
    ['America/New_York', [2026, 9, 25, 9, 0], '2026-09-25T13:00:00.000Z'],
    ['Asia/Kolkata', [2026, 9, 25, 9, 0], '2026-09-25T03:30:00.000Z'],
  ] as const)('in %s, %j chosen is saved as %s', (timeZone, [year, month, day, hour, minute], saved) => {
    process.env.TZ = timeZone
    resetLocalTimeZone()
    expect(fromLocalDateTime(new CalendarDateTime(year, month, day, hour, minute))).toBe(saved)
  })

  test.each([
    ['Europe/London', '2026-09-25T08:00:00.000Z', [25, 9, 0]],
    ['America/New_York', '2026-09-25T13:00:00+00:00', [25, 9, 0]],
  ] as const)('in %s, the stored %s is shown as day, hour, minute %j', (timeZone, stored, shown) => {
    process.env.TZ = timeZone
    resetLocalTimeZone()
    const local = toLocalDateTime(stored)!
    expect([local.day, local.hour, local.minute]).toEqual(shown)
  })

  test('gives the offset at the date being chosen, not today, across a clock change', () => {
    vi.useFakeTimers({ now: new Date('2026-09-25T12:00:00Z') })
    process.env.TZ = 'Europe/London'
    expect(dateTimeZoneLabel('2026-12-01T09:00:00.000Z')).toBe('Europe/London, UTC+00:00')
    expect(dateTimeZoneLabel('2026-10-01T08:00:00.000Z')).toBe('Europe/London, UTC+01:00')
  })

  test('names the zone the editor is actually in', () => {
    vi.useFakeTimers({ now: new Date('2026-12-01T12:00:00Z') })
    process.env.TZ = 'America/New_York'
    expect(dateTimeZoneLabel()).toBe('America/New_York, UTC-05:00')
  })
})

describe('the earliest time the date picker can offer (#320)', () => {
  test('rounds up to the next step so the earliest offered time is never in the past', () => {
    expect(earliestSelectable('2026-09-25T12:02:30.000Z', 5)).toBe('2026-09-25T12:05:00.000Z')
  })

  test('keeps a time already on a step', () => {
    expect(earliestSelectable('2026-09-25T12:05:00.000Z', 5)).toBe('2026-09-25T12:05:00.000Z')
  })
})

describe('the date picker value in the editor zone (#320)', () => {
  const originalTz = process.env.TZ

  function inZone(timeZone: string) {
    process.env.TZ = timeZone
    resetLocalTimeZone()
  }

  afterEach(() => {
    process.env.TZ = originalTz
    resetLocalTimeZone()
  })

  test('a stored UTC instant becomes that moment on the editor own clock', () => {
    inZone('Europe/London')
    const local = toLocalDateTime('2026-10-01T08:00:00.000Z')!

    expect(local.timeZone).toBe('Europe/London')
    expect([local.year, local.month, local.day, local.hour, local.minute]).toEqual([2026, 10, 1, 9, 0])
  })

  test('the editor own clock time is saved back as the same UTC instant', () => {
    inZone('America/New_York')

    expect(fromLocalDateTime(toLocalDateTime('2026-10-01T08:00:00.000Z'))).toBe('2026-10-01T08:00:00.000Z')
  })

  test('a date and time chosen without a zone is read on the editor own clock', () => {
    inZone('Europe/London')

    expect(fromLocalDateTime(new CalendarDateTime(2026, 10, 1, 9, 0))).toBe('2026-10-01T08:00:00.000Z')
    expect(fromLocalDateTime(new CalendarDateTime(2026, 10, 26, 9, 0))).toBe('2026-10-26T09:00:00.000Z')
  })

  test('no value stays no value', () => {
    expect(toLocalDateTime(null)).toBeUndefined()
    expect(toLocalDateTime(undefined)).toBeUndefined()
    expect(fromLocalDateTime(null)).toBeNull()
    expect(fromLocalDateTime(undefined)).toBeNull()
  })
})
