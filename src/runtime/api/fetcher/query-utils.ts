type QueryValue = string | number | null | undefined
export type MergeableQuery = Record<string, QueryValue | QueryValue[]>

export function mergeQueryIntoPath(path: string, query?: MergeableQuery): string {
  if (!query || !Object.keys(query).length) {
    return path
  }

  const queryStart = path.indexOf('?')
  const pathname = queryStart === -1 ? path : path.slice(0, queryStart)
  const params = new URLSearchParams(queryStart === -1 ? '' : path.slice(queryStart + 1))
  const ownKeys = new Set(params.keys())
  for (const [key, value] of Object.entries(query)) {
    if (ownKeys.has(key)) {
      continue
    }
    for (const item of Array.isArray(value) ? value : [value]) {
      params.append(key, item === null || item === undefined ? '' : String(item))
    }
  }
  const queryString = params.toString()
  return queryString ? `${pathname}?${queryString}` : pathname
}
