// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest'
import { defaultSiteConfig, useCwaSiteConfig } from '#cwa/composables/useCwaSiteConfig'

describe('useCwaSiteConfig', () => {
  describe('processApiConfigValue', () => {
    const { processApiConfigValue } = useCwaSiteConfig()

    test.each([
      { input: '0', expected: false },
      { input: '1', expected: true },
      { input: 'false', expected: false },
      { input: 'true', expected: true },
    ])('converts string "$input" to boolean $expected', ({ input, expected }) => {
      expect(processApiConfigValue(input)).toBe(expected)
    })

    test('passes through non-boolean strings', () => {
      expect(processApiConfigValue('hello')).toBe('hello')
    })

    test('passes through numbers', () => {
      expect(processApiConfigValue(42)).toBe(42)
    })

    test('passes through undefined', () => {
      expect(processApiConfigValue(undefined)).toBeUndefined()
    })

    test('passes through null', () => {
      expect(processApiConfigValue(null)).toBeNull()
    })
  })

  describe('mergeConfig', () => {
    const { mergeConfig } = useCwaSiteConfig()

    test('returns defaultSiteConfig when called with no args', () => {
      expect(mergeConfig()).toEqual(defaultSiteConfig)
    })

    test('overrides default values with provided config', () => {
      const result = mergeConfig({ siteName: 'My Site', indexable: false })
      expect(result.siteName).toBe('My Site')
      expect(result.indexable).toBe(false)
      expect(result.sitemapEnabled).toBe(defaultSiteConfig.sitemapEnabled)
    })

    test('filters out empty string values', () => {
      const result = mergeConfig({ siteName: '' })
      expect(result.siteName).toBe(defaultSiteConfig.siteName)
    })

    test('filters out undefined values', () => {
      const result = mergeConfig({ siteName: undefined })
      expect(result.siteName).toBe(defaultSiteConfig.siteName)
    })

    test('merges multiple configs left to right', () => {
      const result = mergeConfig({ siteName: 'First' }, { siteName: 'Second' })
      expect(result.siteName).toBe('Second')
    })

    test('later configs take precedence', () => {
      const result = mergeConfig({ indexable: false }, { indexable: true })
      expect(result.indexable).toBe(true)
    })
  })

  describe('responseToConfig', () => {
    const { responseToConfig } = useCwaSiteConfig()

    test('returns empty object when data has no member array', () => {
      expect(responseToConfig({ '@id': '/config', '@type': 'SiteConfig' })).toEqual({})
    })

    test('returns empty object when member is not an array', () => {
      expect(responseToConfig({ '@id': '/config', '@type': 'SiteConfig', member: 'bad' })).toEqual({})
    })

    test('converts member rows to config merged with defaults', () => {
      const data = {
        '@id': '/config',
        '@type': 'SiteConfig',
        member: [
          { '@id': '/config/1', '@type': 'SiteConfigParam', key: 'siteName', value: 'Test Site' },
          { '@id': '/config/2', '@type': 'SiteConfigParam', key: 'indexable', value: '0' },
        ],
      }
      const result = responseToConfig(data)
      expect(result.siteName).toBe('Test Site')
      expect(result.indexable).toBe(false)
    })

    test('with noMerge=true returns raw parsed values without defaults', () => {
      const data = {
        '@id': '/config',
        '@type': 'SiteConfig',
        member: [
          { '@id': '/config/1', '@type': 'SiteConfigParam', key: 'siteName', value: 'Test Site' },
        ],
      }
      const result = responseToConfig(data, true)
      expect(result).toEqual({ siteName: 'Test Site' })
      expect(result).not.toHaveProperty('indexable')
    })
  })

  describe('resolvedConfigToSiteConfig', () => {
    const { resolvedConfigToSiteConfig } = useCwaSiteConfig()

    test('maps config fields to site config shape', () => {
      const config = { ...defaultSiteConfig, siteName: 'My App', canonicalUrl: 'https://example.com' }
      const result = resolvedConfigToSiteConfig(config)
      expect(result).toEqual({
        name: 'My App',
        indexable: true,
        url: 'https://example.com',
      })
    })

    test('always sets indexable to true', () => {
      const config = { ...defaultSiteConfig, indexable: false }
      const result = resolvedConfigToSiteConfig(config)
      expect(result.indexable).toBe(true)
    })
  })

  describe('defaultSiteConfig', () => {
    test('has expected default values', () => {
      expect(defaultSiteConfig).toMatchObject({
        indexable: true,
        sitemapEnabled: true,
        maintenanceModeEnabled: false,
        fallbackTitle: true,
        concatTitle: true,
        robotsAllowNonSeoCrawlers: true,
        robotsAllowAiBots: true,
        robotsRemoveSitemap: false,
        siteName: 'CWA Web App',
      })
    })
  })
})