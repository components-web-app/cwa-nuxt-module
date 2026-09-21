import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ResourceTypeFromIri } from '#cwa/resources/resource-utils'
import {
  RENDERED_HTML_SURROGATE_KEY,
  SURROGATE_KEY_SEPARATOR,
  buildPageCacheHeaders,
  mergeCacheDirectives,
  readResponseCacheDirectives,
  resolvePageCacheOptions,
} from './http-cache'

function headers(values: Record<string, string>) {
  const lower: Record<string, string> = {}
  for (const [key, value] of Object.entries(values)) {
    lower[key.toLowerCase()] = value
  }
  return {
    get: (key: string) => lower[key.toLowerCase()] ?? null,
  }
}

describe('readResponseCacheDirectives', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  test('a public response with s-maxage yields that duration and stays storable', () => {
    expect(readResponseCacheDirectives(headers({ 'cache-control': 'public, s-maxage=3600' })))
      .toEqual({ storable: true, sharedMaxAge: 3600 })
  })

  test('an authenticated render is never cacheable', () => {
    expect(readResponseCacheDirectives(headers({ 'cache-control': 'private, no-store, max-age=0' })).storable)
      .toBe(false)
  })

  test('private without no-store is still not cacheable', () => {
    expect(readResponseCacheDirectives(headers({ 'cache-control': 'private' })).storable).toBe(false)
  })

  test('a quoted directive argument containing private does not disable caching', () => {
    expect(readResponseCacheDirectives(headers({ 'cache-control': 'public, s-maxage=60, no-cache="private"' })).storable)
      .toBe(true)
  })

  test('max-age is used when s-maxage is absent', () => {
    expect(readResponseCacheDirectives(headers({ 'cache-control': 'public, max-age=120' })).sharedMaxAge).toBe(120)
  })

  test('s-maxage wins over max-age', () => {
    expect(readResponseCacheDirectives(headers({ 'cache-control': 'public, s-maxage=60, max-age=600' })).sharedMaxAge)
      .toBe(60)
  })

  test('Expires is converted using the response Date, not the local clock', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-22T09:00:00Z'))

    expect(readResponseCacheDirectives(headers({
      date: 'Sun, 20 Sep 2026 14:13:27 GMT',
      expires: 'Sun, 20 Sep 2026 14:22:42 GMT',
    })).sharedMaxAge).toBe(555)
  })

  test('an Expires already in the past yields zero, not a negative duration', () => {
    expect(readResponseCacheDirectives(headers({
      date: 'Sun, 20 Sep 2026 14:22:42 GMT',
      expires: 'Sun, 20 Sep 2026 14:13:27 GMT',
    })).sharedMaxAge).toBe(0)
  })

  test('Expires without a Date header is ignored', () => {
    expect(readResponseCacheDirectives(headers({ expires: 'Sun, 20 Sep 2026 14:22:42 GMT' })).sharedMaxAge)
      .toBeUndefined()
  })

  test('the lower of s-maxage and the Expires duration wins', () => {
    expect(readResponseCacheDirectives(headers({
      'cache-control': 'public, s-maxage=3600',
      'date': 'Sun, 20 Sep 2026 14:13:27 GMT',
      'expires': 'Sun, 20 Sep 2026 14:22:42 GMT',
    })).sharedMaxAge).toBe(555)
  })

  test('a response with no cache directives contributes no bound', () => {
    expect(readResponseCacheDirectives(headers({}))).toEqual({ storable: true, sharedMaxAge: undefined })
  })

  test('a malformed s-maxage is ignored', () => {
    expect(readResponseCacheDirectives(headers({ 'cache-control': 'public, s-maxage=abc' })).sharedMaxAge)
      .toBeUndefined()
  })
})

describe('mergeCacheDirectives', () => {
  test('one unstorable response makes the whole render unstorable', () => {
    expect(mergeCacheDirectives({ storable: true, sharedMaxAge: 60 }, { storable: false }).storable).toBe(false)
  })

  test('the minimum shared age across responses wins', () => {
    expect(mergeCacheDirectives({ storable: true, sharedMaxAge: 3600 }, { storable: true, sharedMaxAge: 120 }).sharedMaxAge)
      .toBe(120)
  })

  test('an absent bound never raises a lower one', () => {
    expect(mergeCacheDirectives({ storable: true, sharedMaxAge: 120 }, { storable: true }).sharedMaxAge).toBe(120)
  })
})

