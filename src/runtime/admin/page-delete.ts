import { mergeQueryIntoPath } from '#cwa/api/fetcher/query-utils'
import type { CwaConfirmLine } from '#cwa/composables/cwa-confirm'
import type Cwa from '#cwa/cwa'

export const PAGE_DELETE_CHECK_TIMEOUT = 3000

export interface PageDeleteFacts {
  template: boolean
  templatePages?: number
  addresses?: number
  hasRoute: boolean
  routePath?: string
  nested?: number
}

function plural(count: number, one: string, many: string) {
  return count === 1 ? one : many
}

export function pageDeleteLines(facts: PageDeleteFacts): CwaConfirmLine[] {
  const lines: CwaConfirmLine[] = []
  const pages = facts.templatePages
  if (facts.template && pages === undefined) {
    lines.push({ text: 'Pages built from this template are deleted too, and their addresses stop showing a page.', emphasis: 'strong' })
  }
  else if (facts.template && pages) {
    const built = `${pages} ${plural(pages, 'page', 'pages')} built from this template ${plural(pages, 'is', 'are')} deleted too`
    const addresses = facts.addresses
    if (addresses === undefined) {
      lines.push({ text: `${built}, and their addresses stop showing a page.`, emphasis: 'strong' })
    }
    else if (addresses) {
      lines.push({ text: `${built}. Visitors to their ${addresses} ${plural(addresses, 'address', 'addresses')} get “Page not found”.`, emphasis: 'strong' })
    }
    else {
      lines.push({ text: `${built}.`, emphasis: 'strong' })
    }
  }
  const kept: string[] = []
  if (facts.hasRoute) {
    kept.push(facts.routePath
      ? `The route ${facts.routePath} is kept, and visitors to it get “Page not found”.`
      : 'Its route is kept, and visitors to it get “Page not found”.')
  }
  if (facts.nested) {
    kept.push(facts.nested === 1
      ? 'The page nested under it is kept and loses its parent.'
      : `The ${facts.nested} pages nested under it are kept and lose their parent.`)
  }
  if (kept.length) {
    lines.push({ text: kept.join(' '), emphasis: 'muted' })
  }
  return lines
}

export function pageDeleteConfirmLines(facts: PageDeleteFacts, unsaved: number): CwaConfirmLine[] {
  return [
    ...pageDeleteLines(facts),
    ...(unsaved ? [{ text: `Your ${unsaved} unsaved ${plural(unsaved, 'change is', 'changes are')} discarded too.` }] : []),
    { text: 'This can\'t be undone.' },
  ]
}

type Fetch = Pick<Cwa, 'fetch'>

async function data<T>($cwa: Fetch, path: string): Promise<T | undefined> {
  const response = await $cwa.fetch({ path, noQuery: true }).response
  return response?._data as T | undefined
}

interface Collection<T> {
  member?: T[]
  totalItems?: number
}

async function countAddresses($cwa: Fetch, template: string, pages: number, dataEndpoints: string[]) {
  const lists = await Promise.all(dataEndpoints.map(endpoint => data<Collection<{ '@id': string, 'page'?: string }>>($cwa, mergeQueryIntoPath(endpoint, { perPage: 100 }))))
  const built = lists.flatMap(list => list?.member ?? []).filter(member => member.page === template).map(member => member['@id'])
  if (built.length !== pages) {
    return undefined
  }
  const routes = await data<Collection<unknown>>($cwa, mergeQueryIntoPath('/_/routes', { 'pageData[]': built, 'perPage': 100 }))
  return routes?.totalItems ?? routes?.member?.length
}

async function check($cwa: Fetch, iri: string, dataEndpoints: Promise<string[]>) {
  const page = await data<{ _metadata?: { pageDataCount?: number } }>($cwa, iri)
  const pages = page?._metadata?.pageDataCount
  if (typeof pages !== 'number') {
    return {}
  }
  if (!pages) {
    return { templatePages: 0, addresses: 0 }
  }
  return { templatePages: pages, addresses: await dataEndpoints.then(endpoints => countAddresses($cwa, iri, pages, endpoints)).catch(() => undefined) }
}

export function fetchTemplateCounts($cwa: Fetch, iri: string, dataEndpoints: string[] | Promise<string[]>, timeout = PAGE_DELETE_CHECK_TIMEOUT): Promise<Pick<PageDeleteFacts, 'templatePages' | 'addresses'>> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<Pick<PageDeleteFacts, 'templatePages' | 'addresses'>>((resolve) => {
    timer = setTimeout(() => resolve({}), timeout)
  })
  const endpoints = Promise.resolve(dataEndpoints)
  endpoints.catch(() => undefined)
  return Promise.race([check($cwa, iri, endpoints).catch(() => ({})), late]).finally(() => clearTimeout(timer))
}
