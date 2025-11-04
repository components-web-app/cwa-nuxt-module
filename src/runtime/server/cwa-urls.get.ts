import { defineSitemapEventHandler } from '#sitemap/server/composables/defineSitemapEventHandler'
import useFetcher, { resolveConfigEventHandler } from './useFetcher'
import type { SitemapUrlInput } from '#sitemap/types'
import type { CwaResource } from '#cwa/resources/resource-utils'

// this route can be used as a source of data for sitemaps to return the cwa routes
export default defineSitemapEventHandler(async (e): Promise<SitemapUrlInput[]> => {
  const resolvedConfig = await resolveConfigEventHandler(e)
  if (!resolvedConfig || !resolvedConfig.sitemapEnabled) {
    return []
  }

  const { fetcher } = useFetcher()
  const data = await fetcher<CwaResource>('/_/routes?pagination=false')
  return data['member'].map((r: CwaResource) => {
    return {
      loc: r.path,
    } as SitemapUrlInput
  })
})
