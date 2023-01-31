import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { RouteLocationNormalizedLoaded } from 'vue-router'
import * as nuxt from '#app'
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

  beforeAll(() => {
    // @ts-ignore
    vi.spyOn(nuxt, 'useNuxtApp').mockImplementation(() => {
      return {
        $cwa: { fetcher: { fetchRoute: fetchRouteFn } }
      }
    })
  })

  beforeEach(() => {
    resolved = false
  })

  afterEach(() => {
    fetchRouteFn.mockClear()
  })

  test('Test route middleware is enabled by default', async () => {
    const toRoute = createToRoute()
    await routeMiddleware(toRoute, toRoute)
    expect(fetchRouteFn).toHaveBeenCalledTimes(1)
    expect(fetchRouteFn).toHaveBeenCalledWith(toRoute.path)
    expect(resolved).toBe(true)
  })

  test('Test route middleware can be set to true', async () => {
    const toRoute = createToRoute(true)
    await routeMiddleware(toRoute, toRoute)
    expect(fetchRouteFn).toHaveBeenCalledTimes(1)
    expect(fetchRouteFn).toHaveBeenCalledWith(toRoute.path)
  })

  test('Test route middleware can be disabled', async () => {
    const toRoute = createToRoute(false)
    await routeMiddleware(toRoute, toRoute)
    expect(fetchRouteFn).not.toHaveBeenCalled()
  })

  test('Test we await promise for server-side requests.', async () => {
    process.client = false
    const toRoute = createToRoute()
    await routeMiddleware(toRoute, toRoute)
    expect(fetchRouteFn).toHaveBeenCalledTimes(1)
    expect(fetchRouteFn).toHaveBeenCalledWith(toRoute.path)
    expect(resolved).toBe(true)
  })

  test('Test we do not await promise for client-side requests. See notes on middleware file re returning to original page if new page fetch not complete.', async () => {
    process.client = true
    const toRoute = createToRoute()
    await routeMiddleware(toRoute, toRoute)
    expect(fetchRouteFn).toHaveBeenCalledTimes(1)
    expect(fetchRouteFn).toHaveBeenCalledWith(toRoute.path)
    expect(resolved).toBe(false)
  })
})
