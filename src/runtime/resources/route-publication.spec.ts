import { describe, test, expect } from 'vitest'
import {
  getRouteLiveState,
  getRouteOwnLiveState,
  isRouteGatedByAncestor,
  routeLiveStateLabel,
  routePublicationFromResource,
  routeReachableAt,
} from './route-publication'

const now = new Date('2026-09-20T12:00:00.000Z')
const future = '2999-01-01T00:00:00+00:00'
const past = '2020-01-01T00:00:00+00:00'

describe('a route own go-live date', () => {
  test('a route with no go-live date is a draft nobody can see', () => {
    expect(getRouteOwnLiveState({ liveAt: null }, now)).toBe('draft')
  })

  test('an admin response that omits the key is the same draft, because the API omits nulls', () => {
    expect(getRouteOwnLiveState({}, now)).toBe('draft')
  })

  test('a go-live date in the future is scheduled and not yet live', () => {
    expect(getRouteOwnLiveState({ liveAt: future }, now)).toBe('scheduled')
  })

  test('a go-live date in the past is live', () => {
    expect(getRouteOwnLiveState({ liveAt: past }, now)).toBe('live')
  })

  test('a go-live date of exactly now is live, matching the API predicate', () => {
    expect(getRouteOwnLiveState({ liveAt: now.toISOString() }, now)).toBe('live')
  })

  test('an undefined resource is treated as a draft rather than throwing', () => {
    expect(getRouteOwnLiveState(undefined, now)).toBe('draft')
  })

  test('the route own state ignores an ancestor holding the page back', () => {
    expect(getRouteOwnLiveState({ liveAt: past, effectiveLiveAt: future }, now)).toBe('live')
  })
})

describe('when the page actually becomes reachable', () => {
  test('a live child route whose parent goes live next week is not reachable until the parent is', () => {
    const child = { liveAt: past, effectiveLiveAt: future }
    expect(getRouteLiveState(child, now)).toBe('scheduled')
    expect(routeLiveStateLabel(child, now)).toBe('Scheduled')
    expect(routeReachableAt(child)).toBe(future)
    expect(isRouteGatedByAncestor(child)).toBe(true)
  })

  test('a draft ancestor holds the whole branch back however live the child is', () => {
    expect(getRouteLiveState({ liveAt: past, effectiveLiveAt: null }, now)).toBe('draft')
  })

  test('a route with no ancestors gating it reports its own state', () => {
    const route = { liveAt: past, effectiveLiveAt: past }
    expect(getRouteLiveState(route, now)).toBe('live')
    expect(isRouteGatedByAncestor(route)).toBe(false)
  })

  test('an effective date earlier than the route own date is not a parent gate', () => {
    expect(isRouteGatedByAncestor({ liveAt: '3999-01-01T00:00:00+00:00', effectiveLiveAt: future })).toBe(false)
  })

  test('the same instant written two ways is not mistaken for a parent gate', () => {
    expect(isRouteGatedByAncestor({ liveAt: '2999-01-01T00:00:00+00:00', effectiveLiveAt: '2999-01-01T00:00:00.000Z' })).toBe(false)
  })

  test('a missing effective date is a route nobody can reach, never a route assumed live', () => {
    expect(getRouteLiveState({ liveAt: past }, now)).toBe('draft')
    expect(getRouteLiveState({ liveAt: future }, now)).toBe('draft')
    expect(routeReachableAt({ liveAt: past })).toBeUndefined()
    expect(isRouteGatedByAncestor({ liveAt: past })).toBe(true)
  })
})

describe('reading the effective go-live date off a route resource', () => {
  test('reads the effective date from resource metadata, where the API resolves it per request', () => {
    const publication = routePublicationFromResource({ liveAt: past, _metadata: { persisted: true, effectiveLiveAt: future } })
    expect(routeReachableAt(publication)).toBe(future)
    expect(getRouteLiveState(publication, now)).toBe('scheduled')
    expect(isRouteGatedByAncestor(publication)).toBe(true)
  })

  test('a route no ancestor gates carries its own date as its effective date', () => {
    const publication = routePublicationFromResource({ liveAt: past, _metadata: { persisted: true, effectiveLiveAt: past } })
    expect(getRouteLiveState(publication, now)).toBe('live')
    expect(isRouteGatedByAncestor(publication)).toBe(false)
  })

  test('ignores a top level effective date, which the API no longer sends', () => {
    const publication = routePublicationFromResource({ liveAt: past, effectiveLiveAt: future })
    expect(routeReachableAt(publication)).toBeUndefined()
    expect(getRouteLiveState(publication, now)).toBe('draft')
  })

  test('a null effective date in metadata is a draft ancestor', () => {
    const publication = routePublicationFromResource({ liveAt: past, _metadata: { persisted: true, effectiveLiveAt: null } })
    expect(getRouteLiveState(publication, now)).toBe('draft')
    expect(isRouteGatedByAncestor(publication)).toBe(true)
  })

  test('metadata without the key means the same, because the API omits a null it resolved', () => {
    const publication = routePublicationFromResource({ liveAt: past, _metadata: { persisted: true } })
    expect(getRouteLiveState(publication, now)).toBe('draft')
    expect(isRouteGatedByAncestor(publication)).toBe(true)
  })

  test('a route with no metadata at all is not live', () => {
    expect(getRouteLiveState(routePublicationFromResource({ liveAt: future }), now)).toBe('draft')
    expect(getRouteLiveState(routePublicationFromResource({ liveAt: past, _metadata: null }), now)).toBe('draft')
  })

  test('an absent resource is a draft rather than a throw', () => {
    expect(getRouteLiveState(routePublicationFromResource(undefined), now)).toBe('draft')
  })

  test('keeps the route own date so the editor still edits the date it owns', () => {
    expect(routePublicationFromResource({ liveAt: past, _metadata: { persisted: true, effectiveLiveAt: future } }).liveAt).toBe(past)
  })
})

describe('display', () => {
  test('labels each state the same way wherever a route is listed', () => {
    expect(routeLiveStateLabel({ liveAt: past, effectiveLiveAt: past }, now)).toBe('Live')
    expect(routeLiveStateLabel({ liveAt: future, effectiveLiveAt: future }, now)).toBe('Scheduled')
    expect(routeLiveStateLabel({ liveAt: null }, now)).toBe('Not live')
    expect(routeLiveStateLabel({}, now)).toBe('Not live')
  })
})
