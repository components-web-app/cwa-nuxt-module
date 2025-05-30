import { $fetch, type $Fetch } from 'ofetch'
import type { RequestHeaders } from 'h3'
import { useRequestHeaders } from '#imports'

interface RequestOptions {
  headers: Partial<RequestHeaders>
  method: 'POST' | 'PATCH' | 'DELETE'
}

// todo: this is just a utils export of 'fetch' we shouldn't be using a class for this.
export default class CwaFetch {
  public readonly fetch: $Fetch

  constructor(baseURL: string) {
    this.fetch = $fetch.create({
      baseURL,
      headers: {
        accept: 'application/ld+json,application/json',
      },
      credentials: 'include',
      onRequest(ctx) {
        if (import.meta.server) {
          const { cookie } = useRequestHeaders(['cookie'])
          cookie && ctx.options.headers.append('cookie', cookie)
        }
      },
    })
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
