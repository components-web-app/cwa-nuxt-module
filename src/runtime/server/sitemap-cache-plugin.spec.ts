// @vitest-environment node

import { beforeEach, describe, expect, test, vi } from 'vitest'

const mockSetResponseHeader = vi.fn()
const mockUseSitemapCacheSettings = vi.fn()

vi.mock('h3', () => ({
  setResponseHeader: (...args: any[]) => mockSetResponseHeader(...args),
}))

vi.mock('nitropack/runtime', () => ({
  defineNitroPlugin: (fn: any) => fn,
}))

vi.mock('./sitemap-cache-config', () => ({
  useSitemapCacheSettings: () => mockUseSitemapCacheSettings(),
}))

async function captureBeforeResponse() {
  const plugin = (await import('./sitemap-cache-plugin')).default
  let hook: ((event: any) => void) | undefined
  plugin({
    hooks: {
      hook: (name: string, fn: (event: any) => void) => {
        if (name === 'beforeResponse') {
          hook = fn
        }
      },
    },
  } as never)
  return hook!
}

const createEvent = (statusCode: number, context: Record<string, unknown> = {}) => ({
  node: { res: { statusCode } },
  context,
})

describe('cwa sitemap cache nitro plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSitemapCacheSettings.mockReturnValue({
      apiUrl: 'https://example.com/_api',
      options: { sharedMaxAge: 600, staleWhileRevalidate: 0 },
    })
  })

  test('tags a rendered sitemap with the route collection so a route write purges it', async () => {
    const beforeResponse = await captureBeforeResponse()
    const event = createEvent(200, { _isSitemap: true })

    beforeResponse(event)

    expect(mockSetResponseHeader).toHaveBeenCalledWith(event, 'Surrogate-Key', 'cwa-html, /_api/_/routes')
    expect(mockSetResponseHeader).toHaveBeenCalledWith(event, 'Cache-Control', 'public, max-age=0, s-maxage=600')
  })

  test('leaves a response the sitemap package did not render alone', async () => {
    const beforeResponse = await captureBeforeResponse()

    beforeResponse(createEvent(200))
    beforeResponse(createEvent(200, { cwaPageCache: { surrogateKey: 'cwa-html, /_api/_/routes//real', cacheControl: 'public, max-age=0, s-maxage=600' } }))

    expect(mockSetResponseHeader).not.toHaveBeenCalled()
    expect(mockUseSitemapCacheSettings).not.toHaveBeenCalled()
  })

  test('leaves a sitemap request that did not end 200 alone', async () => {
    const beforeResponse = await captureBeforeResponse()

    beforeResponse(createEvent(301, { _isSitemap: true }))
    beforeResponse(createEvent(500, { _isSitemap: true }))

    expect(mockSetResponseHeader).not.toHaveBeenCalled()
  })

  test('emits the configured stale-while-revalidate', async () => {
    mockUseSitemapCacheSettings.mockReturnValue({
      apiUrl: 'https://api.example.com',
      options: { sharedMaxAge: 60, staleWhileRevalidate: 120 },
    })
    const beforeResponse = await captureBeforeResponse()
    const event = createEvent(200, { _isSitemap: true })

    beforeResponse(event)

    expect(mockSetResponseHeader).toHaveBeenCalledWith(event, 'Surrogate-Key', 'cwa-html, /_/routes')
    expect(mockSetResponseHeader).toHaveBeenCalledWith(event, 'Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=120')
  })
})
