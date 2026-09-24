import { normaliseApiPathPrefix } from '#cwa/resources/resource-utils'
import { RENDERED_HTML_SURROGATE_KEY, SURROGATE_KEY_SEPARATOR } from './http-cache'

const ROUTE_COLLECTION_IRI = '/_/routes'

export const SITEMAP_CACHE_DEFAULTS = {
  sharedMaxAge: 600,
  staleWhileRevalidate: 0,
}

export interface SitemapCacheOptions {
  sharedMaxAge: number
  staleWhileRevalidate: number
}

export interface SitemapCacheDecision {
  surrogateKey: string
  cacheControl: string
}

export function resolveSitemapCacheOptions(options?: Partial<SitemapCacheOptions>): SitemapCacheOptions {
  return {
    sharedMaxAge: options?.sharedMaxAge ?? SITEMAP_CACHE_DEFAULTS.sharedMaxAge,
    staleWhileRevalidate: options?.staleWhileRevalidate ?? SITEMAP_CACHE_DEFAULTS.staleWhileRevalidate,
  }
}

function buildCacheControl(options: SitemapCacheOptions): string {
  const directives = ['public', 'max-age=0', `s-maxage=${options.sharedMaxAge}`]
  if (options.staleWhileRevalidate > 0) {
    directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`)
  }
  return directives.join(', ')
}

function routeCollectionIri(apiUrl?: string): string {
  const prefix = apiUrl ? normaliseApiPathPrefix(new URL(apiUrl, 'http://cwa.invalid').pathname) : undefined
  return `${prefix || ''}${ROUTE_COLLECTION_IRI}`
}

export function buildSitemapCacheHeaders({ apiUrl, options }: { apiUrl?: string, options: SitemapCacheOptions }): SitemapCacheDecision {
  return {
    surrogateKey: [RENDERED_HTML_SURROGATE_KEY, routeCollectionIri(apiUrl)].join(SURROGATE_KEY_SEPARATOR),
    cacheControl: buildCacheControl(options),
  }
}

export function buildCustomSitemapCacheHeaders({ options }: { options: SitemapCacheOptions }): SitemapCacheDecision {
  return {
    surrogateKey: RENDERED_HTML_SURROGATE_KEY,
    cacheControl: buildCacheControl(options),
  }
}
