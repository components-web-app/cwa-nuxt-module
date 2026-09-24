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

describe('CwaFetch -> server-side cookie forwarding', () => {
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

    expect(mockUseRequestHeaders).toHaveBeenCalledWith(['cookie'])
    expect(mockUseRequestHeaders).toHaveBeenCalledTimes(1)

    contextIsLost()

    const ctx = createRequestCtx()
    expect(() => onRequest(ctx)).not.toThrow()
    expect(ctx.options.headers.get('cookie')).toBe('api_component=jwt; cwa_auth=1')
    expect(mockUseRequestHeaders).toHaveBeenCalledTimes(1)
  })

  test('forwards the captured cookie on every request from the same instance, including ofetch retries', () => {
    vi.spyOn(processComposables, 'useProcess').mockReturnValue({ isClient: false, isServer: true })
    mockUseRequestHeaders.mockReturnValue({ cookie: 'api_component=jwt' })

    const onRequest = captureOnRequest()
    contextIsLost()

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

describe('CwaFetch -> API cache state', () => {
  const createResponseCtx = (cacheControl: string) => ({
    response: { headers: new Headers({ 'cache-control': cacheControl }) },
  })

  function captureOnResponse(instance: CwaFetch) {
    // @ts-expect-error mocked
    const createSpy = vi.spyOn($fetch, 'create')
    void instance
    return createSpy.mock.calls[createSpy.mock.calls.length - 1][0].onResponse
  }

  function serverInstance() {
    vi.spyOn(processComposables, 'useProcess').mockReturnValue({ isClient: false, isServer: true })
    // @ts-expect-error mocked
    vi.spyOn($fetch, 'create').mockReturnValue(vi.fn())
    return new CwaFetch('https://my-api')
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseRequestHeaders.mockReturnValue({})
  })

  test('onResponse is registered on the fetch instance', () => {
    const cwaFetch = serverInstance()
    expect(typeof captureOnResponse(cwaFetch)).toBe('function')
  })

  test('each response is folded into the instance state', () => {
    const cwaFetch = serverInstance()
    const onResponse = captureOnResponse(cwaFetch)

    onResponse(createResponseCtx('public, s-maxage=3600'))
    onResponse(createResponseCtx('public, s-maxage=120'))

    expect(cwaFetch.httpCacheState).toEqual({ storable: true, sharedMaxAge: 120 })
  })

  test('a no-store response marks the instance unstorable', () => {
    const cwaFetch = serverInstance()
    const onResponse = captureOnResponse(cwaFetch)

    onResponse(createResponseCtx('public, s-maxage=3600'))
    onResponse(createResponseCtx('private, no-store, max-age=0'))

    expect(cwaFetch.httpCacheState.storable).toBe(false)
  })

  test('onResponse does not touch Nuxt context', () => {
    const cwaFetch = serverInstance()
    const onResponse = captureOnResponse(cwaFetch)
    mockUseRequestHeaders.mockClear()

    expect(() => onResponse(createResponseCtx('public, s-maxage=60'))).not.toThrow()

    expect(mockUseRequestHeaders).not.toHaveBeenCalled()
    expect(cwaFetch.httpCacheState.sharedMaxAge).toBe(60)
  })

  test('onResponse is synchronous', () => {
    const cwaFetch = serverInstance()
    const onResponse = captureOnResponse(cwaFetch)

    expect(onResponse(createResponseCtx('public, s-maxage=60'))).toBeUndefined()
  })

  test('the client instance records nothing', () => {
    vi.spyOn(processComposables, 'useProcess').mockReturnValue({ isClient: true, isServer: false })
    // @ts-expect-error mocked
    vi.spyOn($fetch, 'create').mockReturnValue(vi.fn())
    const cwaFetch = new CwaFetch('https://my-api')
    const onResponse = captureOnResponse(cwaFetch)

    onResponse(createResponseCtx('private, no-store'))

    expect(cwaFetch.httpCacheState).toEqual({ storable: true, sharedMaxAge: undefined })
  })

  test('two instances never share state', () => {
    const first = serverInstance()
    const onFirstResponse = captureOnResponse(first)
    const second = serverInstance()
    const onSecondResponse = captureOnResponse(second)

    onFirstResponse(createResponseCtx('private, no-store'))
    onSecondResponse(createResponseCtx('public, s-maxage=600'))

    expect(first.httpCacheState).toEqual({ storable: false, sharedMaxAge: undefined })
    expect(second.httpCacheState).toEqual({ storable: true, sharedMaxAge: 600 })
  })
})

describe('CwaFetch -> unauthorised responses', () => {
  const createResponseCtx = (status: number) => ({
    response: { status, headers: new Headers({ 'cache-control': 'private, no-store' }) },
  })

  function createInstance(isServer: boolean) {
    vi.spyOn(processComposables, 'useProcess').mockReturnValue({ isClient: !isServer, isServer })
    // @ts-expect-error mocked
    const createSpy = vi.spyOn($fetch, 'create').mockReturnValue(vi.fn())
    const cwaFetch = new CwaFetch('https://my-api')
    const onResponse = createSpy.mock.calls[createSpy.mock.calls.length - 1][0].onResponse
    return { cwaFetch, onResponse }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseRequestHeaders.mockReturnValue({})
  })

  test('a 401 in the browser calls the registered handler synchronously', () => {
    const { cwaFetch, onResponse } = createInstance(false)
    const handler = vi.fn()
    cwaFetch.onUnauthorised(handler)

    expect(onResponse(createResponseCtx(401))).toBeUndefined()

    expect(handler).toHaveBeenCalledTimes(1)
  })

  test('a successful response in the browser does not call the handler', () => {
    const { cwaFetch, onResponse } = createInstance(false)
    const handler = vi.fn()
    cwaFetch.onUnauthorised(handler)

    onResponse(createResponseCtx(200))

    expect(handler).not.toHaveBeenCalled()
  })

  test('a 401 in the browser with no handler registered is ignored', () => {
    const { cwaFetch, onResponse } = createInstance(false)

    onResponse(createResponseCtx(401))

    expect(cwaFetch.httpCacheState).toEqual({ storable: true, sharedMaxAge: undefined })
  })

  test('a 401 on the server does not call the handler', () => {
    const { cwaFetch, onResponse } = createInstance(true)
    const handler = vi.fn()
    cwaFetch.onUnauthorised(handler)

    onResponse(createResponseCtx(401))

    expect(handler).not.toHaveBeenCalled()
  })
})

