import useFetcher from './useFetcher'
import type { SitemapUrlInput } from '#sitemap/types'
import type { CwaResource } from '#cwa/runtime/resources/resource-utils'
// @ts-expect-error not resolving correct #imports alias from local tsconfig.json
import { defineSitemapEventHandler } from '#imports'

// this route can be used as a source of data for sitemaps to return the cwa routes
export default defineSitemapEventHandler(async () => {
  const { fetcher } = useFetcher()
  const data = await fetcher<CwaResource>('/_/routes')
  return data['hydra:member'].map((r: CwaResource) => {
    return {
      _sitemap: 'cwa',
      loc: r.path,
    } as SitemapUrlInput
  })
})
