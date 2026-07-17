// @vitest-environment nuxt
import { describe, expect, test, vi, beforeEach } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import SiteConfig from '#cwa/api/site-config'

// `vi.mock('#imports')` does NOT intercept in any env — the factory is silently
// ignored and the real binding is used (see #265). This spec previously ran the
// real nuxt-site-config `updateSiteConfig`, which threw `[nuxt] instance
// unavailable` into site-config.ts's swallowing `.catch()`. Use mockNuxtImport.
const mockUpdateSiteConfig = vi.hoisted(() => vi.fn())
mockNuxtImport('updateSiteConfig', () => mockUpdateSiteConfig)

function buildSiteConfig(opts: {
  serverConfig?: Record<string, any> | null
  getConfig?: Record<string, any>
  userConfig?: Record<string, any>
  fetchResponse?: any
} = {}) {
  const mockPatch = vi.fn()
  const mockStore: any = {
    $patch: mockPatch,
    isLoading: false,
    serverConfig: opts.serverConfig ?? null,
    getConfig: opts.getConfig ?? {},
  }
  const mockFetch = vi.fn().mockResolvedValue(opts.fetchResponse ?? {})
  const mockGetRequestOptions = vi.fn().mockReturnValue({ method: 'POST', headers: {} })
  const mockCwaFetch: any = {
    fetch: mockFetch,
    getRequestOptions: mockGetRequestOptions,
  }
  const mockStoreDefinition: any = {
    useStore: vi.fn().mockReturnValue(mockStore),
  }

  const siteConfig = new SiteConfig(mockCwaFetch, mockStoreDefinition, opts.userConfig ?? {})

  return { siteConfig, mockStore, mockPatch, mockFetch, mockGetRequestOptions }
}

