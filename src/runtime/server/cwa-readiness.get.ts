import { defineEventHandler, setResponseHeaders, setResponseStatus } from 'h3'
import { consola } from 'consola'
import useFetcher from './useFetcher'
import { useReadinessSettings } from './readiness-config'
import { classifyReadiness } from './readiness'
import type { ReadinessProbe } from './readiness'

export default defineEventHandler(async (event) => {
  const { path, timeout, url } = useReadinessSettings()
  const { fetcher } = useFetcher()

  let probe: ReadinessProbe
  try {
    const response = await fetcher.raw(path, {
      timeout,
      credentials: 'omit',
      ignoreResponseError: true,
      redirect: 'manual',
      headers: { 'cache-control': 'no-cache' },
    })
    probe = { status: response.status, location: response.headers.get('location') ?? undefined }
  }
  catch (error) {
    const thrown = error as { name?: string, code?: string, cause?: { name?: string, code?: string } }
    const names = [thrown?.name, thrown?.cause?.name]
    probe = {
      error: {
        timeout: names.includes('TimeoutError') || names.includes('AbortError'),
        code: thrown?.code || thrown?.cause?.code,
      },
    }
  }

  const { ready, reason } = classifyReadiness(url, probe)
  if (reason) {
    ready ? consola.warn(`[CWA] ${reason}`) : consola.error(`[CWA] not ready: ${reason}`)
  }

  setResponseHeaders(event, {
    'cache-control': 'no-store',
    'x-robots-tag': 'noindex, nofollow',
  })
  if (!ready) {
    setResponseStatus(event, 503)
    return { status: 'UNAVAILABLE' }
  }
  return { status: 'OK' }
})
