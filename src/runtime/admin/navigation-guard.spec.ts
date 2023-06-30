import { describe, expect, test, vi, beforeEach } from 'vitest'
import * as VueRouter from 'vue-router'
import { Router } from 'vue-router'
import { AdminStore } from '../storage/stores/admin/admin-store'
import NavigationGuard from './navigation-guard'

vi.mock('../storage/stores/admin/admin-store', () => {
  return {
    AdminStore: vi.fn(() => ({
      useStore: vi.fn(() => ({
        state: {
          isEditing: false,
          navigationGuardDisabled: false
        }
      }))
    }))
  }
})

vi.mock('vue-router', () => {
  return {
    createRouter: vi.fn(() => ({
      push: vi.fn(),
      go: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      replace: vi.fn()
    }))
  }
})

function createNavigationGuard (customRouter?: Router) {
  const router = customRouter || VueRouter.createRouter()
  return new NavigationGuard(router, new AdminStore('storeName'))
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
    { method: 'replace' }
  ])('extendRoutesMethods extends function $method properly', ({ method }) => {
    const router = VueRouter.createRouter()
    const originalRouter = {
      ...router
    }
    const guard = createNavigationGuard(router)

    expect(guard.programmatic).toBe(false)

    const args = [
      {
        path: '/new-path'
      }
    ]
    expect(guard.router[method](...args)).toEqual(originalRouter[method].mock.results[0].value)
    expect(originalRouter[method]).toHaveBeenCalledWith(...args)
    expect(guard.programmatic).toBe(true)
  })

  describe('isRouteForcedNavigation', () => {
    test('Returns true and clears a query if set', () => {
      const guard = createNavigationGuard()
      const toRoute = {
        path: '/path-to-greatness',
        query: {
          cwa_force: 'true',
          another: 'thing'
        }
      }
      const result = guard.isRouteForcedNavigation(toRoute)
      expect(result).toBe(true)
      expect(toRoute.query).toEqual({
        another: 'thing'
      })
    })

    test.each([
      { params: { cwa_force: 'true' }, response: true },
      { params: undefined, response: false }
    ])('Returns true is parameter is set', ({ params, response }) => {
      const guard = createNavigationGuard()
      const toRoute = {
        path: '/path-to-greatness',
        params
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
    { isRouteForcedNavigation: false, programmatic: true, isEditing: true, navigationGuardDisabled: false, response: false }
  ])('allowNavigation should return $response if isRouteForcedNavigation is $isRouteForcedNavigation , programmatic is $programmatic , isEditing is $isEditing and navigationGuardDisabled is $navigationGuardDisabled', ({ isRouteForcedNavigation, programmatic, isEditing, navigationGuardDisabled, response }) => {
    const guard = createNavigationGuard()
    const toRoute = {
      path: '/path-to-greatness'
    }
    vi.spyOn(guard, 'isRouteForcedNavigation').mockImplementationOnce(() => {
      return isRouteForcedNavigation
    })
    vi.spyOn(AdminStore.mock.results[0].value, 'useStore').mockImplementation(() => ({
      state: {
        isEditing,
        navigationGuardDisabled
      }
    }))

    guard.programmatic = programmatic

    const result = guard.allowNavigation(toRoute)

    expect(guard.isRouteForcedNavigation).toHaveBeenCalledWith(toRoute)
    expect(result).toBe(response)
  })

  describe('adminNavigationGuardFn', () => {
    test.each([
      { allowNavigation: false, result: false, query: {} },
      { allowNavigation: true, result: true, query: {} },
      { allowNavigation: true, result: { path: '/to-greatness', query: { ah: 'ha' } }, query: { ask: 'away', cwa_force: 'true' } }
    ])('the function returned will response with false if allowNavigation is $allowNavigation and programmatic will be reset to false', ({ allowNavigation, result, query }) => {
      const guard = createNavigationGuard()
      guard.programmatic = true
      const fn = guard.adminNavigationGuardFn

      const toRoute = {
        path: '/to-greatness',
        query
      }

      vi.spyOn(guard, 'allowNavigation').mockImplementationOnce(() => {
        toRoute.query = { ah: 'ha' }
        return allowNavigation
      })

      const response = fn(toRoute)
      expect(response).toEqual(result)
      expect(guard.programmatic).toBe(false)
    })
  })

  test('adminStore getter', () => {
    const guard = createNavigationGuard()
    const result = guard.adminStore
    expect(result).toEqual(AdminStore.mock.results[0].value.useStore.mock.results[0].value)
  })
})
