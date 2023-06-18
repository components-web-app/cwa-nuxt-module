import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { RouteLocationNormalizedLoaded } from 'vue-router'
import * as nuxt from '#app'
import * as processComposables from './composables/process'
import routeMiddleware from './route-middleware'

function createToRoute (cwa?: boolean|undefined): RouteLocationNormalizedLoaded {
  return {
    name: '',
    path: '/',
    fullPath: '/',
    query: {},
    hash: '',
    matched: [],
    params: {},
    meta: {
      cwa
    },
    redirectedFrom: undefined
  }
}

function delay (time: number, returnValue: any = undefined) {
  return new Promise((resolve) => {
    setTimeout(() => { resolve(returnValue) }, time)
  })
}

describe('Test route middleware', () => {
  let resolved = false

  const fetchRouteFn = vi.fn(() => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolved = true
        resolve(true)
      }, 5)
    })
  })

  const fetchRouteRedirectFn = vi.fn(() => {
    return new Promise((resolve) => {
      resolved = true
      resolve({ redirectPath: '/redirect-path' })
    })
  })

  const initClientSide = vi.fn()

  beforeAll(() => {
    // @ts-ignore
    vi.spyOn(nuxt, 'useNuxtApp').mockImplementation(() => {
      return {
        $cwa: { fetchRoute: fetchRouteFn, initClientSide }
      }
    })
    vi.spyOn(nuxt, 'callWithNuxt').mockImplementation(() => 'callWithNuxtResponse')
    vi.spyOn(nuxt, 'navigateTo').mockImplementation(() => 'navigateToResponse')
  })

  beforeEach(() => {
    resolved = false
  })

  afterEach(() => {
    nuxt.callWithNuxt.mockClear()
    fetchRouteFn.mockClear()
    fetchRouteRedirectFn.mockClear()
    initClientSide.mockClear()
  })

  test('Test route middleware is enabled by default', async () => {
    vi.useFakeTimers()
    const toRoute = createToRoute()
    await routeMiddleware(toRoute, toRoute)
    vi.runAllTimers()
    expect(fetchRouteFn).toHaveBeenCalledTimes(1)
    expect(fetchRouteFn).toHaveBeenCalledWith(toRoute)
    expect(nuxt.callWithNuxt).not.toHaveBeenCalled()
    expect(resolved).toBe(true)
    vi.useRealTimers()
  })

  test('Test route middleware can be set to true', async () => {
    const toRoute = createToRoute(true)
    await routeMiddleware(toRoute, toRoute)
    expect(fetchRouteFn).toHaveBeenCalledTimes(1)
    expect(fetchRouteFn).toHaveBeenCalledWith(toRoute)
    expect(nuxt.callWithNuxt).not.toHaveBeenCalled()
  })

  test('Test route middleware can be disabled', async () => {
    const toRoute = createToRoute(false)
    await routeMiddleware(toRoute, toRoute)
    expect(fetchRouteFn).not.toHaveBeenCalled()
    expect(nuxt.callWithNuxt).not.toHaveBeenCalled()
  })

  test('Test we await promise for server-side requests.', async () => {
    vi.spyOn(processComposables, 'useProcess').mockImplementation(() => {
      return {
        isClient: false,
        isServer: true
      }
    })
    const toRoute = createToRoute()
    await routeMiddleware(toRoute, toRoute)
    expect(fetchRouteFn).toHaveBeenCalledTimes(1)
    expect(fetchRouteFn).toHaveBeenCalledWith(toRoute)
    expect(nuxt.callWithNuxt).not.toHaveBeenCalled()
    expect(resolved).toBe(true)
  })

  test('Test we do not await promise for client-side requests. See notes on middleware file re returning to original page if new page fetch not complete.', async () => {
    vi.spyOn(processComposables, 'useProcess').mockImplementation(() => {
      return {
        isClient: true,
        isServer: false
      }
    })
    const toRoute = createToRoute()
    await routeMiddleware(toRoute, toRoute)
    expect(fetchRouteFn).toHaveBeenCalledTimes(1)
    expect(fetchRouteFn).toHaveBeenCalledWith(toRoute)
    expect(nuxt.callWithNuxt).not.toHaveBeenCalled()
    expect(resolved).toBe(false)
  })

  test('Server-side redirects', async () => {
    // @ts-ignore
    vi.spyOn(nuxt, 'useNuxtApp').mockImplementationOnce(() => {
      return {
        $cwa: { fetchRoute: fetchRouteRedirectFn, initClientSide }
      }
    })
    vi.spyOn(processComposables, 'useProcess').mockImplementation(() => {
      return {
        isClient: false,
        isServer: true
      }
    })
    const toRoute = createToRoute()
    await routeMiddleware(toRoute, toRoute)
    expect(nuxt.callWithNuxt).toHaveBeenCalledTimes(1)
    expect(nuxt.callWithNuxt).toHaveBeenCalledWith(nuxt.useNuxtApp.mock.results[0].value, nuxt.navigateTo, ['/redirect-path', { redirectCode: 308 }])
  })

  test('Client-side redirects', async () => {
    // @ts-ignore
    vi.spyOn(nuxt, 'useNuxtApp').mockImplementationOnce(() => {
      return {
        $cwa: { fetchRoute: fetchRouteRedirectFn, initClientSide }
      }
    })
    vi.spyOn(processComposables, 'useProcess').mockImplementation(() => {
      return {
        isClient: true,
        isServer: false
      }
    })
    const toRoute = createToRoute()
    await routeMiddleware(toRoute, toRoute)
    // real delay needed for an await because we will not wait for that
    await delay(1)
    expect(nuxt.callWithNuxt).toHaveBeenCalledTimes(1)
    expect(nuxt.callWithNuxt).toHaveBeenCalledWith(nuxt.useNuxtApp.mock.results[0].value, nuxt.navigateTo, ['/redirect-path', { redirectCode: 308 }])
  })
})
