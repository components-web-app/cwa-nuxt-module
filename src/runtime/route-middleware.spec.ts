// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import type { RouteLocationNormalizedLoaded, RouteLocationRaw } from 'vue-router'
import { flushPromises } from '@vue/test-utils'
import { computed } from 'vue'
import * as processComposables from './composables/process'
import routeMiddleware from './route-middleware'
import * as nuxt from '#app'

function createToRoute(cwa?: boolean | undefined): RouteLocationNormalizedLoaded {
  if (cwa === undefined) {
    cwa = true
  }
  return {
    name: '',
    path: '/',
    fullPath: '/',
    query: {},
    hash: '',
    matched: [],
    params: {},
    meta: {
      cwa: {
        disabled: !cwa,
      },
    },
    redirectedFrom: undefined,
  }
}

describe('Test route middleware', () => {
  let fetchRouteRedirectResolved = false

  const fetchRouteFn = vi.fn(() => {
    return new Promise((resolve) => {
      setTimeout(() => {
        fetchRouteRedirectResolved = true
        resolve(true)
      }, 5)
    })
  })

  const fetchRouteRedirectFn = vi.fn(() => {
    return new Promise((resolve) => {
      fetchRouteRedirectResolved = true
      resolve({ redirectPath: '/redirect-path' })
    })
  })

  const initClientSide = vi.fn()
  const adminNavigationGuardFn = vi.fn((): boolean | RouteLocationRaw => true)
  const confirmDiscardAddingResource = vi.fn((): boolean => true)
  const clearPrimaryFetch = vi.fn()

  beforeAll(() => {
    // @ts-expect-error
    vi.spyOn(nuxt, 'useNuxtApp').mockImplementation(() => {
      return {
        payload: {},
        $cwa: { fetchRoute: fetchRouteFn, initClientSide, adminNavigationGuardFn, clearPrimaryFetch, resourcesManager: { confirmDiscardAddingResource }, auth: { isAdmin: computed(() => false) }, siteConfig: { loadConfig: vi.fn() } },
      }
    })
    vi.spyOn(nuxt, 'callWithNuxt').mockImplementation(() => 'callWithNuxtResponse')
    vi.spyOn(nuxt, 'navigateTo').mockImplementation(() => 'navigateToResponse')
    vi.spyOn(nuxt, 'abortNavigation').mockImplementation(() => 'abortNavigationResponse')
    vi.spyOn(nuxt, 'navigateTo').mockImplementation(() => 'navigateToResponse')
  })

  beforeEach(() => {
    fetchRouteRedirectResolved = false
  })

  afterEach(() => {
    nuxt.callWithNuxt.mockClear()
    fetchRouteFn.mockClear()
    fetchRouteRedirectFn.mockClear()
    initClientSide.mockClear()
  })

  test('Admin Route Guard responding false results in aborted navigation', async () => {
    const toRoute = createToRoute()
    adminNavigationGuardFn.mockImplementationOnce(() => false)
    const response = await routeMiddleware(toRoute)
    expect(nuxt.abortNavigation).toHaveBeenCalled()
    expect(response).toEqual('abortNavigationResponse')
  })

  test('Admin Route Guard responding false results in aborted navigation', async () => {
    const toRoute = createToRoute()
    adminNavigationGuardFn.mockImplementationOnce(() => ({ path: 'path' }))
    const response = await routeMiddleware(toRoute)
    expect(nuxt.navigateTo).toHaveBeenCalledWith({ path: 'path' })
    expect(response).toEqual('navigateToResponse')
  })

  test('Test route middleware is enabled by default', async () => {
    vi.useFakeTimers()
    const toRoute = createToRoute()
    await routeMiddleware(toRoute)
    vi.runAllTimers()
    expect(fetchRouteFn).toHaveBeenCalledTimes(1)
    expect(fetchRouteFn).toHaveBeenCalledWith(toRoute)
    expect(nuxt.callWithNuxt).not.toHaveBeenCalled()
    expect(fetchRouteRedirectResolved).toBe(true)
    vi.useRealTimers()
  })

  test('Test route middleware can be set to true', async () => {
    const toRoute = createToRoute(true)
    await routeMiddleware(toRoute)
    expect(fetchRouteFn).toHaveBeenCalledTimes(1)
    expect(fetchRouteFn).toHaveBeenCalledWith(toRoute)
    expect(nuxt.callWithNuxt).not.toHaveBeenCalled()
  })

  test('Test route middleware can be disabled', async () => {
    const toRoute = createToRoute(false)
    await routeMiddleware(toRoute)
    expect(clearPrimaryFetch).toHaveBeenCalled()
    expect(fetchRouteFn).not.toHaveBeenCalled()
    expect(nuxt.callWithNuxt).not.toHaveBeenCalled()
  })

  test('Test we await promise for server-side requests.', async () => {
    vi.spyOn(processComposables, 'useProcess').mockImplementation(() => {
      return {
        isClient: false,
        isServer: true,
      }
    })
    const toRoute = createToRoute()
    await routeMiddleware(toRoute)
    expect(fetchRouteFn).toHaveBeenCalledTimes(1)
    expect(fetchRouteFn).toHaveBeenCalledWith(toRoute)
    expect(nuxt.callWithNuxt).not.toHaveBeenCalled()
    expect(fetchRouteRedirectResolved).toBe(true)
  })

  test('Test we do not await promise for client-side requests. See notes on middleware file re returning to original page if new page fetch not complete.', async () => {
    vi.spyOn(processComposables, 'useProcess').mockImplementation(() => {
      return {
        isClient: true,
        isServer: false,
      }
    })
    const toRoute = createToRoute()
    await routeMiddleware(toRoute)
    expect(fetchRouteFn).toHaveBeenCalledTimes(1)
    expect(fetchRouteFn).toHaveBeenCalledWith(toRoute)
    expect(nuxt.callWithNuxt).not.toHaveBeenCalled()
    expect(fetchRouteRedirectResolved).toBe(false)
  })

  test('Server-side redirects', async () => {
    // @ts-expect-error
    vi.spyOn(nuxt, 'useNuxtApp').mockImplementationOnce(() => {
      return {
        payload: {},
        $cwa: { fetchRoute: fetchRouteRedirectFn, initClientSide, adminNavigationGuardFn, resourcesManager: { confirmDiscardAddingResource }, auth: { isAdmin: computed(() => false) }, siteConfig: { loadConfig: vi.fn() } },
      }
    })
    vi.spyOn(processComposables, 'useProcess').mockImplementation(() => {
      return {
        isClient: false,
        isServer: true,
      }
    })
    const toRoute = createToRoute()
    await routeMiddleware(toRoute)
    expect(nuxt.callWithNuxt).toHaveBeenCalledTimes(1)
    expect(nuxt.callWithNuxt).toHaveBeenCalledWith(nuxt.useNuxtApp.mock.results[0].value, nuxt.navigateTo, ['/redirect-path', { redirectCode: 308 }])
  })

  test('Client-side redirects', async () => {
    // @ts-expect-error
    vi.spyOn(nuxt, 'useNuxtApp').mockImplementationOnce(() => {
      return {
        $cwa: { fetchRoute: fetchRouteRedirectFn, initClientSide, adminNavigationGuardFn, resourcesManager: { confirmDiscardAddingResource }, auth: { isAdmin: computed(() => false) } },
      }
    })
    vi.spyOn(processComposables, 'useProcess').mockImplementation(() => {
      return {
        isClient: true,
        isServer: false,
      }
    })
    const toRoute = createToRoute()
    await routeMiddleware(toRoute)
    await flushPromises()
    expect(nuxt.callWithNuxt).toHaveBeenCalledTimes(1)
    expect(nuxt.callWithNuxt).toHaveBeenCalledWith(nuxt.useNuxtApp.mock.results[0].value, nuxt.navigateTo, ['/redirect-path', { redirectCode: 308 }])
  })
})
