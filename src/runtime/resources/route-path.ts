export const ROUTE_PATH_QUERY_OR_HASH = 'A path can\'t contain ? or #. They start a query or a page anchor.'

export function normaliseRoutePath(text: string) {
  return text.trim().replace(/\s+/g, '-')
}

export function routePathProblem(path: string) {
  return /[?#]/.test(path) ? ROUTE_PATH_QUERY_OR_HASH : undefined
}
