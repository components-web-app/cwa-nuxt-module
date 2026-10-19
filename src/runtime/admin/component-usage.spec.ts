import { describe, expect, test, vi } from 'vitest'
import { fetchComponentUsage } from './component-usage'
import type Cwa from '#cwa/cwa'

function cwaFetching(response: Promise<unknown>) {
  const fetch = vi.fn(() => ({ response, headers: {} }))
  return { $cwa: { fetch } as unknown as Cwa, fetch }
}

describe('fetchComponentUsage', () => {
  test('reads positionCount, pageDataCount and total from the component\'s usage endpoint', async () => {
    const { $cwa, fetch } = cwaFetching(Promise.resolve({ _data: { positionCount: 2, pageDataCount: 1, total: 3 } }))

    const usage = await fetchComponentUsage($cwa, '/component/abc')

    expect(fetch).toHaveBeenCalledWith({ path: '/component/abc/usage', noQuery: true })
    expect(usage).toEqual({ positionCount: 2, pageDataCount: 1, total: 3 })
  })

  test('passes the locations through for an admin, in the order the API returns them', async () => {
    const locations = [
      { componentPosition: '/_/component_positions/p2', pageDataProperty: null, pageData: null, property: null, layout: { iri: '/_/layouts/l1', reference: 'main' }, renderedOn: [], renderedOnCount: 0 },
      { componentPosition: '/_/component_positions/p1', pageDataProperty: null, pageData: null, property: null, layout: null, renderedOn: [{ iri: '/_/pages/b', title: 'B', routePath: '/b' }], renderedOnCount: 1 },
    ]
    const { $cwa } = cwaFetching(Promise.resolve({ _data: { positionCount: 2, pageDataCount: 0, total: 2, locations } }))

    const usage = await fetchComponentUsage($cwa, '/component/abc')

    expect(usage?.locations).toEqual(locations)
  })

  test('has no locations key when the API sends none, as for a non-admin or an older bundle', async () => {
    const { $cwa } = cwaFetching(Promise.resolve({ _data: { positionCount: 2, pageDataCount: 1, total: 3 } }))

    expect(await fetchComponentUsage($cwa, '/component/abc')).not.toHaveProperty('locations')
  })

  test('a failed usage request returns no usage', async () => {
    const { $cwa } = cwaFetching(Promise.reject(new Error('Not Found')))

    expect(await fetchComponentUsage($cwa, '/component/abc')).toBeUndefined()
  })

  test('a response without a total returns no usage', async () => {
    const { $cwa } = cwaFetching(Promise.resolve({ _data: { positionCount: 2 } }))

    expect(await fetchComponentUsage($cwa, '/component/abc')).toBeUndefined()
  })
})
