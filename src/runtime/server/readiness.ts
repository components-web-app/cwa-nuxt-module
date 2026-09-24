export const READINESS_DEFAULTS = {
  path: '/_/health',
  timeout: 2000,
}

export interface ReadinessConfig {
  path?: string
  timeout?: number | string
}

export interface ReadinessSettings {
  path: string
  timeout: number
}

export interface ReadinessProbe {
  status?: number
  location?: string
  error?: { code?: string, timeout?: boolean }
}

export interface ReadinessVerdict {
  ready: boolean
  reason?: string
}

function positiveInteger(value: number | string | undefined): number | undefined {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : undefined
}

export function resolveReadinessSettings({ readiness }: { readiness?: ReadinessConfig }): ReadinessSettings {
  return {
    path: readiness?.path || READINESS_DEFAULTS.path,
    timeout: positiveInteger(readiness?.timeout) ?? READINESS_DEFAULTS.timeout,
  }
}

export function readinessUrl(apiUrl: string, path: string) {
  return `${apiUrl.replace(/\/+$/, '')}${path}`
}

export function classifyReadiness(url: string, { status, location, error }: ReadinessProbe): ReadinessVerdict {
  if (error) {
    if (error.timeout) {
      return { ready: false, reason: `${url} did not respond within the readiness timeout` }
    }
    return { ready: false, reason: `${url} could not be reached${error.code ? ` (${error.code})` : ''}` }
  }
  if (status === undefined || status >= 500) {
    return { ready: false, reason: `${url} responded ${status}` }
  }
  if (status >= 300 && status < 400) {
    return { ready: false, reason: `${url} responded ${status}${location ? `, redirecting to ${location}` : ''}` }
  }
  if (status === 404) {
    return { ready: true, reason: `${url} responded 404. The API is answering, but it has no health endpoint - upgrade the API to report readiness accurately.` }
  }
  if (status >= 400) {
    return { ready: true, reason: `${url} responded ${status}. The API is answering, but the health endpoint is not public.` }
  }
  return { ready: true }
}
