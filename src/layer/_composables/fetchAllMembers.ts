import { mergeQueryIntoPath } from '#cwa/api/fetcher/query-utils'
import type { CwaResource } from '#cwa/resources/resource-utils'
import type Cwa from '#cwa/cwa'
import type { CwaFetchResponse } from '#cwa/api/fetcher/fetcher'

export async function fetchAllMembers<T = CwaResource>($cwa: Pick<Cwa, 'fetch'>, path: string): Promise<T[]> {
  const members: T[] = []
  let next: string | undefined = mergeQueryIntoPath(path, { perPage: 100 })
  while (next) {
    const response: CwaFetchResponse = await $cwa.fetch({ path: next, noQuery: true }).response
    const data = response._data as { member?: T[], view?: { next?: string } } | undefined
    members.push(...(data?.member ?? []))
    next = data?.view?.next
  }
  return members
}
