import { createError, defineEventHandler, getRequestHeader, getRequestHost, setResponseHeaders } from 'h3'
import type { H3Event } from 'h3'
import useFetcher from './useFetcher'
import { fetchCwaPagePaths } from './cwa-page-paths'
import { usePageCacheWarmSettings } from './page-cache-warm-config'
import { requestPage, warmPages } from './page-cache-warm'

const ROUTE_LIST_TIMEOUT = 30000
const ADMIN_ROLES = ['ROLE_ADMIN', 'ROLE_SUPER_ADMIN']
const FORWARDED_HEADERS = ['accept', 'accept-encoding']

let warming = false

async function isAdmin(cookie: string | undefined, timeout: number) {
  if (!cookie) {
    return false
  }
  const { fetcher } = useFetcher()
  try {
    const user = await fetcher<{ roles?: unknown }>('/me', { headers: { cookie }, timeout })
    return Array.isArray(user?.roles) && user.roles.some(role => ADMIN_ROLES.includes(role))
  }
  catch {
    return false
  }
}

function forwardedHeaders(event: H3Event) {
  const headers: Record<string, string> = {}
  for (const name of FORWARDED_HEADERS) {
    const value = getRequestHeader(event, name)
    if (value) {
      headers[name] = value
    }
  }
  return headers
}

export default defineEventHandler(async (event) => {
  const settings = usePageCacheWarmSettings()

  if (!(await isAdmin(getRequestHeader(event, 'cookie'), ROUTE_LIST_TIMEOUT))) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  if (warming) {
    throw createError({ statusCode: 409, statusMessage: 'The page cache is already being warmed' })
  }
  warming = true

  let paths: string[]
  try {
    paths = await fetchCwaPagePaths({ timeout: ROUTE_LIST_TIMEOUT })
  }
  catch {
    warming = false
    throw createError({ statusCode: 502, statusMessage: 'The page list could not be loaded' })
  }

  const host = getRequestHost(event, { xForwardedHost: true })
  const headers = forwardedHeaders(event)
  const controller = new AbortController()
  const { signal } = controller
  event.node.res.on('close', () => controller.abort())

  setResponseHeaders(event, {
    'content-type': 'application/x-ndjson',
    'x-accel-buffering': 'no',
    'cache-control': 'no-store',
  })

  const encoder = new TextEncoder()
  const total = paths.length

  return new ReadableStream<Uint8Array>({
    start(streamController) {
      const send = (line: object) => {
        if (!signal.aborted) {
          streamController.enqueue(encoder.encode(`${JSON.stringify(line)}\n`))
        }
      }

      const run = async () => {
        send({ type: 'start', total })
        const results = await warmPages({
          paths,
          concurrency: settings.concurrency,
          signal,
          request: path => requestPage({ origin: settings.origin, path, host, headers, timeout: settings.timeout, signal }),
          onResult: (result, completed) => send({ type: 'page', ...result, completed, total }),
        })
        const failed = results.filter(result => result.status !== 200)
        send({ type: 'done', total, warmed: results.length - failed.length, failed })
      }

      run()
        .catch(() => undefined)
        .finally(() => {
          warming = false
          try {
            streamController.close()
          }
          catch {
            return undefined
          }
        })
    },
    cancel() {
      controller.abort()
    },
  })
})
