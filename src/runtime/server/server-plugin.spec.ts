// @vitest-environment node

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mockUseRuntimeConfig = vi.fn()
const mockError = vi.fn()
const mockWarn = vi.fn()

vi.mock('nitropack/runtime', () => ({
  defineNitroPlugin: (fn: any) => fn,
  useRuntimeConfig: (...args: any[]) => mockUseRuntimeConfig(...args),
}))

vi.mock('consola', () => ({
  consola: { withTag: () => ({ error: mockError, warn: mockWarn }) },
}))

vi.mock('#robots/util', () => ({
  parseRobotsTxt: vi.fn(() => ({ groups: [], sitemaps: [] })),
  NonHelpfulBots: [],
  AiBots: [],
}))

vi.mock('#cwa/server/useFetcher', () => ({
  resolveConfigEventHandler: vi.fn(),
}))

type Hooks = Record<string, (...args: any[]) => any>

async function startPlugin(runtimeConfig: any = { public: { cwa: {} } }): Promise<Hooks> {
  mockUseRuntimeConfig.mockReturnValue(runtimeConfig)
  const plugin = (await import('./server-plugin')).default
  const hooks: Hooks = {}
  const hook = (name: string, fn: any) => {
    hooks[name] = fn
  }
  await plugin({ hooks: { hook } } as never)
  return hooks
}

const renderEvent = (cwaSiteConfig?: unknown, cwaPageCache: unknown = {}) => ({
  context: { cwaPageCache, cwaSiteConfig },
})

describe('server start diagnostics (#345)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NUXT_SITE_URL', '')
    vi.stubEnv('NUXT_PUBLIC_SITE_URL', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('no API URL configured', () => {
    test('reports an error naming both environment variables and the consequence', async () => {
      await startPlugin({ public: { cwa: { apiUrl: '', apiUrlBrowser: '' } }, cwa: { apiUrl: '' } })

      expect(mockError).toHaveBeenCalledTimes(1)
      const [message] = mockError.mock.calls[0]
      expect(message).toContain('NUXT_CWA_API_URL')
      expect(message).toContain('NUXT_PUBLIC_CWA_API_URL_BROWSER')
      expect(message).toContain('No API request will succeed')
    })

    test('says nothing when the private URL is set', async () => {
      await startPlugin({ public: { cwa: {} }, cwa: { apiUrl: 'http://php/_api' } })

      expect(mockError).not.toHaveBeenCalled()
      expect(mockWarn).not.toHaveBeenCalled()
    })

    test('says nothing when only the browser URL is set', async () => {
      await startPlugin({ public: { cwa: { apiUrlBrowser: 'https://www.example.com/_api' } } })

      expect(mockError).not.toHaveBeenCalled()
    })
  })

  describe('the deprecated public API URL', () => {
    test('is reported once when it supplies the server URL', async () => {
      await startPlugin({ public: { cwa: { apiUrl: 'http://php/_api' } } })

      expect(mockWarn).toHaveBeenCalledTimes(1)
      const [message] = mockWarn.mock.calls[0]
      expect(message).toContain('NUXT_PUBLIC_CWA_API_URL')
      expect(message).toContain('NUXT_CWA_API_URL')
    })

    test('is not reported when the private URL takes precedence', async () => {
      await startPlugin({ public: { cwa: { apiUrl: 'http://php/_api' } }, cwa: { apiUrl: 'http://private/_api' } })

      expect(mockWarn).not.toHaveBeenCalled()
    })

    test('is not reported when it only supplies the browser URL', async () => {
      await startPlugin({ public: { cwa: { apiUrlBrowser: 'https://www.example.com/_api' } }, cwa: { apiUrl: 'http://private/_api' } })

      expect(mockWarn).not.toHaveBeenCalled()
    })
  })

  describe('no site URL configured while pages are cached', () => {
    const apiConfigured = { public: { cwa: {} }, cwa: { apiUrl: 'http://php/_api' } }

    test('reports that each page keeps the host of the request that rendered it', async () => {
      const hooks = await startPlugin(apiConfigured)

      hooks.afterResponse!(renderEvent({ siteName: 'Example' }))

      expect(mockWarn).toHaveBeenCalledTimes(1)
      const [message] = mockWarn.mock.calls[0]
      expect(message).toContain('canonicalUrl')
      expect(message).toContain('NUXT_SITE_URL')
      expect(message).toContain('host')
    })

    test('is reported only once however many pages are rendered', async () => {
      const hooks = await startPlugin(apiConfigured)

      hooks.afterResponse!(renderEvent({ siteName: 'Example' }))
      hooks.afterResponse!(renderEvent({ siteName: 'Example' }))
      hooks.afterResponse!(renderEvent({ siteName: 'Example' }))

      expect(mockWarn).toHaveBeenCalledTimes(1)
    })

    test('says nothing when the site settings carry a canonical URL', async () => {
      const hooks = await startPlugin(apiConfigured)

      hooks.afterResponse!(renderEvent({ canonicalUrl: 'https://www.example.com' }))

      expect(mockWarn).not.toHaveBeenCalled()
    })

    test('says nothing when NUXT_SITE_URL is set, which nuxt-site-config reads straight from the environment', async () => {
      vi.stubEnv('NUXT_SITE_URL', 'https://www.example.com')
      const hooks = await startPlugin(apiConfigured)

      hooks.afterResponse!(renderEvent({ siteName: 'Example' }))

      expect(mockWarn).not.toHaveBeenCalled()
    })

    test('says nothing when NUXT_PUBLIC_SITE_URL is set', async () => {
      vi.stubEnv('NUXT_PUBLIC_SITE_URL', 'https://www.example.com')
      const hooks = await startPlugin(apiConfigured)

      hooks.afterResponse!(renderEvent({ siteName: 'Example' }))

      expect(mockWarn).not.toHaveBeenCalled()
    })

    test('says nothing when the private site URL is configured', async () => {
      const hooks = await startPlugin({ ...apiConfigured, site: { url: 'https://www.example.com' } })

      hooks.afterResponse!(renderEvent({ siteName: 'Example' }))

      expect(mockWarn).not.toHaveBeenCalled()
    })

    test('says nothing when the public site URL is configured', async () => {
      const hooks = await startPlugin({ public: { cwa: {}, site: { url: 'https://www.example.com' } }, cwa: { apiUrl: 'http://php/_api' } })

      hooks.afterResponse!(renderEvent({ siteName: 'Example' }))

      expect(mockWarn).not.toHaveBeenCalled()
    })

    test('says nothing when a build-time site URL is in the site config stack', async () => {
      const hooks = await startPlugin({
        ...apiConfigured,
        'nuxt-site-config': { stack: [{ _context: 'system', env: 'production' }, { _context: 'buildEnv', url: 'https://www.example.com' }] },
      })

      hooks.afterResponse!(renderEvent({ siteName: 'Example' }))

      expect(mockWarn).not.toHaveBeenCalled()
    })

    test('says nothing for a response the page cache never considered', async () => {
      const hooks = await startPlugin(apiConfigured)

      hooks.afterResponse!({ context: { cwaSiteConfig: { siteName: 'Example' } } })

      expect(mockWarn).not.toHaveBeenCalled()
    })

    test('waits for a response whose site config resolved rather than spending its one report', async () => {
      const hooks = await startPlugin(apiConfigured)

      hooks.afterResponse!(renderEvent(undefined))
      expect(mockWarn).not.toHaveBeenCalled()

      hooks.afterResponse!(renderEvent({ siteName: 'Example' }))
      expect(mockWarn).toHaveBeenCalledTimes(1)
    })
  })
})
