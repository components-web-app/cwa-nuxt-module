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
    test('Returns true and clears query if cwa_force is set', () => {
      const guard = createNavigationGuard()

      const toRoute: any = {
        path: '/path-to-greatness',
        query: {
          cwa_force: 'true',
          another: 'thing',
        },
      }

      const result = guard.isRouteForcedNavigation(toRoute)

      expect(result).toBe(true)
      expect(toRoute.query).toEqual({
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
  })

  test('adminStore getter returns store instance', () => {
    const guard = createNavigationGuard()

    const result = guard.adminStore

    expect(result).toEqual(
      AdminStore.mock.results[0].value.useStore.mock.results[0].value,
    )
  })
})
