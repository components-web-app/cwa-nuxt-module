// @vitest-environment node

import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fetchCwaPagePaths } from './cwa-page-paths'

const mockFetcher = vi.fn()
const mockResolveConfigEventHandler = vi.fn()

vi.mock('./useFetcher', () => ({
  default: () => ({ fetcher: mockFetcher }),
  resolveConfigEventHandler: (...args: any[]) => mockResolveConfigEventHandler(...args),
}))

describe('fetchCwaPagePaths', () => {
  beforeEach(() => {
    mockFetcher.mockReset()
    mockResolveConfigEventHandler.mockReset()
    mockResolveConfigEventHandler.mockResolvedValue({ sitemapEnabled: false })
    mockFetcher.mockResolvedValue({
      member: [
        { path: '/', page: '/_/pages/home' },
        { path: '/old', redirectPath: '/', page: '/_/pages/home' },
        { path: '/orphan' },
      ],
    })
  })

  test('lists the live page paths without consulting the sitemap setting', async () => {
    await expect(fetchCwaPagePaths()).resolves.toEqual(['/'])
    expect(mockFetcher).toHaveBeenCalledWith('/_/routes?pagination=false')
    expect(mockResolveConfigEventHandler).not.toHaveBeenCalled()
  })

  test('passes a timeout to the route list request when given one', async () => {
    await fetchCwaPagePaths({ timeout: 30000 })
    expect(mockFetcher).toHaveBeenCalledWith('/_/routes?pagination=false', { timeout: 30000 })
  })
})
