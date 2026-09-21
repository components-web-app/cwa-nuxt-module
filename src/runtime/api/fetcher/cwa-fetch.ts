import { $fetch } from 'ofetch'
import type { $Fetch } from 'ofetch'
import type { RequestHeaders } from 'h3'
import { useProcess } from '../../composables/process'
import type { ApiCacheDirectives } from '../http-cache'
import { mergeCacheDirectives, readResponseCacheDirectives } from '../http-cache'
import { useRequestHeaders } from '#imports'

interface RequestOptions {
  headers: Partial<RequestHeaders>
  method: 'POST' | 'PATCH' | 'DELETE'
}

// todo: this is just a utils export of 'fetch' we shouldn't be using a class for this.
export default class CwaFetch {
  public readonly fetch: $Fetch

  private readonly cacheState: ApiCacheDirectives = { storable: true, sharedMaxAge: undefined }

  constructor(baseURL: string) {
    const { isServer } = useProcess()
    const requestCookie = isServer ? useRequestHeaders(['cookie']).cookie : undefined
    const cacheState = this.cacheState

    this.fetch = $fetch.create({
      baseURL,
      retryDelay: 200,
      headers: {
        accept: 'application/ld+json,application/json',
      },
      credentials: 'include',
      onRequest(ctx) {
        const baseUrlObj = new URL(baseURL)
        const prefix = baseUrlObj.pathname

        const checkRequestForPrefix = (reqPath: string) => {
          if (reqPath.startsWith(prefix)) {
            ctx.options.baseURL = baseUrlObj.origin
          }
        }

        if (typeof ctx.request === 'string') {
          checkRequestForPrefix(ctx.request)
        }
        else {
          checkRequestForPrefix(ctx.request.url)
        }

        requestCookie && ctx.options.headers.append('cookie', requestCookie)
      },
      onResponse(ctx) {
        if (!isServer) {
          return
        }
        const merged = mergeCacheDirectives(cacheState, readResponseCacheDirectives(ctx.response.headers))
        cacheState.storable = merged.storable
        cacheState.sharedMaxAge = merged.sharedMaxAge
      },
    })
  }

  public get httpCacheState(): ApiCacheDirectives {
    return { ...this.cacheState }
  }

  public getRequestOptions(method: 'POST' | 'PATCH' | 'DELETE'): RequestOptions {
    const headers: {
      'accept': string
      'path'?: string
      'content-type'?: string
    } = {
      accept: 'application/ld+json,application/json',
    }
    headers['content-type'] = method === 'PATCH' ? 'application/merge-patch+json' : 'application/ld+json'
    return {
      method,
      headers,
    }
  }
}
