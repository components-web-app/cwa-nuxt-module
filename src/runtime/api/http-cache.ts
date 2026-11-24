import { getResourceTypeFromIri } from '#cwa/resources/resource-utils'
import { NEW_RESOURCE_IRI } from '#cwa/storage/stores/resources/state'

export const SURROGATE_KEY_SEPARATOR = ', '

export const RENDERED_HTML_SURROGATE_KEY = 'cwa-html'

const FALLBACK_SHARED_MAX_AGE = 3600

export interface ApiCacheDirectives {
  storable: boolean
  sharedMaxAge?: number
}

export interface PageCacheOptions {
  enabled: boolean
  sharedMaxAge?: number
  staleWhileRevalidate: number
}

export interface PageCacheDecision {
  surrogateKey?: string
  cacheControl?: string
  unstorable?: true
}

export interface ResponseHeadersLike {
  get: (name: string) => string | null
}

export interface BuildPageCacheHeadersEvent {
  ids: string[]
  dataOf?: (id: string) => unknown
  api: ApiCacheDirectives
  options: PageCacheOptions
}

declare module 'h3' {
  interface H3EventContext {
    cwaPageCache?: PageCacheDecision
  }
}

function parseDirectives(value: string): Map<string, string | undefined> {
  const directives = new Map<string, string | undefined>()
  for (const part of value.split(',')) {
    const trimmed = part.trim()
    if (!trimmed) {
      continue
    }
    const separatorIndex = trimmed.indexOf('=')
    const name = (separatorIndex === -1 ? trimmed : trimmed.slice(0, separatorIndex)).trim().toLowerCase()
    const directiveValue = separatorIndex === -1 ? undefined : trimmed.slice(separatorIndex + 1).trim()
    if (!directives.has(name)) {
      directives.set(name, directiveValue)
    }
  }
  return directives
}

function parseSeconds(value: string | undefined): number | undefined {
  if (value === undefined || value === '') {
    return undefined
  }
  const seconds = Number(value)
  return Number.isInteger(seconds) && seconds >= 0 ? seconds : undefined
}

function lowest(...values: (number | undefined)[]): number | undefined {
  const defined = values.filter((value): value is number => value !== undefined)
  return defined.length ? Math.min(...defined) : undefined
}

function expiresDuration(headers: ResponseHeadersLike): number | undefined {
  const dateHeader = headers.get('date')
  const expiresHeader = headers.get('expires')
  if (!dateHeader || !expiresHeader) {
    return undefined
  }
  const date = Date.parse(dateHeader)
  const expires = Date.parse(expiresHeader)
  if (Number.isNaN(date) || Number.isNaN(expires)) {
    return undefined
  }
  return Math.max(0, Math.floor((expires - date) / 1000))
}

export function readResponseCacheDirectives(headers: ResponseHeadersLike): ApiCacheDirectives {
  const directives = parseDirectives(headers.get('cache-control') || '')
  const storable = !directives.has('no-store') && !directives.has('private')
  const freshness = parseSeconds(directives.get('s-maxage')) ?? parseSeconds(directives.get('max-age'))

  return {
    storable,
    sharedMaxAge: lowest(freshness, expiresDuration(headers)),
  }
}

export function mergeCacheDirectives(a: ApiCacheDirectives, b: ApiCacheDirectives): ApiCacheDirectives {
  return {
    storable: a.storable && b.storable,
    sharedMaxAge: lowest(a.sharedMaxAge, b.sharedMaxAge),
  }
}

function iriOf(value: unknown): string | undefined {
  const iri = value && typeof value === 'object' ? (value as Record<string, unknown>)['@id'] : undefined
  return typeof iri === 'string' && !iri.startsWith('_:') ? iri : undefined
}

function collectEmbeddedIris(value: unknown, into: Set<string>) {
  if (Array.isArray(value)) {
    value.forEach(item => collectEmbeddedIris(item, into))
    return
  }
  if (!value || typeof value !== 'object') {
    return
  }
  const iri = iriOf(value)
  iri && into.add(iri)
  for (const [key, child] of Object.entries(value)) {
    key !== '_metadata' && collectEmbeddedIris(child, into)
  }
}

function pageIris(ids: string[], dataOf?: (id: string) => unknown): string[] {
  const stored = ids.filter(id => id !== NEW_RESOURCE_IRI && (getResourceTypeFromIri(id) !== undefined || iriOf(dataOf?.(id)) === id))
  const iris = new Set(stored)
  stored.forEach(id => collectEmbeddedIris(dataOf?.(id), iris))
  return [...iris]
}

export function buildPageCacheHeaders({ ids, dataOf, api, options }: BuildPageCacheHeadersEvent): PageCacheDecision {
  if (!api.storable) {
    return { unstorable: true }
  }

  const iris = pageIris(ids, dataOf)
  if (!iris.length) {
    return {}
  }

  const sharedMaxAge = lowest(options.sharedMaxAge, api.sharedMaxAge) ?? FALLBACK_SHARED_MAX_AGE
  if (sharedMaxAge <= 0) {
    return {}
  }

  const cacheControl = ['public', 'max-age=0', `s-maxage=${sharedMaxAge}`]
  if (options.staleWhileRevalidate > 0) {
    cacheControl.push(`stale-while-revalidate=${options.staleWhileRevalidate}`)
  }

  return {
    surrogateKey: [RENDERED_HTML_SURROGATE_KEY, ...iris].join(SURROGATE_KEY_SEPARATOR),
    cacheControl: cacheControl.join(', '),
  }
}

export function resolvePageCacheOptions(options?: Partial<PageCacheOptions>): PageCacheOptions {
  return {
    enabled: options?.enabled ?? true,
    sharedMaxAge: options?.sharedMaxAge,
    staleWhileRevalidate: options?.staleWhileRevalidate ?? 0,
  }
}
