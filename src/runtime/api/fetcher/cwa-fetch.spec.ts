// @vitest-environment nuxt

import { beforeEach, describe, expect, test, vi } from 'vitest'
import { $fetch } from 'ofetch'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import * as processComposables from '#cwa/composables/process'
import CwaFetch from './cwa-fetch'

vi.mock('ofetch')

// `vi.mock('#imports')` does not intercept here — use mockNuxtImport (see CLAUDE.md)
const mockUseRequestHeaders = vi.hoisted(() => vi.fn(() => ({}) as Record<string, string | undefined>))
mockNuxtImport('useRequestHeaders', () => mockUseRequestHeaders)

describe('Create a fetch instances with defaults', () => {
  test('Correct defaults are set on fetch', () => {
    // @ts-expect-error
    vi.spyOn($fetch, 'create').mockImplementation(() => {
      return 'mockedFetchCreateInstance'
    })
    const cwaFetch = new CwaFetch('https://my-api')
    expect($fetch.create).toBeCalledWith(
      expect.objectContaining({
        baseURL: 'https://my-api',
        headers: {
          accept: 'application/ld+json,application/json',
        },
        credentials: 'include',
      }))
    expect(cwaFetch.fetch).toBe('mockedFetchCreateInstance')
  })
})

describe('CwaFetch -> getRequestOptions', () => {
  // @ts-expect-error mocked
  vi.spyOn($fetch, 'create').mockReturnValue(vi.fn())

  test.each([
    { method: 'POST' as const, expectedContentType: 'application/ld+json' },
    { method: 'DELETE' as const, expectedContentType: 'application/ld+json' },
    { method: 'PATCH' as const, expectedContentType: 'application/merge-patch+json' },
  ])('$method returns correct headers', ({ method, expectedContentType }) => {
    const cwaFetch = new CwaFetch('https://my-api')
    const opts = cwaFetch.getRequestOptions(method)
    expect(opts.method).toBe(method)
    expect(opts.headers['accept']).toBe('application/ld+json,application/json')
    expect(opts.headers['content-type']).toBe(expectedContentType)
  })
})

/**
 * Server-side cookie forwarding must not depend on the Nuxt async context being alive when ofetch
 * runs `onRequest`.
 *
 * `useRequestHeaders` -> `useRequestEvent` -> `useNuxtApp()`, which THROWS `[nuxt] instance
 * unavailable` (it does not use `tryUseNuxtApp`). Nuxt's `asyncContext` defaults to false, so unctx
 * keeps the instance in a plain module variable and clears it the moment a callback suspends
 * (`unctx` `callAsync`: `currentInstance = void 0`). unctx's `__restore()` only works in code
 * rewritten by `unctx/transform`, which Nuxt applies to a closed list (`defineNuxtPlugin`,
 * `defineNuxtRouteMiddleware`, ...) — `fetcher.ts` is an untransformed plain class, so every `await`
 * in it destroys the context for everything downstream. The primary resource fetch reaches
 * `onRequest` synchronously and works; every nested/batch resource after `await result.response`
 * did not. ofetch's retry path (`await new Promise(setTimeout)` then re-enter) loses it too.
 *
 * So the cookie is captured EAGERLY in the constructor, which the plugin runs inside a live Nuxt
 * context. Safe because exactly one CwaFetch exists per Cwa per plugin invocation — i.e. per SSR
 * request — so it can never leak across requests. See #263.
 */
describe('CwaFetch -> server-side cookie forwarding', () => {
  // ofetch normalises `ctx.options.headers` to a Headers instance before calling onRequest, so a
  // real Headers here is faithful to runtime.
  const createRequestCtx = () => ({
    request: '/_/routes//',
    options: { headers: new Headers() },
  })

  function captureOnRequest() {
    // @ts-expect-error mocked
    const createSpy = vi.spyOn($fetch, 'create').mockReturnValue(vi.fn())
    void new CwaFetch('https://my-api')
    return createSpy.mock.calls[0][0].onRequest
  }

  function contextIsLost() {
    mockUseRequestHeaders.mockImplementation(() => {
      throw new Error('[nuxt] instance unavailable')
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('captures the request cookie at construction and still forwards it once the Nuxt context is gone', () => {
    vi.spyOn(processComposables, 'useProcess').mockReturnValue({ isClient: false, isServer: true })
    mockUseRequestHeaders.mockReturnValue({ cookie: 'api_component=jwt; cwa_auth=1' })

    const onRequest = captureOnRequest()

    // read eagerly, inside the plugin's live Nuxt context
    expect(mockUseRequestHeaders).toHaveBeenCalledWith(['cookie'])
    expect(mockUseRequestHeaders).toHaveBeenCalledTimes(1)

    contextIsLost()

    const ctx = createRequestCtx()
    expect(() => onRequest(ctx)).not.toThrow()
    expect(ctx.options.headers.get('cookie')).toBe('api_component=jwt; cwa_auth=1')
    // never re-read per request — the point of the fix
    expect(mockUseRequestHeaders).toHaveBeenCalledTimes(1)
  })

  test('forwards the captured cookie on every request from the same instance, including ofetch retries', () => {
    vi.spyOn(processComposables, 'useProcess').mockReturnValue({ isClient: false, isServer: true })
    mockUseRequestHeaders.mockReturnValue({ cookie: 'api_component=jwt' })

    const onRequest = captureOnRequest()
    contextIsLost()

    // a retry re-enters onRequest across a setTimeout, so it can never have Nuxt context
    for (const _attempt of [1, 2]) {
      const ctx = createRequestCtx()
      onRequest(ctx)
      expect(ctx.options.headers.get('cookie')).toBe('api_component=jwt')
    }
  })

  test('does not read or forward request headers on the client', () => {
    vi.spyOn(processComposables, 'useProcess').mockReturnValue({ isClient: true, isServer: false })

    const onRequest = captureOnRequest()
    expect(mockUseRequestHeaders).not.toHaveBeenCalled()

    const ctx = createRequestCtx()
    onRequest(ctx)
    // the browser attaches its own cookies via `credentials: 'include'`
    expect(ctx.options.headers.get('cookie')).toBeNull()
  })

  test('appends no cookie header when the incoming request has none', () => {
    vi.spyOn(processComposables, 'useProcess').mockReturnValue({ isClient: false, isServer: true })
    mockUseRequestHeaders.mockReturnValue({})

    const onRequest = captureOnRequest()
    const ctx = createRequestCtx()
    onRequest(ctx)
    expect(ctx.options.headers.get('cookie')).toBeNull()
  })
})
