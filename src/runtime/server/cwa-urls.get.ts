import { defineSitemapEventHandler } from '#sitemap/server/composables/defineSitemapEventHandler'
import useFetcher, { resolveConfigEventHandler } from './useFetcher'
import type { SitemapUrlInput } from '#sitemap/types'
import type { CwaResource } from '#cwa/resources/resource-utils'

const isRedirect = (r: CwaResource) => Boolean(r.redirect) || Boolean(r.redirectPath)

const rendersAPage = (r: CwaResource) => Boolean(r.page) || Boolean(r.pageData)

const hasUsablePath = (r: CwaResource) => typeof r.path === 'string' && r.path !== ''

// this route can be used as a source of data for sitemaps to return the cwa routes
export default defineSitemapEventHandler(async (e): Promise<SitemapUrlInput[]> => {
  const resolvedConfig = await resolveConfigEventHandler(e)
  if (!resolvedConfig || !resolvedConfig.sitemapEnabled) {
    return []
  }

  const { fetcher } = useFetcher()
  const data = await fetcher<CwaResource>('/_/routes?pagination=false')
  const members: CwaResource[] = data['member']

  const pageFieldsExposed = members.some(rendersAPage)

  return members
    .filter(r => hasUsablePath(r) && !isRedirect(r) && (!pageFieldsExposed || rendersAPage(r)))
    .map((r: CwaResource) => {
      return {
        loc: r.path,
      } as SitemapUrlInput
    })
})
