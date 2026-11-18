import type { CwaResource } from '../../../src/runtime/resources/resource-utils'
import type { FakeSaveServer } from './fake-save-server'

interface FetchOptions {
  method?: string
  body?: unknown
}

type FetchLike = ((request: string, options?: FetchOptions) => Promise<unknown>) & {
  raw: (request: string, options?: FetchOptions) => Promise<unknown>
}

export interface PracticeTransportOptions {
  server: FakeSaveServer
  current: (iri: string) => CwaResource | undefined
  usage: (iri: string) => { total: number, positionCount: number, pageDataCount: number }
}

const NO_API = { message: 'The kit has no API.' }

function bodyOf(body: unknown): Record<string, unknown> {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body)
    }
    catch {
      return {}
    }
  }
  return body && typeof body === 'object' && !(body instanceof FormData) ? body as Record<string, unknown> : {}
}

export function practiceFetch(real: FetchLike, { server, current, usage }: PracticeTransportOptions): FetchLike {
  let created = 0
  const fetch = async (request: string, options: FetchOptions = {}) => {
    const method = (options.method ?? 'GET').toUpperCase()
    const iri = String(request).split('?')[0]!
    const body = bodyOf(options.body)
    if (iri.endsWith('/_/realtime')) {
      return {}
    }
    if (method === 'GET') {
      throw NO_API
    }
    await server.save(body)
    if (method === 'DELETE') {
      return undefined
    }
    if (method === 'POST') {
      created++
      return { '@type': 'Component', ...body, '@id': `${iri}/kit-${created}`, '_metadata': { persisted: true } }
    }
    return { ...current(iri), ...body }
  }
  return Object.assign(fetch, {
    raw: async (request: string, options?: FetchOptions) => {
      const path = String(request).split('?')[0]!
      if (path.endsWith('/usage')) {
        return { _data: usage(path.slice(0, -'/usage'.length)), headers: new Headers(), status: 200 }
      }
      if ((options?.method ?? 'GET').toUpperCase() === 'GET') {
        throw NO_API
      }
      return { _data: await fetch(request, options), headers: new Headers(), status: 200 }
    },
  }, Object.fromEntries(Object.entries(real).filter(([key]) => key !== 'raw')))
}
