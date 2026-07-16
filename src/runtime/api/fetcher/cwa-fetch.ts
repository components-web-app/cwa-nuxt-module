import { $fetch } from 'ofetch'
import type { $Fetch } from 'ofetch'
import type { RequestHeaders } from 'h3'
import { useProcess } from '../../composables/process'
import { useRequestHeaders } from '#imports'

interface RequestOptions {
  headers: Partial<RequestHeaders>
  method: 'POST' | 'PATCH' | 'DELETE'
}

// todo: this is just a utils export of 'fetch' we shouldn't be using a class for this.
export default class CwaFetch {
  public readonly fetch: $Fetch

  constructor(baseURL: string) {
    // Capture the incoming request's cookie NOW, while the plugin still has a live Nuxt context.
    //
    // `useRequestHeaders` resolves the Nuxt instance via `useNuxtApp()`, which THROWS `[nuxt]
    // instance unavailable` rather than degrading. Nuxt's `asyncContext` defaults to false, so unctx
    // holds that instance in a plain module variable and clears it as soon as a callback suspends —
    // and its `__restore()` hook only applies to code rewritten by `unctx/transform` (a closed list:
    // `defineNuxtPlugin`, `defineNuxtRouteMiddleware`, ...). `fetcher.ts` is an untransformed plain
    // class, so every `await` in it destroys the context for everything downstream. Reading the
    // cookie inside `onRequest` therefore worked only for the primary fetch (which reaches the
    // interceptor synchronously) and threw for every nested/batch resource, silently downgrading
    // authenticated SSR requests to anonymous. ofetch's retry path loses the context too, since it
    // re-enters `onRequest` after a `setTimeout`.
    //
    // SAFETY: exactly one CwaFetch exists per Cwa, per plugin invocation — i.e. per SSR request —
    // so this cookie can never leak into another user's request. It MUST stay in this closure and
    // must never be hoisted to module scope or onto shared state. The only cookie mutations are
    // sign-in/sign-out, which are client-side actions, so it cannot go stale mid-render. This adds
    // no new constraint: the constructor already requires Nuxt context for `useRuntimeConfig()` and
    // `useCookie()`. See #263.
    const { isServer } = useProcess()
    const requestCookie = isServer ? useRequestHeaders(['cookie']).cookie : undefined

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

        // captured at construction — needs no Nuxt context, so this stays synchronous and works
        // for nested/batch resources and retries alike
        requestCookie && ctx.options.headers.append('cookie', requestCookie)
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
