import dayjs from 'dayjs'
import { fromDate, getLocalTimeZone } from '@internationalized/date'
import type { DateValue, ZonedDateTime } from '@internationalized/date'

const DISPLAY_FORMAT = 'D MMM YYYY, HH:mm'

export function toMillisecondPrecision(value: string): string {
  return value.replace(/(\.\d{3})\d+/, '$1')
}

export function formatDateTime(value?: string | null): string {
  if (!value) {
    return ''
  }
  const parsed = dayjs(toMillisecondPrecision(value))
  return parsed.isValid() ? parsed.format(DISPLAY_FORMAT) : ''
}

function dateTimeOffsetLabel(at?: string | null): string {
  const date = at ? new Date(toMillisecondPrecision(at)) : new Date()
  const offsetMinutes = -(Number.isNaN(date.getTime()) ? new Date() : date).getTimezoneOffset()
  const sign = offsetMinutes < 0 ? '-' : '+'
  const absolute = Math.abs(offsetMinutes)
  const hours = String(Math.floor(absolute / 60)).padStart(2, '0')
  const minutes = String(absolute % 60).padStart(2, '0')
  return `UTC${sign}${hours}:${minutes}`
}

export function dateTimeZoneLabel(at?: string | null): string {
  const { timeZone } = Intl.DateTimeFormat().resolvedOptions()
  return `${timeZone}, ${dateTimeOffsetLabel(at)}`
}

export function toLocalDateTime(value?: string | null): ZonedDateTime | undefined {
  if (!value) {
    return undefined
  }
  const time = new Date(toMillisecondPrecision(value)).getTime()
  return Number.isNaN(time) ? undefined : fromDate(new Date(time), getLocalTimeZone())
}

export function fromLocalDateTime(value?: DateValue | null): string | null {
  if (!value) {
    return null
  }
  const date = 'timeZone' in value ? value.toDate() : value.toDate(getLocalTimeZone())
  return date.toISOString()
}

export function earliestSelectable(value: string, minuteStep: number): string {
  const step = minuteStep * 60_000
  return new Date(Math.ceil(new Date(value).getTime() / step) * step).toISOString()
}