describe('buildPageCacheHeaders', () => {
  const options = { enabled: true, sharedMaxAge: 300, staleWhileRevalidate: 0 }
  const storable = { storable: true }

  beforeEach(() => {
    ResourceTypeFromIri.setPathPrefix('/_api')
  })

  afterEach(() => {
    ResourceTypeFromIri.setPathPrefix(undefined)
  })

  test('emits the rendered IRIs joined with the SouinPurger separator', () => {
    const decision = buildPageCacheHeaders({
      ids: ['/_api/_/routes//', '/_api/component/titles/abc'],
      api: storable,
      options,
    })

    expect(decision.surrogateKey).toBe('cwa-html, /_api/_/routes//, /_api/component/titles/abc')
  })

  test('tags every cached page with the front end key, so a site-wide change can purge them all', () => {
    const decision = buildPageCacheHeaders({
      ids: ['/_api/component/titles/abc'],
      api: storable,
      options,
    })

    expect(decision.surrogateKey?.split(SURROGATE_KEY_SEPARATOR)).toContain(RENDERED_HTML_SURROGATE_KEY)
    expect(RENDERED_HTML_SURROGATE_KEY).toBe('cwa-html')
  })

  test('never tags a page the module declined to cache', () => {
    expect(buildPageCacheHeaders({ ids: ['/'], api: storable, options }).surrogateKey).toBeUndefined()
    expect(buildPageCacheHeaders({ ids: ['/_api/component/titles/abc'], api: { storable: false }, options }).surrogateKey).toBeUndefined()
  })

  test('filters out ids that are not API resource IRIs', () => {
    const decision = buildPageCacheHeaders({
      ids: ['/', '__new__', '/_api/_/routes//', '/_api/component/titles/abc'],
      api: storable,
      options,
    })

    expect(decision.surrogateKey).toBe('cwa-html, /_api/_/routes//, /_api/component/titles/abc')
    expect(decision.surrogateKey).not.toContain('__new__')
  })

  test('filters correctly when the API has no path prefix', () => {
    ResourceTypeFromIri.setPathPrefix('/')

    const decision = buildPageCacheHeaders({
      ids: ['/', '/_/routes//', '/component/titles/abc'],
      api: storable,
      options,
    })

    expect(decision.surrogateKey).toBe('cwa-html, /_/routes//, /component/titles/abc')
  })

  test('declines when no API IRIs were rendered', () => {
    expect(buildPageCacheHeaders({ ids: ['/'], api: storable, options })).toEqual({})
  })

  test('declines when the API marked any response unstorable', () => {
    expect(buildPageCacheHeaders({
      ids: ['/_api/_/routes//'],
      api: { storable: false },
      options,
    })).toEqual({ unstorable: true })
  })

  test('caps the TTL at the soonest API-supplied bound', () => {
    const decision = buildPageCacheHeaders({
      ids: ['/_api/_/routes//'],
      api: { storable: true, sharedMaxAge: 120 },
      options,
    })

    expect(decision.cacheControl).toContain('s-maxage=120')
  })

  test('keeps the configured TTL when the API bound is higher', () => {
    const decision = buildPageCacheHeaders({
      ids: ['/_api/_/routes//'],
      api: { storable: true, sharedMaxAge: 3600 },
      options,
    })

    expect(decision.cacheControl).toContain('s-maxage=300')
  })

  test('always emits max-age=0', () => {
    const decision = buildPageCacheHeaders({ ids: ['/_api/_/routes//'], api: storable, options })

    expect(decision.cacheControl).toBe('public, max-age=0, s-maxage=300')
  })

  test('a zero shared max age from the API emits no cache headers', () => {
    expect(buildPageCacheHeaders({
      ids: ['/_api/_/routes//'],
      api: { storable: true, sharedMaxAge: 0 },
      options,
    })).toEqual({})
  })

  test('drops stale-while-revalidate when the TTL was bounded by the API', () => {
    const decision = buildPageCacheHeaders({
      ids: ['/_api/_/routes//'],
      api: { storable: true, sharedMaxAge: 120 },
      options: { ...options, staleWhileRevalidate: 60 },
    })

    expect(decision.cacheControl).not.toContain('stale-while-revalidate')
  })

  test('emits stale-while-revalidate when the TTL is the configured default', () => {
    const decision = buildPageCacheHeaders({
      ids: ['/_api/_/routes//'],
      api: storable,
      options: { ...options, staleWhileRevalidate: 60 },
    })

    expect(decision.cacheControl).toBe('public, max-age=0, s-maxage=300, stale-while-revalidate=60')
  })
})

describe('resolvePageCacheOptions', () => {
  test('page caching is opt in and defaults to five minutes with no stale window', () => {
    expect(resolvePageCacheOptions()).toEqual({ enabled: false, sharedMaxAge: 300, staleWhileRevalidate: 0 })
  })

  test('defaults are applied to a partial option object', () => {
    expect(resolvePageCacheOptions({ enabled: true })).toEqual({
      enabled: true,
      sharedMaxAge: 300,
      staleWhileRevalidate: 0,
    })
  })
})
