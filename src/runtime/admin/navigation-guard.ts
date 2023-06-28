import { RouteLocationNormalized, Router } from 'vue-router'
import { AdminStore } from '#cwa/runtime/storage/stores/admin/admin-store'
import { abortNavigation, defineNuxtRouteMiddleware, navigateTo } from '#app'

export default class NavigationGuard {
  private programmatic = false
  public constructor (private router: Router, private adminStoreDefinition: AdminStore) {
    this.init()
  }

  private isRouteForcedNavigation (toRoute: RouteLocationNormalized) {
    const cwaForceQuery = toRoute.query?.cwa_force === 'true'
    if (cwaForceQuery) {
      delete toRoute.query.cwa_force
      return true
    }

    const cwaForceParam = toRoute.params?.cwa_force
    return cwaForceParam === 'true'
  }

  private allowNavigation (toRoute: RouteLocationNormalized) {
    return this.isRouteForcedNavigation(toRoute) ||
      !this.programmatic ||
      !this.adminStore.isEditing ||
      this.adminStore.navigationGuardDisabled
  }

  private init () {
    // when we have a programmatic navigation we should set the variable in the class, so we know it is not a back button in a browser etc.
    ['push', 'go', 'back', 'forward', 'replace'].forEach((methodName) => {
      // @ts-ignore
      const method = this.router[methodName]
      // @ts-ignore
      this.router[methodName] = (...args) => {
        this.programmatic = true
        return method.apply(this.router, args)
      }
    })
  }

  public get getMiddleware () {
    return defineNuxtRouteMiddleware((toRoute: RouteLocationNormalized) => {
      const cwaForceQuery = toRoute.query?.cwa_force

      if (!this.allowNavigation(toRoute)) {
        return abortNavigation()
      }

      this.programmatic = false
      if (!cwaForceQuery) {
        return
      }

      // only redirect if necessary - infinite loops otherwise
      return navigateTo({
        path: toRoute.path,
        query: toRoute.query
      })
    })
  }

  private get adminStore () {
    return this.adminStoreDefinition.useStore()
  }
}