describe('SiteConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('loadConfig', () => {
    test('sets isLoading true before fetch, false after', async () => {
      const { siteConfig, mockPatch } = buildSiteConfig()
      await siteConfig.loadConfig()
      expect(mockPatch).toHaveBeenNthCalledWith(1, { isLoading: true })
      expect(mockPatch).toHaveBeenLastCalledWith(expect.objectContaining({ isLoading: false }))
    })

    test('fetches from /_/site_config_parameters with credentials: omit', async () => {
      const { siteConfig, mockFetch } = buildSiteConfig()
      await siteConfig.loadConfig()
      expect(mockFetch).toHaveBeenCalledWith('/_/site_config_parameters', { credentials: 'omit' })
    })

    test('patches store with resolved config', async () => {
      const { siteConfig, mockPatch } = buildSiteConfig({
        fetchResponse: {
          '@id': '/site_config',
          'member': [
            { key: 'siteName', value: 'Test Site' },
          ],
        },
        userConfig: { siteName: 'User Name' },
      })
      await siteConfig.loadConfig()
      expect(mockPatch).toHaveBeenLastCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({ siteName: 'Test Site' }),
        }),
      )
    })

    test('returns resolved config', async () => {
      const { siteConfig } = buildSiteConfig()
      const result = await siteConfig.loadConfig()
      expect(result).toBeDefined()
      expect(typeof result).toBe('object')
    })

    test('uses preloaded config from event context without making an API call', async () => {
      const preloadedConfig = { siteName: 'Preloaded' } as any
      const serverValues = { siteName: 'Preloaded' } as any
      const { siteConfig, mockFetch, mockPatch } = buildSiteConfig()
      const result = await siteConfig.loadConfig({ cwaSiteConfig: preloadedConfig, cwaSiteConfigServerValues: serverValues })
      expect(mockFetch).not.toHaveBeenCalled()
      expect(mockPatch).toHaveBeenCalledWith({ isLoading: false, config: preloadedConfig, serverConfig: serverValues })
      expect(result).toBe(preloadedConfig)
    })

    test('falls back to API fetch when event context has no preloaded config', async () => {
      const { siteConfig, mockFetch } = buildSiteConfig()
      await siteConfig.loadConfig({ someOtherKey: 'value' })
      expect(mockFetch).toHaveBeenCalledWith('/_/site_config_parameters', { credentials: 'omit' })
    })

    test('falls back to API fetch when event context is undefined', async () => {
      const { siteConfig, mockFetch } = buildSiteConfig()
      await siteConfig.loadConfig(undefined)
      expect(mockFetch).toHaveBeenCalledWith('/_/site_config_parameters', { credentials: 'omit' })
    })
  })

  describe('saveConfig', () => {
    test('returns 0 changed when no keys differ from saved config', () => {
      const { siteConfig } = buildSiteConfig({
        serverConfig: { siteName: 'CWA Web App' },
      })
      const result = siteConfig.saveConfig({ siteName: 'CWA Web App' })
      expect(result.totalConfigsChanged).toBe(0)
    })

    test('returns count of changed keys', () => {
      const { siteConfig } = buildSiteConfig({
        serverConfig: { siteName: 'Old Name' },
      })
      const result = siteConfig.saveConfig({ siteName: 'New Name' })
      expect(result.totalConfigsChanged).toBe(1)
    })

    test('returns 0 and skips when requests are in progress', () => {
      const { siteConfig, mockFetch } = buildSiteConfig({
        serverConfig: { siteName: 'Old' },
      })
      // trigger a first save to put requests in flight
      siteConfig.saveConfig({ siteName: 'New' })
      const result = siteConfig.saveConfig({ siteName: 'Another' })
      expect(result.totalConfigsChanged).toBe(0)
      // fetch only called once
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    test('returns 0 when savedSiteConfig is null', () => {
      const { siteConfig, mockFetch } = buildSiteConfig({ serverConfig: null })
      const result = siteConfig.saveConfig({ siteName: 'New' })
      expect(result.totalConfigsChanged).toBe(0)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    test('uses POST when key does not exist in serverConfig', () => {
      const { siteConfig, mockGetRequestOptions } = buildSiteConfig({
        serverConfig: {},
      })
      siteConfig.saveConfig({ siteName: 'New' })
      expect(mockGetRequestOptions).toHaveBeenCalledWith('POST')
    })

    test('uses PATCH when key already exists in serverConfig', () => {
      const { siteConfig, mockGetRequestOptions } = buildSiteConfig({
        serverConfig: { siteName: 'Old' },
      })
      siteConfig.saveConfig({ siteName: 'New' })
      expect(mockGetRequestOptions).toHaveBeenCalledWith('PATCH')
    })

    test('serialises boolean value to JSON string', () => {
      const { siteConfig, mockFetch } = buildSiteConfig({
        serverConfig: { indexable: true },
      })
      siteConfig.saveConfig({ indexable: false })
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ body: { key: 'indexable', value: 'false' } }),
      )
    })

    test('returns early with error when sitemapXml is invalid XML', () => {
      const { siteConfig, mockPatch, mockFetch } = buildSiteConfig({
        serverConfig: {},
      })
      const result = siteConfig.saveConfig({ sitemapXml: 'not xml <<' })
      expect(result.totalConfigsChanged).toBe(0)
      expect(mockFetch).not.toHaveBeenCalled()
      expect(mockPatch).toHaveBeenCalledWith({ isLoading: false })
    })

    test('proceeds when sitemapXml is valid XML', () => {
      const { siteConfig, mockFetch } = buildSiteConfig({
        serverConfig: {},
      })
      siteConfig.saveConfig({ sitemapXml: '<urlset></urlset>' })
      expect(mockFetch).toHaveBeenCalled()
    })

    // Guards #265: proves the updateSiteConfig mock actually intercepts. Without a
    // live mock the real nuxt-site-config `updateSiteConfig` runs, throws
    // `[nuxt] instance unavailable`, and the `.catch()` silently flips hasError.
    test('calls updateSiteConfig with the resolved site config after a successful save', async () => {
      const { siteConfig } = buildSiteConfig({
        serverConfig: { siteName: 'Old Name' },
        fetchResponse: { key: 'siteName', value: 'New Name' },
      })
      siteConfig.saveConfig({ siteName: 'New Name' })
      await vi.waitFor(() => expect(mockUpdateSiteConfig).toHaveBeenCalledTimes(1))
      expect(mockUpdateSiteConfig).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Name' }))
      expect(siteConfig.apiState.hasError.value).toBe(false)
    })
  })

  describe('totalRequests', () => {
    test('is 0 initially', () => {
      const { siteConfig } = buildSiteConfig({ serverConfig: {} })
      expect(siteConfig.totalRequests.value).toBe(0)
    })

    test('increases after saveConfig with changes', () => {
      const { siteConfig } = buildSiteConfig({ serverConfig: { siteName: 'Old' } })
      siteConfig.saveConfig({ siteName: 'New' })
      expect(siteConfig.totalRequests.value).toBe(1)
    })
  })

  describe('isLoading getter', () => {
    test('returns store isLoading', () => {
      const { siteConfig, mockStore } = buildSiteConfig()
      mockStore.isLoading = true
      expect(siteConfig.isLoading).toBe(true)
    })
  })

  describe('savedSiteConfig getter', () => {
    test('returns store serverConfig', () => {
      const { siteConfig } = buildSiteConfig({ serverConfig: { siteName: 'My Site' } })
      expect(siteConfig.savedSiteConfig).toEqual({ siteName: 'My Site' })
    })
  })
})
