import type { FetchError } from 'ofetch'

export function retryAfterSeconds(error: FetchError): number | undefined {
  const headers = error.response?.headers
  const value = headers?.get('Retry-After')?.trim()
  if (!value) {
    return undefined
  }
  if (/^\d+$/.test(value)) {
    return Number(value)
  }
  const retryAt = Date.parse(value)
  if (Number.isNaN(retryAt)) {
    return undefined
  }
  const sentAt = Date.parse(headers?.get('Date') ?? '')
  if (Number.isNaN(sentAt)) {
    return undefined
  }
  const seconds = Math.ceil((retryAt - sentAt) / 1000)
  return seconds > 0 ? seconds : undefined
}

export function formatWait(seconds: number): string {
  if (seconds < 60) {
    return 'less than a minute'
  }
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 90) {
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
  }
  const hours = Math.round(minutes / 60)
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`
}

export function formatCountdown(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remaining = String(seconds % 60).padStart(2, '0')
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${remaining}` : `${minutes}:${remaining}`
}
