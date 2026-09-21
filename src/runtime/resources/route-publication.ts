import dayjs from 'dayjs'

export type RouteLiveState = 'live' | 'scheduled' | 'draft'

export interface CwaRouteLiveAt {
  liveAt?: string | null
  effectiveLiveAt?: string | null
}

export interface CwaRouteLiveAtResource {
  liveAt?: string | null
  _metadata?: { effectiveLiveAt?: string | null, [key: string]: unknown } | null
}

const DATETIME_LOCAL_FORMAT = 'YYYY-MM-DDTHH:mm'
const DISPLAY_FORMAT = 'D MMM YYYY, HH:mm'

const stateLabels: Record<RouteLiveState, string> = {
  live: 'Live',
  scheduled: 'Scheduled',
  draft: 'Not live',
}

function stateFromDate(value: string | null | undefined, now: Date): RouteLiveState {
  if (!value) {
    return 'draft'
  }
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) {
    return 'draft'
  }
  return time <= now.getTime() ? 'live' : 'scheduled'
}

export function routePublicationFromResource(resource?: CwaRouteLiveAtResource | null): CwaRouteLiveAt {
  return {
    liveAt: resource?.liveAt,
    effectiveLiveAt: resource?._metadata?.effectiveLiveAt,
  }
}

export function getRouteOwnLiveState(resource?: CwaRouteLiveAt | null, now: Date = new Date()): RouteLiveState {
  return stateFromDate(resource?.liveAt, now)
}

export function routeReachableAt(resource?: CwaRouteLiveAt | null): string | null | undefined {
  return resource?.effectiveLiveAt
}

export function getRouteLiveState(resource?: CwaRouteLiveAt | null, now: Date = new Date()): RouteLiveState {
  return stateFromDate(routeReachableAt(resource), now)
}

export function isRouteGatedByAncestor(resource?: CwaRouteLiveAt | null): boolean {
  if (!resource?.liveAt) {
    return false
  }
  if (!resource.effectiveLiveAt) {
    return true
  }
  const own = new Date(resource.liveAt).getTime()
  const effective = new Date(resource.effectiveLiveAt).getTime()
  if (Number.isNaN(own) || Number.isNaN(effective)) {
    return false
  }
  return effective > own
}

export function routeLiveStateLabel(resource?: CwaRouteLiveAt | null, now: Date = new Date()): string {
  return stateLabels[getRouteLiveState(resource, now)]
}

export function formatRouteLiveAt(liveAt?: string | null): string {
  if (!liveAt) {
    return ''
  }
  const parsed = dayjs(liveAt)
  return parsed.isValid() ? parsed.format(DISPLAY_FORMAT) : ''
}

export function toRouteLiveAtInput(liveAt?: string | null): string {
  if (!liveAt) {
    return ''
  }
  const parsed = dayjs(liveAt)
  return parsed.isValid() ? parsed.format(DATETIME_LOCAL_FORMAT) : ''
}

export function fromRouteLiveAtInput(value?: string | null): string | null {
  if (!value) {
    return null
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

export function routeLiveAtTimezoneLabel(): string {
  const { timeZone } = Intl.DateTimeFormat().resolvedOptions()
  const offsetMinutes = -(new Date()).getTimezoneOffset()
  const sign = offsetMinutes < 0 ? '-' : '+'
  const absolute = Math.abs(offsetMinutes)
  const hours = String(Math.floor(absolute / 60)).padStart(2, '0')
  const minutes = String(absolute % 60).padStart(2, '0')
  return `${timeZone}, UTC${sign}${hours}:${minutes}`
}
