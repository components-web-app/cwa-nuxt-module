// @vitest-environment nuxt
import { describe, expect, test, vi, beforeEach } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import SiteConfig from '#cwa/api/site-config'
import { defaultSiteConfig } from '#cwa/composables/useCwaSiteConfig'

const mockUpdateSiteConfig = vi.hoisted(() => vi.fn())
mockNuxtImport('updateSiteConfig', () => mockUpdateSiteConfig)

const warmModule = vi.hoisted(() => ({ loads: 0 }))
const saveModule = vi.hoisted(() => ({ loads: 0 }))
vi.mock('#cwa/api/site-config-save', async (importOriginal) => {
  saveModule.loads++
  return await importOriginal()
})
vi.mock('#cwa/api/page-cache-warm', async (importOriginal) => {
  warmModule.loads++
  return await importOriginal()
})

function buildSiteConfig(opts: {
  serverConfig?: Record<string, any> | null
  getConfig?: Record<string, any>
  userConfig?: Record<string, any>
  fetchResponse?: any
} = {}) {
  const mockPatch = vi.fn((patch: Record<string, any>) => {
    Object.assign(mockStore, patch, patch.config ? { getConfig: patch.config } : {})
  })
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

    test('stops loading and rethrows when the API cannot be reached', async () => {
      const { siteConfig, mockPatch, mockFetch } = buildSiteConfig()
      mockFetch.mockRejectedValueOnce(new Error('fetch failed'))

      await expect(siteConfig.loadConfig()).rejects.toThrow('fetch failed')
      expect(mockPatch).toHaveBeenLastCalledWith({ isLoading: false })
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

  describe('saveConfig (#461)', () => {
    function echo(mockFetch: ReturnType<typeof vi.fn>, refuse: Record<string, unknown> = {}) {
      mockFetch.mockImplementation(async (_path: string, { body }: any) => {
        if (body.key in refuse) {
          throw refuse[body.key]
        }
        return { key: body.key, value: body.value }
      })
    }

    test('the save code is only loaded when a save starts, so visitors never download it (#382)', async () => {
      const { siteConfig, mockFetch } = buildSiteConfig({ serverConfig: { siteName: 'Old' } })
      echo(mockFetch)
      expect(saveModule.loads).toBe(0)
      await siteConfig.saveConfig({ siteName: 'New' })
      expect(saveModule.loads).toBe(1)
    })

    test('a key that was never stored is created with a POST, and one already stored is changed with a PATCH', async () => {
      const { siteConfig, mockFetch, mockGetRequestOptions } = buildSiteConfig({ serverConfig: { siteName: 'Old' } })
      echo(mockFetch)
      await siteConfig.saveConfig({ siteName: 'New', robotsText: 'User-agent: *' })
      expect(mockGetRequestOptions.mock.calls).toEqual([['PATCH'], ['POST']])
      expect(mockFetch.mock.calls.map(([path]) => path)).toEqual(['/_/site_config_parameters/siteName', '/_/site_config_parameters'])
    })

    test('a boolean is sent as a JSON string', async () => {
      const { siteConfig, mockFetch } = buildSiteConfig({ serverConfig: { indexable: true } })
      echo(mockFetch)
      await siteConfig.saveConfig({ indexable: false })
      expect(mockFetch).toHaveBeenCalledWith('/_/site_config_parameters/indexable', expect.objectContaining({ body: { key: 'indexable', value: 'false' } }))
    })

    test('a key equal to the stored one is not sent', async () => {
      const { siteConfig, mockFetch } = buildSiteConfig({ serverConfig: { siteName: 'Same' } })
      await expect(siteConfig.saveConfig({ siteName: 'Same' })).resolves.toEqual([])
      expect(mockFetch).not.toHaveBeenCalled()
    })

    test('stores exactly what the API holds, with no defaults, and resolves the config from the app\'s options over it', async () => {
      const { siteConfig, mockFetch, mockPatch } = buildSiteConfig({ serverConfig: { siteName: 'Old' }, userConfig: { canonicalUrl: 'https://app.example' } })
      echo(mockFetch)

      await expect(siteConfig.saveConfig({ siteName: 'New', indexable: false })).resolves.toEqual([])

      expect(mockPatch).toHaveBeenLastCalledWith({
        serverConfig: { siteName: 'New', indexable: false },
        config: { ...defaultSiteConfig, canonicalUrl: 'https://app.example', siteName: 'New', indexable: false },
      })
      expect(mockUpdateSiteConfig).toHaveBeenCalledWith({ name: 'New', indexable: true, url: 'https://app.example' })
    })

    test('a key that fails is named with its error, the keys that saved are stored, and the failed one is still unstored', async () => {
      const refused = Object.assign(new Error('422'), { statusCode: 422 })
      const { siteConfig, mockFetch, mockPatch } = buildSiteConfig({ serverConfig: { siteName: 'Old' } })
      echo(mockFetch, { canonicalUrl: refused })

      await expect(siteConfig.saveConfig({ siteName: 'New', canonicalUrl: 'https://kitchens.example' })).resolves.toEqual([{ key: 'canonicalUrl', error: refused }])

      expect(mockPatch).toHaveBeenLastCalledWith(expect.objectContaining({ serverConfig: { siteName: 'New' } }))
    })

    test('a first POST that fails is retried as a POST, never a PATCH to a key that does not exist', async () => {
      const { siteConfig, mockFetch, mockGetRequestOptions } = buildSiteConfig({ serverConfig: { siteName: 'Old' } })
      echo(mockFetch, { canonicalUrl: Object.assign(new Error('500'), { statusCode: 500 }) })
      await siteConfig.saveConfig({ siteName: 'New', canonicalUrl: 'https://kitchens.example' })
      mockGetRequestOptions.mockClear()
      echo(mockFetch)

      await expect(siteConfig.saveConfig({ canonicalUrl: 'https://kitchens.example' })).resolves.toEqual([])

      expect(mockGetRequestOptions).toHaveBeenCalledWith('POST')
      expect(mockGetRequestOptions).not.toHaveBeenCalledWith('PATCH')
    })

    test('clearing a stored value stores it empty, and the config falls back to the app\'s option or the default', async () => {
      const { siteConfig, mockFetch, mockPatch } = buildSiteConfig({ serverConfig: { siteName: 'Kitchens', robotsText: 'User-agent: *' } })
      echo(mockFetch)

      await siteConfig.saveConfig({ siteName: '', robotsText: '' })

      expect(mockPatch).toHaveBeenLastCalledWith({
        serverConfig: { siteName: '', robotsText: '' },
        config: defaultSiteConfig,
      })
    })

    test('nothing is stored or announced when every key fails', async () => {
      const { siteConfig, mockFetch, mockPatch } = buildSiteConfig({ serverConfig: { siteName: 'Old' } })
      echo(mockFetch, { siteName: new Error('offline') })

      await siteConfig.saveConfig({ siteName: 'New' })

      expect(mockPatch).not.toHaveBeenCalled()
      expect(mockUpdateSiteConfig).not.toHaveBeenCalled()
    })

    test('before the config has loaded, every key fails and nothing is sent', async () => {
      const { siteConfig, mockFetch } = buildSiteConfig({ serverConfig: null })
      await expect(siteConfig.saveConfig({ siteName: 'New' })).resolves.toEqual([{ key: 'siteName', error: expect.any(Error) }])
      expect(mockFetch).not.toHaveBeenCalled()
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

  describe('warmPageCache', () => {
    test('the stream reader is only loaded when a warm is started, so visitors never download it (#382)', () => {
      buildSiteConfig()
      expect(warmModule.loads).toBe(0)
    })

    test('POSTs to the warm route as a stream and resolves with its summary', async () => {
      const { siteConfig, mockFetch } = buildSiteConfig()
      const encoder = new TextEncoder()
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('{"type":"start","total":1}\n{"type":"page","path":"/","status":200,"completed":1,"total":1}\n{"type":"done","total":1,"warmed":1,"failed":[]}\n'))
          controller.close()
        },
      })
      const mockGlobalFetch = vi.fn().mockResolvedValue(stream)
      vi.stubGlobal('$fetch', mockGlobalFetch)
      const onProgress = vi.fn()

      try {
        await expect(siteConfig.warmPageCache(onProgress)).resolves.toEqual({ total: 1, warmed: 1, failed: [] })
      }
      finally {
        vi.unstubAllGlobals()
      }

      expect(mockGlobalFetch).toHaveBeenCalledWith('/_cwa/page-cache/warm', { method: 'POST', responseType: 'stream' })
      expect(onProgress).toHaveBeenLastCalledWith({ completed: 1, total: 1 })
      expect(mockFetch).not.toHaveBeenCalled()
      expect(warmModule.loads).toBe(1)
    })
  })

  describe('purgePageCache', () => {
    test('POSTs to the rendered HTML purge operation', async () => {
      const { siteConfig, mockFetch, mockGetRequestOptions } = buildSiteConfig()
      await siteConfig.purgePageCache()
      expect(mockGetRequestOptions).toHaveBeenCalledWith('POST')
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith('/_/rendered_html/purge', { method: 'POST', headers: {} })
      expect(mockFetch.mock.calls[0]![1]).not.toHaveProperty('body')
    })

    test('rejects with the fetch error', async () => {
      const { siteConfig, mockFetch } = buildSiteConfig()
      const error = Object.assign(new Error('Forbidden'), { statusCode: 403 })
      mockFetch.mockRejectedValueOnce(error)
      await expect(siteConfig.purgePageCache()).rejects.toBe(error)
    })
  })

  describe('purgeHttpCache', () => {
    test('POSTs to the HTTP cache purge operation', async () => {
      const { siteConfig, mockFetch, mockGetRequestOptions } = buildSiteConfig()
      await siteConfig.purgeHttpCache()
      expect(mockGetRequestOptions).toHaveBeenCalledWith('POST')
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith('/_/http_cache/purge', { method: 'POST', headers: {}, body: undefined })
    })

    test('rejects with the fetch error', async () => {
      const { siteConfig, mockFetch } = buildSiteConfig()
      const error = Object.assign(new Error('Not Implemented'), { statusCode: 501 })
      mockFetch.mockRejectedValueOnce(error)
      await expect(siteConfig.purgeHttpCache()).rejects.toBe(error)
    })
  })

  describe('purgeHttpCache with a body (#484)', () => {
    test('POSTs the paths and tags to the HTTP cache purge operation', async () => {
      const { siteConfig, mockFetch } = buildSiteConfig()
      await siteConfig.purgeHttpCache({ paths: ['/about'], tags: ['/_/routes//about', 'manifest:/_/pages/about'] })
      expect(mockFetch).toHaveBeenCalledWith('/_/http_cache/purge', {
        method: 'POST',
        headers: {},
        body: { paths: ['/about'], tags: ['/_/routes//about', 'manifest:/_/pages/about'] },
      })
    })
  })
})
