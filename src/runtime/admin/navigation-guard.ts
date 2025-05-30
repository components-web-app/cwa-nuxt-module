import type { RouteLocationNormalized, Router } from 'vue-router'
import type { AdminStore } from '../storage/stores/admin/admin-store'

export default class NavigationGuard {
  private programmatic = false
  public constructor(private router: Router, private adminStoreDefinition: AdminStore) {
    this.extendRouteMethods()
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
    return (toRoute: RouteLocationNormalized) => {
      try {
        const cwaForceQuery = toRoute.query?.cwa_force

        if (!this.allowNavigation(toRoute)) {
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
    return this.adminStoreDefinition.useStore()
  }
}
