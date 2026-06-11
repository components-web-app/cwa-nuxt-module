// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest'
import state from './state'
import actions from './actions'

describe('site-config store actions', () => {
  function setup() {
    const s = state()
    const a = actions(s)
    return { s, a }
  }

  describe('setConfigParameter', () => {
    test('sets a plain string value', () => {
      const { s, a } = setup()
      a.setConfigParameter('siteName', 'My App')
      expect(s.config.value.siteName).toBe('My App')
    })

    test('converts "1" to boolean true', () => {
      const { s, a } = setup()
      a.setConfigParameter('indexable', '1')
      expect(s.config.value.indexable).toBe(true)
    })

    test('converts "false" string — stores processApiValue behavior', () => {
      const { s, a } = setup()
      a.setConfigParameter('sitemapEnabled', 'false')
      // store's processApiValue: Boolean('false') = true (legacy behavior)
      expect(s.config.value.sitemapEnabled).toBe(true)
    })

    test('does not convert "0" — passes through as string', () => {
      const { s, a } = setup()
      a.setConfigParameter('robotsText', '0')
      expect(s.config.value.robotsText).toBe('0')
    })

    test('overwrites an existing value', () => {
      const { s, a } = setup()
      a.setConfigParameter('siteName', 'First')
      a.setConfigParameter('siteName', 'Second')
      expect(s.config.value.siteName).toBe('Second')
    })
  })

  describe('setConfigParameters', () => {
    test('sets multiple parameters at once', () => {
      const { s, a } = setup()
      a.setConfigParameters([
        { key: 'siteName', value: 'Batch Site' },
        { key: 'canonicalUrl', value: 'https://example.com' },
      ])
      expect(s.config.value.siteName).toBe('Batch Site')
      expect(s.config.value.canonicalUrl).toBe('https://example.com')
    })

    test('handles empty array', () => {
      const { s, a } = setup()
      a.setConfigParameters([])
      expect(s.config.value).toEqual({})
    })

    test('processes boolean conversions in batch', () => {
      const { s, a } = setup()
      a.setConfigParameters([
        { key: 'indexable', value: '1' },
        { key: 'maintenanceModeEnabled', value: '1' },
      ])
      expect(s.config.value.indexable).toBe(true)
      expect(s.config.value.maintenanceModeEnabled).toBe(true)
    })
  })
})
