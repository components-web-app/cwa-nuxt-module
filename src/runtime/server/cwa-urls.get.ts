import { defineSitemapEventHandler } from '#sitemap/server/composables/defineSitemapEventHandler'
import useFetcher, { resolveConfigEventHandler } from './useFetcher'
import type { SitemapUrlInput } from '#sitemap/types'
import type { CwaResource } from '#cwa/resources/resource-utils'

// A route is only ever EXCLUDED on positive evidence - a missing URL in a sitemap is worse than
// an extra one, so anything we cannot judge from the collection serialisation is included.

// `redirect` is the Route's redirect target IRI; `redirectPath` is added by the API's
// RouteNormalizer. Either one present proves this route 308s elsewhere and is not a page.
// It must be checked before page/pageData: the normalizer copies the FINAL route's page and
// pageData onto a redirect route when serialising, so a redirect can carry a populated `page`.
const isRedirect = (r: CwaResource) => Boolean(r.redirect) || Boolean(r.redirectPath)

// A route with neither a page nor page data renders nothing.
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

  // Only judge "renders nothing" when this collection demonstrably exposes page/pageData.
  // Null values are omitted from the API response, so an absent key is indistinguishable from a
  // shallower serialisation - if no member has either field we must not empty the sitemap.
  const pageFieldsExposed = members.some(rendersAPage)

  return members
    .filter(r => hasUsablePath(r) && !isRedirect(r) && (!pageFieldsExposed || rendersAPage(r)))
    .map((r: CwaResource) => {
      return {
        loc: r.path,
      } as SitemapUrlInput
    })
})
