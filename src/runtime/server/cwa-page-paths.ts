import useFetcher from './useFetcher'
import type { CwaResource } from '#cwa/resources/resource-utils'

const ROUTES_PATH = '/_/routes?pagination=false'

const isRedirect = (r: CwaResource) => Boolean(r.redirect) || Boolean(r.redirectPath)

const rendersAPage = (r: CwaResource) => Boolean(r.page) || Boolean(r.pageData)

const hasUsablePath = (r: CwaResource) => typeof r.path === 'string' && r.path !== ''

export async function fetchCwaPagePaths(ops?: { timeout?: number }): Promise<string[]> {
  const { fetcher } = useFetcher()
  const data = ops?.timeout ? await fetcher<CwaResource>(ROUTES_PATH, { timeout: ops.timeout }) : await fetcher<CwaResource>(ROUTES_PATH)
  const members: CwaResource[] = data['member']

  const pageFieldsExposed = members.some(rendersAPage)

  return members
    .filter(r => hasUsablePath(r) && !isRedirect(r) && (!pageFieldsExposed || rendersAPage(r)))
    .map(r => r.path as string)
}
