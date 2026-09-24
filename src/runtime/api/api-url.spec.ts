// @vitest-environment node

import { describe, expect, test } from 'vitest'
import type { ApiUrlRuntimeConfig } from './api-url'
import { UNSET_API_URL, resolveApiUrl } from './api-url'

function runtimeConfig(cwa: { apiUrl?: string, apiUrlBrowser?: string } = {}, privateCwa?: { apiUrl?: string }): ApiUrlRuntimeConfig {
  return { public: { cwa }, cwa: privateCwa }
}

describe('resolveApiUrl', () => {
  describe('the fallback when nothing is configured', () => {
    test('is a host that can never be registered or resolved', () => {
      expect(new URL(UNSET_API_URL).hostname.endsWith('.invalid')).toBe(true)
    })

    test('parses as a URL with a root pathname so the resource path prefix stays unset', () => {
      expect(new URL(UNSET_API_URL).pathname).toBe('/')
    })

    test('is returned with an unset source on the server', () => {
      expect(resolveApiUrl(runtimeConfig(), true)).toEqual({ url: UNSET_API_URL, source: 'unset' })
    })

    test('is returned with an unset source on the client', () => {
      expect(resolveApiUrl(runtimeConfig(), false)).toEqual({ url: UNSET_API_URL, source: 'unset' })
    })

    test('is returned when every configured value is an empty string', () => {
      expect(resolveApiUrl(runtimeConfig({ apiUrl: '', apiUrlBrowser: '' }, { apiUrl: '' }), true))
        .toEqual({ url: UNSET_API_URL, source: 'unset' })
    })

    test('is returned when the public config has no cwa key at all', () => {
      expect(resolveApiUrl({ public: {} }, true)).toEqual({ url: UNSET_API_URL, source: 'unset' })
    })
  })

  describe('server precedence', () => {
    test('prefers the private URL over both public keys', () => {
      expect(resolveApiUrl(
        runtimeConfig({ apiUrl: 'https://public/_api', apiUrlBrowser: 'https://browser/_api' }, { apiUrl: 'https://private/_api' }),
        true,
      )).toEqual({ url: 'https://private/_api', source: 'private' })
    })

    test('falls back to the deprecated public URL, reporting where it came from', () => {
      expect(resolveApiUrl(runtimeConfig({ apiUrl: 'https://public/_api', apiUrlBrowser: 'https://browser/_api' }), true))
        .toEqual({ url: 'https://public/_api', source: 'public' })
    })

    test('falls back to the browser URL when it is the only one set', () => {
      expect(resolveApiUrl(runtimeConfig({ apiUrlBrowser: 'https://browser/_api' }), true))
        .toEqual({ url: 'https://browser/_api', source: 'browser' })
    })
  })

  describe('client precedence', () => {
    test('prefers the browser URL', () => {
      expect(resolveApiUrl(runtimeConfig({ apiUrl: 'https://public/_api', apiUrlBrowser: 'https://browser/_api' }), false))
        .toEqual({ url: 'https://browser/_api', source: 'browser' })
    })

    test('falls back to the deprecated public URL', () => {
      expect(resolveApiUrl(runtimeConfig({ apiUrl: 'https://public/_api' }), false))
        .toEqual({ url: 'https://public/_api', source: 'public' })
    })

    test('never touches the private key, which the client config proxy reports as unknown', () => {
      const config = { public: { cwa: {} } }
      let privateReads = 0
      Object.defineProperty(config, 'cwa', {
        get() {
          privateReads++
          return { apiUrl: 'https://private/_api' }
        },
      })

      expect(resolveApiUrl(config as ApiUrlRuntimeConfig, false)).toEqual({ url: UNSET_API_URL, source: 'unset' })
      expect(privateReads).toBe(0)
    })
  })
})
