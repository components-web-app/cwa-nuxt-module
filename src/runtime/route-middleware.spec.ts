import { afterEach, describe, expect, test, vi, beforeEach } from 'vitest'
import { RouteLocationNormalizedLoaded } from 'vue-router'
import * as nuxt from '#app'
import { RouteMiddleware } from 'nuxt/dist/app/composables/router'
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
  const fetchRouteFn = vi.fn()
  // @ts-ignore
  vi.spyOn(nuxt, 'useNuxtApp').mockImplementation(() => {
    return {
      $cwa: { fetcher: { fetchRoute: fetchRouteFn } }
    }
  })

  afterEach(() => {
    fetchRouteFn.mockReset()
  })

  test('Test route middleware is enabled by default', () => {
    const toRoute = createToRoute()
    routeMiddleware(toRoute, toRoute)
    expect(fetchRouteFn).toHaveBeenCalledTimes(1)
    expect(fetchRouteFn).toHaveBeenCalledWith(toRoute.path)
  })
  test('Test route middleware can be set to true', () => {
    const toRoute = createToRoute(true)
    routeMiddleware(toRoute, toRoute)
    expect(fetchRouteFn).toHaveBeenCalledTimes(1)
    expect(fetchRouteFn).toHaveBeenCalledWith(toRoute.path)
  })
  test('Test route middleware can be disabled', () => {
    const toRoute = createToRoute(false)
    routeMiddleware(toRoute, toRoute)
    expect(fetchRouteFn).not.toHaveBeenCalled()
  })
})
