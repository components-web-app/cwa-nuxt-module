import { afterEach, describe, expect, test } from 'vitest'
import { CwaResourceTypes, ResourceTypeFromIri, getResourceTypeFromIri } from '#cwa/resources/resource-utils'
import { RENDERED_HTML_SURROGATE_KEY, SURROGATE_KEY_SEPARATOR } from './http-cache'
import {
  buildCustomSitemapCacheHeaders,
  buildSitemapCacheHeaders,
  resolveSitemapCacheOptions,
} from './sitemap-cache'

afterEach(() => {
  ResourceTypeFromIri.setPathPrefix(undefined)
})

describe('resolveSitemapCacheOptions', () => {
  test('an unconfigured app shares the sitemap for ten minutes and never serves it stale', () => {
    expect(resolveSitemapCacheOptions()).toEqual({ sharedMaxAge: 600, staleWhileRevalidate: 0 })
  })

  test('a configured value is kept and an omitted one falls back', () => {
    expect(resolveSitemapCacheOptions({ sharedMaxAge: 60 })).toEqual({ sharedMaxAge: 60, staleWhileRevalidate: 0 })
    expect(resolveSitemapCacheOptions({ staleWhileRevalidate: 120 })).toEqual({ sharedMaxAge: 600, staleWhileRevalidate: 120 })
  })
})

describe('buildSitemapCacheHeaders', () => {
  const options = resolveSitemapCacheOptions()

  test('an API under a path prefix is tagged with the prefixed route collection', () => {
    expect(buildSitemapCacheHeaders({ apiUrl: 'https://example.com/_api', options })).toEqual({
      surrogateKey: 'cwa-html, /_api/_/routes',
      cacheControl: 'public, max-age=0, s-maxage=600',
    })
  })

  test('an API at a bare host is tagged with the unprefixed route collection', () => {
    expect(buildSitemapCacheHeaders({ apiUrl: 'https://api.example.com', options }).surrogateKey)
      .toEqual('cwa-html, /_/routes')
  })

  test('a trailing slash on the API URL does not reach the tag', () => {
    expect(buildSitemapCacheHeaders({ apiUrl: 'https://example.com/_api/', options }).surrogateKey)
      .toEqual('cwa-html, /_api/_/routes')
    expect(buildSitemapCacheHeaders({ apiUrl: 'https://api.example.com/', options }).surrogateKey)
      .toEqual('cwa-html, /_/routes')
  })

  test('an unset API URL still tags the rendered HTML key', () => {
    expect(buildSitemapCacheHeaders({ apiUrl: '', options }).surrogateKey)
      .toEqual('cwa-html, /_/routes')
  })

  test('the browser is told never to keep it, because a browser cache cannot be purged', () => {
    expect(buildSitemapCacheHeaders({ apiUrl: 'https://example.com/_api', options: { sharedMaxAge: 900, staleWhileRevalidate: 0 } }).cacheControl)
      .toEqual('public, max-age=0, s-maxage=900')
  })

  test('stale-while-revalidate is emitted only when it is configured above zero', () => {
    expect(buildSitemapCacheHeaders({ apiUrl: 'https://example.com/_api', options: { sharedMaxAge: 600, staleWhileRevalidate: 3600 } }).cacheControl)
      .toEqual('public, max-age=0, s-maxage=600, stale-while-revalidate=3600')
  })

  test('a shared age of zero is stated as s-maxage=0 rather than leaving the header off', () => {
    expect(buildSitemapCacheHeaders({ apiUrl: 'https://example.com/_api', options: { sharedMaxAge: 0, staleWhileRevalidate: 0 } }).cacheControl)
      .toEqual('public, max-age=0, s-maxage=0')
  })

  test('the collection token is one the surrogate-key filter reads as a Route, under a prefix', () => {
    ResourceTypeFromIri.setPathPrefix('/_api')
    const [renderedHtmlKey, token] = buildSitemapCacheHeaders({ apiUrl: 'https://example.com/_api', options }).surrogateKey.split(SURROGATE_KEY_SEPARATOR)

    expect(renderedHtmlKey).toEqual(RENDERED_HTML_SURROGATE_KEY)
    expect(getResourceTypeFromIri(token)).toEqual(CwaResourceTypes.ROUTE)
  })

  test('the collection token is one the surrogate-key filter reads as a Route, at a bare host', () => {
    ResourceTypeFromIri.setPathPrefix('/')
    const [, token] = buildSitemapCacheHeaders({ apiUrl: 'https://api.example.com', options }).surrogateKey.split(SURROGATE_KEY_SEPARATOR)

    expect(getResourceTypeFromIri(token)).toEqual(CwaResourceTypes.ROUTE)
  })
})

describe('buildCustomSitemapCacheHeaders', () => {
  test('a sitemap built only from site config carries no route collection tag', () => {
    expect(buildCustomSitemapCacheHeaders({ options: resolveSitemapCacheOptions() })).toEqual({
      surrogateKey: 'cwa-html',
      cacheControl: 'public, max-age=0, s-maxage=600',
    })
  })

  test('stale-while-revalidate is emitted only when it is configured above zero', () => {
    expect(buildCustomSitemapCacheHeaders({ options: { sharedMaxAge: 600, staleWhileRevalidate: 60 } }).cacheControl)
      .toEqual('public, max-age=0, s-maxage=600, stale-while-revalidate=60')
  })
})
