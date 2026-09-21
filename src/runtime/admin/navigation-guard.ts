import type { RouteLocationNormalized, Router } from 'vue-router'
import type { AdminStore, CwaAdminStoreInterface } from '../storage/stores/admin/admin-store'

export default class NavigationGuard {
  private programmatic = false
  private readonly _adminStore: CwaAdminStoreInterface
  public constructor(private router: Router, adminStoreDefinition: AdminStore) {
    this.extendRouteMethods()
    this._adminStore = adminStoreDefinition.useStore()
  }

  private extendRouteMethods() {
    ['push', 'go', 'back', 'forward', 'replace'].forEach((methodName) => {
      // @ts-expect-error
      const routerFn: (...args: any[]) => any = this.router[methodName]
      // @ts-expect-error
      this.router[methodName] = (...args) => {
        this.programmatic = true
        return routerFn.apply(this.router, args)
      }
    })
  }

  private isRouteForcedNavigation(toRoute: RouteLocationNormalized) {
    const cwaForceQuery = toRoute.query?.cwa_force === 'true'
    if (cwaForceQuery) {
      delete toRoute.query.cwa_force
      return true
    }

    const cwaForceParam = toRoute.params?.cwa_force
    return cwaForceParam === 'true'
  }

  private allowNavigation(toRoute: RouteLocationNormalized) {
    return this.isRouteForcedNavigation(toRoute)
      || !this.programmatic
      || !this.navigationDisabled
  }

  public get navigationDisabled() {
    return this.adminStore.state.isEditing
      && !this.adminStore.state.navigationGuardDisabled
  }

  public get adminNavigationGuardFn() {
    return (toRoute: RouteLocationNormalized, fromRoute: RouteLocationNormalized) => {
      try {
        const cwaForceQuery = toRoute.query?.cwa_force
        const isQueryOnlyChange = fromRoute && toRoute.path === fromRoute.path && toRoute.hash === fromRoute.hash

        if (!this.allowNavigation(toRoute) && !isQueryOnlyChange) {
          return false
        }

        if (!cwaForceQuery) {
          return true
        }

        // only redirect if necessary - infinite loops otherwise
        return {
          path: toRoute.path,
          query: toRoute.query,
          hash: toRoute.hash,
        }
      }
      finally {
        this.programmatic = false
      }
    }
  }

  private get adminStore() {
    return this._adminStore
  }
}
