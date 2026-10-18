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

  test('a failed usage request returns no usage', async () => {
    const { $cwa } = cwaFetching(Promise.reject(new Error('Not Found')))

    expect(await fetchComponentUsage($cwa, '/component/abc')).toBeUndefined()
  })

  test('a response without a total returns no usage', async () => {
    const { $cwa } = cwaFetching(Promise.resolve({ _data: { positionCount: 2 } }))

    expect(await fetchComponentUsage($cwa, '/component/abc')).toBeUndefined()
  })
})
