export type RouteLiveState = 'live' | 'scheduled' | 'draft'

export interface CwaRouteLiveAt {
  liveAt?: string | null
  effectiveLiveAt?: string | null
}

export interface CwaRouteLiveAtResource {
  liveAt?: string | null
  _metadata?: { effectiveLiveAt?: string | null, [key: string]: unknown } | null
}

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
