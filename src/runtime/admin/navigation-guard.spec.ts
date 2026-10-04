// @vitest-environment happy-dom

import { describe, expect, test, vi, beforeEach } from 'vitest'
import type { Router } from 'vue-router'
import { AdminStore } from '../storage/stores/admin/admin-store'
import NavigationGuard from './navigation-guard'

vi.mock('../storage/stores/admin/admin-store', () => {
  return {
    AdminStore: vi.fn(function () {
      return {
        useStore: vi.fn(() => ({
          state: {
            isEditing: false,
            navigationGuardDisabled: false,
          },
        })),
      }
    }),
  }
})

function createRouterMock() {
  return {
    push: vi.fn(),
    go: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    replace: vi.fn(),
  }
}

function createNavigationGuard(customRouter?: Router) {
  const router = customRouter || createRouterMock()
  const navigationGuardInstance = new NavigationGuard(router as any, new AdminStore('storeName'))
  vi.spyOn(navigationGuardInstance.router, 'push')
  vi.spyOn(navigationGuardInstance.router, 'go')
  vi.spyOn(navigationGuardInstance.router, 'back')
  vi.spyOn(navigationGuardInstance.router, 'forward')
  vi.spyOn(navigationGuardInstance.router, 'replace')
  return navigationGuardInstance
}

describe('Test NavigationGuard Class', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test.each([
    { method: 'push' },
    { method: 'go' },
    { method: 'back' },
    { method: 'forward' },
    { method: 'replace' },
  ])('wraps router.$method and sets programmatic flag', ({ method }) => {
    const router = createRouterMock()
    const guard = createNavigationGuard(router)

    expect(guard.programmatic).toBe(false)

    const args = [{ path: '/new-path' }]

    // call wrapped router method
    guard.router[method](...args)

    expect(router[method]).toHaveBeenCalledWith(...args)
    expect(guard.programmatic).toBe(true)
  })

  describe('isRouteForcedNavigation', () => {
    test.each([
      { cwaForce: 'true', forced: true },
      { cwaForce: 'x', forced: false },
      { cwaForce: ['true', 'x'], forced: false },
    ])('is forced only by cwa_force=true, and leaves the query for the guard to clear ($cwaForce)', ({ cwaForce, forced }) => {
      const guard = createNavigationGuard()

      const toRoute: any = {
        path: '/path-to-greatness',
        query: {
          cwa_force: cwaForce,
          another: 'thing',
        },
      }

      const result = guard.isRouteForcedNavigation(toRoute)

      expect(result).toBe(forced)
      expect(toRoute.query).toEqual({
        cwa_force: cwaForce,
        another: 'thing',
      })
    })

    test.each([
      { params: { cwa_force: 'true' }, response: true },
      { params: undefined, response: false },
    ])('returns $response when params are $params', ({ params, response }) => {
      const guard = createNavigationGuard()

      const toRoute: any = {
        path: '/path-to-greatness',
        params,
      }

      const result = guard.isRouteForcedNavigation(toRoute)

      expect(result).toBe(response)
    })
  })

  test.each([
    { isRouteForcedNavigation: true, programmatic: true, isEditing: true, navigationGuardDisabled: false, response: true },
    { isRouteForcedNavigation: false, programmatic: false, isEditing: true, navigationGuardDisabled: false, response: true },
    { isRouteForcedNavigation: false, programmatic: true, isEditing: false, navigationGuardDisabled: false, response: true },
    { isRouteForcedNavigation: false, programmatic: true, isEditing: true, navigationGuardDisabled: true, response: true },
    { isRouteForcedNavigation: false, programmatic: true, isEditing: true, navigationGuardDisabled: false, response: false },
  ])(
    'allowNavigation returns $response',
    ({ isRouteForcedNavigation, programmatic, isEditing, navigationGuardDisabled, response }) => {
      const guard = createNavigationGuard()

      const toRoute: any = {
        path: '/path-to-greatness',
      }

      vi.spyOn(guard, 'isRouteForcedNavigation').mockReturnValue(isRouteForcedNavigation)

      guard._adminStore = {
        state: {
          isEditing,
          navigationGuardDisabled,
        },
      }

      guard.programmatic = programmatic

      const result = guard.allowNavigation(toRoute)

      expect(guard.isRouteForcedNavigation).toHaveBeenCalledWith(toRoute)
      expect(result).toBe(response)
    },
  )

  describe('adminNavigationGuardFn', () => {
    test.each([
      { allowNavigation: false, result: false, query: {} },
      { allowNavigation: true, result: true, query: {} },
      {
        allowNavigation: true,
        result: { path: '/to-greatness', query: { ah: 'ha' } },
        query: { ask: 'away', cwa_force: 'true' },
      },
    ])(
      'returns correct navigation result and resets programmatic flag',
      ({ allowNavigation, result, query }) => {
        const guard = createNavigationGuard()
        guard.programmatic = true

        const fn = guard.adminNavigationGuardFn

        const toRoute: any = {
          path: '/to-greatness',
          query,
        }

        vi.spyOn(guard, 'allowNavigation').mockImplementation(() => {
          toRoute.query = { ah: 'ha' }
          return allowNavigation
        })

        const response = fn(toRoute)

        expect(response).toEqual(result)
        expect(guard.programmatic).toBe(false)
      },
    )

    test.each([
      { cwaForce: 'true', redirects: 1 },
      { cwaForce: 'x', redirects: 1 },
      { cwaForce: '', redirects: 1 },
      { cwaForce: null, redirects: 1 },
      { cwaForce: ['true', 'x'], redirects: 1 },
      { cwaForce: undefined, redirects: 0 },
    ])('settles after at most one redirect, without cwa_force, when cwa_force is $cwaForce (#366)', ({ cwaForce, redirects }) => {
      const guard = createNavigationGuard()
      const fn = guard.adminNavigationGuardFn
      let fromRoute: any = { path: '/', query: {}, hash: '' }
      let toRoute: any = { path: '/page', query: { keep: 'me', ...(cwaForce === undefined ? {} : { cwa_force: cwaForce }) }, hash: '' }

      let redirectCount = 0
      let response = fn(toRoute, fromRoute)
      while (typeof response === 'object' && redirectCount < 5) {
        redirectCount++
        fromRoute = toRoute
        toRoute = { path: response.path, query: { ...response.query }, hash: response.hash }
        response = fn(toRoute, fromRoute)
      }

      expect(response).toBe(true)
      expect(redirectCount).toBe(redirects)
      expect(toRoute.query).toEqual({ keep: 'me' })
    })
  })

  test('adminStore getter returns store instance', () => {
    const guard = createNavigationGuard()

    const result = guard.adminStore

    expect(result).toEqual(
      AdminStore.mock.results[0].value.useStore.mock.results[0].value,
    )
  })
})
