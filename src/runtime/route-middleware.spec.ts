import { describe, expect, test, vi } from 'vitest'
import { RouteLocationNormalizedLoaded } from 'vue-router'
import * as nuxt from '#app'
import routeMiddleware from './route-middleware'

describe.concurrent('Test route middleware', () => {
  const fetcher = {
    fetchRoute: vi.fn()
  }

  // We are not returning an entire NuxtApp interface, ignore.
  // @ts-ignore
  vi.spyOn(nuxt, 'useNuxtApp').mockImplementation(() => {
    return {
      $cwa: { fetcher }
    }
  })

  test.concurrent('Test route middleware can be disabled', () => {
    const toRoute: RouteLocationNormalizedLoaded = {
      name: '',
      path: '/',
      fullPath: '/',
      query: {},
      hash: '',
      matched: [],
      params: {},
      meta: {
        cwa: false
      },
      redirectedFrom: undefined
    }

    routeMiddleware(toRoute, toRoute)

    expect(fetcher.fetchRoute).toHaveBeenCalledTimes(0)
  })

  test.concurrent('Test route middleware can be disabled', () => {
    const toRoute: RouteLocationNormalizedLoaded = {
      name: '',
      path: '/',
      fullPath: '/',
      query: {},
      hash: '',
      matched: [],
      params: {},
      meta: {},
      redirectedFrom: undefined
    }

    routeMiddleware(toRoute, toRoute)

    expect(fetcher.fetchRoute).toHaveBeenCalledWith(toRoute.path)
  })
})
