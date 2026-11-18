import type { CwaResource } from '../../../src/runtime/resources/resource-utils'
import type { FakeSaveServer, KitRequestError } from './fake-save-server'

interface FetchOptions {
  method?: string
  body?: unknown
}

type FetchLike = ((request: string, options?: FetchOptions) => Promise<unknown>) & {
  raw: (request: string, options?: FetchOptions) => Promise<unknown>
}

export interface PracticePeer {
  clientId: string
  userId: string
}

export interface PracticeTransportOptions {
  server: FakeSaveServer
  current: (iri: string) => CwaResource | undefined
  usage: (iri: string) => { total: number, positionCount: number, pageDataCount: number }
  members?: (collection: string) => CwaResource[]
  peer: PracticePeer
  now?: () => Date
}

const NOT_FOUND = { statusCode: 404, message: 'Not Found', data: {}, response: { status: 404 } }
const COLLECTION = /^(?:\/_)?\/[a-z_]+$/

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

export function practiceFetch(real: FetchLike, { server, current, usage, members = () => [], peer, now = () => new Date() }: PracticeTransportOptions): FetchLike {
  let created = 0

  function theirs(iri: string, error: KitRequestError) {
    const stored = current(iri)
    return {
      ...error,
      data: {
        ...stored,
        ...error.data,
        '@id': iri,
        '_metadata': { ...stored?._metadata, lastWrite: { clientId: peer.clientId, userId: peer.userId, at: now().toISOString() } },
      },
    }
  }

  const fetch = async (request: string, options: FetchOptions = {}) => {
    const method = (options.method ?? 'GET').toUpperCase()
    const iri = String(request).split('?')[0]!
    const body = bodyOf(options.body)
    if (iri.endsWith('/_/realtime')) {
      return {}
    }
    if (method === 'GET') {
      const stored = current(iri)
      if (stored) {
        return JSON.parse(JSON.stringify(stored))
      }
      if (COLLECTION.test(iri)) {
        const found = members(iri)
        return { member: JSON.parse(JSON.stringify(found)), totalItems: found.length }
      }
      throw NOT_FOUND
    }
    try {
      await server.save(body)
    }
    catch (error) {
      throw (error as KitRequestError).statusCode === 412 ? theirs(iri, error as KitRequestError) : error
    }
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
      const data = path.endsWith('/usage') ? usage(path.slice(0, -'/usage'.length)) : await fetch(request, options)
      return { _data: data, headers: new Headers({ 'content-type': 'application/ld+json' }), status: 200 }
    },
  }, Object.fromEntries(Object.entries(real).filter(([key]) => key !== 'raw')))
}
