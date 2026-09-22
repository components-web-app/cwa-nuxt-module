import { defineSitemapEventHandler } from '#sitemap/server/composables/defineSitemapEventHandler'
import { resolveConfigEventHandler } from './useFetcher'
import { fetchCwaPagePaths } from './cwa-page-paths'
import type { SitemapUrlInput } from '#sitemap/types'

// this route can be used as a source of data for sitemaps to return the cwa routes
export default defineSitemapEventHandler(async (e): Promise<SitemapUrlInput[]> => {
  const resolvedConfig = await resolveConfigEventHandler(e)
  if (!resolvedConfig || !resolvedConfig.sitemapEnabled) {
    return []
  }

  const paths = await fetchCwaPagePaths()
  return paths.map(loc => ({ loc }) as SitemapUrlInput)
})
