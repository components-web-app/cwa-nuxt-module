import type { CwaResource } from '../../../src/runtime/resources/resource-utils'

export type KitRouteState = 'live' | 'scheduled' | 'not-live' | 'parent-not-live' | 'redirect' | 'unused'

export const kitRouteStates: { value: KitRouteState, label: string }[] = [
  { value: 'live', label: 'Live' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'not-live', label: 'Not live' },
  { value: 'parent-not-live', label: 'Parent not live yet' },
  { value: 'redirect', label: 'Redirect' },
  { value: 'unused', label: 'Nothing uses it' },
]

const DAY = 24 * 60 * 60 * 1000

export interface KitRouteRow {
  resource: CwaResource
  state: KitRouteState
  associated: { redirect?: string, page?: string, pageData?: string, pageDataType?: string }
}

export function kitRoute(path: string, state: KitRouteState, now: Date): KitRouteRow {
  const past = new Date(now.getTime() - 30 * DAY).toISOString()
  const future = new Date(now.getTime() + 3 * DAY).toISOString()
  const later = new Date(now.getTime() + 10 * DAY).toISOString()
  const dates: Record<KitRouteState, { liveAt?: string, effectiveLiveAt?: string }> = {
    'live': { liveAt: past, effectiveLiveAt: past },
    'scheduled': { liveAt: future, effectiveLiveAt: future },
    'not-live': {},
    'parent-not-live': { liveAt: past, effectiveLiveAt: later },
    'redirect': { liveAt: past, effectiveLiveAt: past },
    'unused': { liveAt: past, effectiveLiveAt: past },
  }
  const { liveAt, effectiveLiveAt } = dates[state]
  const iri = `/_/routes/${encodeURIComponent(path)}`
  return {
    state,
    resource: { '@id': iri, '@type': 'Route', path, liveAt, ...(state === 'redirect' && { redirect: '/_/routes/kitchens' }), '_metadata': { persisted: true, effectiveLiveAt } } as CwaResource,
    associated: state === 'redirect'
      ? { redirect: '/kitchens' }
      : state === 'unused'
        ? {}
        : state === 'parent-not-live' ? { pageData: `Shaker kitchen ${path.length}`, pageDataType: 'App\\Entity\\KitchenData' } : { page: 'Kitchens' },
  }
}

export function kitRoutes(count: number, now: Date): KitRouteRow[] {
  return Array.from({ length: count }, (_, index) => {
    const state = kitRouteStates[index % kitRouteStates.length]!.value
    return kitRoute(index ? `/kitchens/range-${index}` : '/kitchens', state, now)
  })
}

export interface KitListPage {
  items: KitRouteRow[]
  total: number
}

export function kitListPage(rows: KitRouteRow[], search: string, page: number, perPage: number): KitListPage {
  const term = search.trim().toLowerCase()
  const found = term ? rows.filter(row => String(row.resource.path).toLowerCase().includes(term)) : rows
  return { items: found.slice((page - 1) * perPage, page * perPage), total: found.length }
}
