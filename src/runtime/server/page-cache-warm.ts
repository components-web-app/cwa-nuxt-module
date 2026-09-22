import http from 'node:http'
import https from 'node:https'

export interface WarmPageResult {
  path: string
  status: number
  error?: 'timeout' | 'network'
}

export interface RequestPageOptions {
  origin: string
  path: string
  host: string
  headers: Record<string, string>
  timeout: number
  signal?: AbortSignal
}

export interface WarmPagesOptions {
  paths: string[]
  concurrency: number
  request: (path: string) => Promise<WarmPageResult>
  onResult?: (result: WarmPageResult, completed: number) => void
  signal?: AbortSignal
}

export interface PageCacheWarmConfig {
  concurrency?: number | string
  timeout?: number | string
  origin?: string
}

export interface PageCacheWarmSettings {
  origin: string
  concurrency: number
  timeout: number
}

const DEFAULT_CONCURRENCY = 3
const MAX_CONCURRENCY = 10
const DEFAULT_TIMEOUT = 30000

export function requestPage({ origin, path, host, headers, timeout, signal }: RequestPageOptions): Promise<WarmPageResult> {
  const url = new URL(path, origin)
  const client = url.protocol === 'https:' ? https : http
  const timeoutSignal = AbortSignal.timeout(timeout)
  const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal

  return new Promise((resolve) => {
    let settled = false
    const settle = (result: WarmPageResult) => {
      if (!settled) {
        settled = true
        resolve(result)
      }
    }
    const fail = () => settle({ path, status: 0, error: timeoutSignal.aborted ? 'timeout' : 'network' })

    const request = client.request(url, { method: 'GET', headers: { ...headers, host }, signal: combinedSignal }, (response) => {
      response.on('end', () => settle({ path, status: response.statusCode ?? 0 }))
      response.on('error', fail)
      response.on('close', () => {
        if (!response.complete) {
          fail()
        }
      })
      response.resume()
    })
    request.on('error', fail)
    request.end()
  })
}

export async function warmPages({ paths, concurrency, request, onResult, signal }: WarmPagesOptions): Promise<WarmPageResult[]> {
  const results: WarmPageResult[] = []
  let next = 0
  const worker = async () => {
    while (next < paths.length && !signal?.aborted) {
      const result = await request(paths[next++]!)
      if (signal?.aborted) {
        return
      }
      results.push(result)
      onResult?.(result, results.length)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, paths.length) }, worker))
  return results
}

function positiveInteger(value: number | string | undefined): number | undefined {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : undefined
}

export function resolvePageCacheWarmSettings({ apiUrl, apiUrlBrowser, pageCacheWarm }: { apiUrl?: string, apiUrlBrowser?: string, pageCacheWarm?: PageCacheWarmConfig }): PageCacheWarmSettings {
  return {
    origin: new URL(pageCacheWarm?.origin || apiUrl || apiUrlBrowser || '').origin,
    concurrency: Math.min(positiveInteger(pageCacheWarm?.concurrency) ?? DEFAULT_CONCURRENCY, MAX_CONCURRENCY),
    timeout: positiveInteger(pageCacheWarm?.timeout) ?? DEFAULT_TIMEOUT,
  }
}
