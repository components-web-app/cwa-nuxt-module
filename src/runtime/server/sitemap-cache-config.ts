import { useRuntimeConfig } from '#imports'
import { resolveSitemapCacheOptions } from '#cwa/api/sitemap-cache'
import type { SitemapCacheOptions } from '#cwa/api/sitemap-cache'
import type { ApiUrlRuntimeConfig } from '#cwa/api/api-url'
import { resolveApiUrl } from '#cwa/api/api-url'
// @ts-expect-error this is a file built in the module
import { options } from '#cwa/server-options.ts'

export function useSitemapCacheSettings(): { apiUrl: string, options: SitemapCacheOptions } {
  const { url } = resolveApiUrl(useRuntimeConfig() as ApiUrlRuntimeConfig, true)
  return {
    apiUrl: url,
    options: resolveSitemapCacheOptions(options.sitemapCache),
  }
}
