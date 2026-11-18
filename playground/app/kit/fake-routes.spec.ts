import { describe, expect, test } from 'vitest'
import { getRouteLiveState, isRouteGatedByAncestor, routePublicationFromResource } from '../../../src/runtime/resources/route-publication'
import { kitListPage, kitRoute, kitRoutes } from './fake-routes'

const now = new Date('2026-11-18T12:00:00Z')

describe('the /kit fake routes', () => {
  test('each route state reads as that state through the module\'s own route-publication functions', () => {
    const state = (name: Parameters<typeof kitRoute>[1]) => routePublicationFromResource(kitRoute('/x', name, now).resource as never)
    expect(getRouteLiveState(state('live'), now)).toBe(getRouteLiveState({ liveAt: '2020-01-01T00:00:00Z', effectiveLiveAt: '2020-01-01T00:00:00Z' }, now))
    expect(getRouteLiveState(state('scheduled'), now)).not.toBe(getRouteLiveState(state('live'), now))
    expect(getRouteLiveState(state('not-live'), now)).not.toBe(getRouteLiveState(state('live'), now))
    expect(isRouteGatedByAncestor(state('parent-not-live'), now)).toBe(true)
    expect(isRouteGatedByAncestor(state('live'), now)).toBe(false)
  })

  test('a long list pages 20 at a time and keeps the total', () => {
    const rows = kitRoutes(95, now)
    expect(kitListPage(rows, '', 1, 20)).toMatchObject({ total: 95 })
    expect(kitListPage(rows, '', 5, 20).items).toHaveLength(15)
  })

  test('a search that matches nothing gives an empty page with a total of 0', () => {
    expect(kitListPage(kitRoutes(12, now), 'zzz', 1, 20)).toEqual({ items: [], total: 0 })
    expect(kitListPage(kitRoutes(12, now), 'RANGE-1', 1, 20).items.map(row => row.resource.path)).toEqual(['/kitchens/range-1', '/kitchens/range-10', '/kitchens/range-11'])
  })
})
