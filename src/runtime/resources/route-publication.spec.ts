import { describe, test, expect } from 'vitest'
import dayjs from 'dayjs'
import {
  formatRouteLiveAt,
  fromRouteLiveAtInput,
  getRouteLiveState,
  getRouteOwnLiveState,
  hasRouteEffectiveLiveAt,
  isRouteGatedByAncestor,
  routeLiveAtTimezoneLabel,
  routeLiveStateLabel,
  routeReachableAt,
  toRouteLiveAtInput,
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

  test('falls back to the route own date when the API does not expose the effective one', () => {
    expect(hasRouteEffectiveLiveAt({ liveAt: past })).toBe(false)
    expect(getRouteLiveState({ liveAt: past }, now)).toBe('live')
    expect(getRouteLiveState({ liveAt: future }, now)).toBe('scheduled')
    expect(routeReachableAt({ liveAt: future })).toBe(future)
    expect(isRouteGatedByAncestor({ liveAt: past })).toBe(false)
  })

  test('an explicit effective date counts as the API exposing it', () => {
    expect(hasRouteEffectiveLiveAt({ effectiveLiveAt: null })).toBe(true)
    expect(hasRouteEffectiveLiveAt({ effectiveLiveAt: past })).toBe(true)
    expect(hasRouteEffectiveLiveAt(undefined)).toBe(false)
  })
})

describe('datetime-local conversion', () => {
  test('a wall clock time an editor types is committed as that instant in their own timezone', () => {
    expect(fromRouteLiveAtInput('2026-09-25T09:00')).toBe(new Date('2026-09-25T09:00').toISOString())
  })

  test('a stored instant is shown back as the same wall clock time the editor typed', () => {
    const committed = fromRouteLiveAtInput('2026-09-25T09:00')
    expect(toRouteLiveAtInput(committed)).toBe('2026-09-25T09:00')
  })

  test('clearing the input commits no date rather than an empty string', () => {
    expect(fromRouteLiveAtInput('')).toBeNull()
    expect(fromRouteLiveAtInput(undefined)).toBeNull()
    expect(fromRouteLiveAtInput(null)).toBeNull()
  })

  test('an unparseable input commits no date', () => {
    expect(fromRouteLiveAtInput('not a date')).toBeNull()
  })

  test('a draft route shows an empty datetime input', () => {
    expect(toRouteLiveAtInput(null)).toBe('')
    expect(toRouteLiveAtInput(undefined)).toBe('')
  })

  test('the committed instant is offset-bearing so the API never has to guess a timezone', () => {
    expect(fromRouteLiveAtInput('2026-09-25T09:00')).toMatch(/Z$/)
  })
})

describe('display', () => {
  test('labels each state the same way wherever a route is listed', () => {
    expect(routeLiveStateLabel({ liveAt: past }, now)).toBe('Live')
    expect(routeLiveStateLabel({ liveAt: future }, now)).toBe('Scheduled')
    expect(routeLiveStateLabel({ liveAt: null }, now)).toBe('Not live')
    expect(routeLiveStateLabel({}, now)).toBe('Not live')
  })

  test('shows a go-live date in the editor own timezone, not UTC', () => {
    const committed = fromRouteLiveAtInput('2026-09-25T09:00') as string
    expect(formatRouteLiveAt(committed)).toBe(dayjs(committed).format('D MMM YYYY, HH:mm'))
  })

  test('shows no date for a route that has none', () => {
    expect(formatRouteLiveAt(null)).toBe('')
    expect(formatRouteLiveAt(undefined)).toBe('')
  })
})

describe('timezone label', () => {
  test('names the zone and offset the control is committing to', () => {
    const label = routeLiveAtTimezoneLabel()
    expect(label).toContain(Intl.DateTimeFormat().resolvedOptions().timeZone)
    expect(label).toMatch(/UTC[+-]\d{2}:\d{2}/)
  })
})