describe('CwaFetch -> error responses and the page cache', () => {
  const createResponseCtx = (status: number, cacheControl: string, request = 'https://my-api/_api/_/routes//') => ({
    request,
    response: { status, headers: new Headers({ 'cache-control': cacheControl }) },
  })

  function serverInstance() {
    vi.spyOn(processComposables, 'useProcess').mockReturnValue({ isClient: false, isServer: true })
    // @ts-expect-error mocked
    const createSpy = vi.spyOn($fetch, 'create').mockReturnValue(vi.fn())
    const cwaFetch = new CwaFetch('https://my-api/_api')
    const onResponse = createSpy.mock.calls[createSpy.mock.calls.length - 1][0].onResponse
    return { cwaFetch, onResponse }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseRequestHeaders.mockReturnValue({})
  })

  test.each([
    ['an unpublished component', 'https://my-api/_api/component/html_contents/abc?published=true'],
    ['a component position', 'https://my-api/_api/_/component_positions/abc'],
    ['a component group', 'https://my-api/_api/_/component_groups/abc'],
  ])('a 404 for %s does not stop the page being cached', (_resource, request) => {
    const { cwaFetch, onResponse } = serverInstance()

    onResponse(createResponseCtx(200, 'public, s-maxage=600'))
    onResponse(createResponseCtx(404, 'no-cache, private, max-age=0', request))

    expect(cwaFetch.httpCacheState).toEqual({ storable: true, sharedMaxAge: 600 })
  })

  test('a 401 for a resource that is not public yet does not stop the page being cached', () => {
    const { cwaFetch, onResponse } = serverInstance()

    onResponse(createResponseCtx(200, 'public, s-maxage=600'))
    onResponse(createResponseCtx(401, 'no-cache, private', 'https://my-api/_api/component/images/abc'))

    expect(cwaFetch.httpCacheState).toEqual({ storable: true, sharedMaxAge: 600 })
  })

  test.each([500, 502, 503])('a %i anywhere in the render keeps the page unstorable', (status) => {
    const { cwaFetch, onResponse } = serverInstance()

    onResponse(createResponseCtx(200, 'public, s-maxage=600'))
    onResponse(createResponseCtx(status, 'no-cache, private'))

    expect(cwaFetch.httpCacheState.storable).toBe(false)
  })

  test('#340 markUnstorable makes the render unstorable while keeping the API freshness bound', () => {
    const { cwaFetch, onResponse } = serverInstance()

    onResponse(createResponseCtx(200, 'public, s-maxage=600'))
    cwaFetch.markUnstorable()

    expect(cwaFetch.httpCacheState).toEqual({ storable: false, sharedMaxAge: 600 })
  })

  test('#340 a storable response after markUnstorable cannot make the render storable again', () => {
    const { cwaFetch, onResponse } = serverInstance()

    cwaFetch.markUnstorable()
    onResponse(createResponseCtx(200, 'public, s-maxage=600'))

    expect(cwaFetch.httpCacheState.storable).toBe(false)
  })
})
