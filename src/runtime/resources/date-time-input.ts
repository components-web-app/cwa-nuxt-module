import dayjs from 'dayjs'

const DATETIME_LOCAL_FORMAT = 'YYYY-MM-DDTHH:mm'
const DISPLAY_FORMAT = 'D MMM YYYY, HH:mm'

export function formatDateTime(value?: string | null): string {
  if (!value) {
    return ''
  }
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.format(DISPLAY_FORMAT) : ''
}

export function toDateTimeInput(value?: string | null): string {
  if (!value) {
    return ''
  }
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.format(DATETIME_LOCAL_FORMAT) : ''
}

export function fromDateTimeInput(value?: string | null): string | null {
  if (!value) {
    return null
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

export function dateTimeZoneLabel(): string {
  const { timeZone } = Intl.DateTimeFormat().resolvedOptions()
  const offsetMinutes = -(new Date()).getTimezoneOffset()
  const sign = offsetMinutes < 0 ? '-' : '+'
  const absolute = Math.abs(offsetMinutes)
  const hours = String(Math.floor(absolute / 60)).padStart(2, '0')
  const minutes = String(absolute % 60).padStart(2, '0')
  return `${timeZone}, UTC${sign}${hours}:${minutes}`
}
