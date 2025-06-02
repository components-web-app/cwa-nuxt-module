import type { H3Event } from 'h3'
import useFetcher, { resolveConfigEventHandler } from './useFetcher'
import type { SitemapUrlInput } from '#sitemap/types'
import type { CwaResource } from '#cwa/runtime/resources/resource-utils'
// @ts-ignore-next-line only error in vue-tsc though not resolving correct #imports alias from local tsconfig.json
import { defineSitemapEventHandler } from '#imports'

// this route can be used as a source of data for sitemaps to return the cwa routes
export default defineSitemapEventHandler(async (e: H3Event<Request>): Promise<SitemapUrlInput[]> => {
  const resolvedConfig = await resolveConfigEventHandler(e)
  if (!resolvedConfig || !resolvedConfig.sitemapEnabled) {
    return []
  }

  const { fetcher } = useFetcher()
  const data = await fetcher<CwaResource>('/_/routes')
  return data['hydra:member'].map((r: CwaResource) => {
    return {
      _sitemap: 'cwa',
      loc: r.path,
    } as SitemapUrlInput
  })
})
