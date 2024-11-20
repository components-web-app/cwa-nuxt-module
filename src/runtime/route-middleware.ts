import { v4 as uuidv4 } from 'uuid'
import logger from 'consola'
import type { RouteLocationNormalized } from 'vue-router'
import type { CwaResource } from './resources/resource-utils'
import { abortNavigation, callWithNuxt, defineNuxtRouteMiddleware, navigateTo, useNuxtApp } from '#app'
import { useProcess } from '#cwa/runtime/composables/process'

let middlewareToken = ''

export default defineNuxtRouteMiddleware(async (to: RouteLocationNormalized) => {
  const { isClient } = useProcess()
  middlewareToken = uuidv4()
  const nuxtApp = useNuxtApp()

  const adminRouteGuard = nuxtApp.$cwa.adminNavigationGuardFn(to)
  if (adminRouteGuard === false) {
    return abortNavigation()
  }

  const discardAddingSuccess = await nuxtApp.$cwa.resourcesManager.confirmDiscardAddingResource()
  if (!discardAddingSuccess) {
    return abortNavigation()
  }

  if (adminRouteGuard !== true) {
    return navigateTo(adminRouteGuard)
  }

  if (isClient) {
    await nuxtApp.$cwa.initClientSide()
  }

  if (to.meta.cwa !== true) {
    nuxtApp.$cwa.clearPrimaryFetch()
    return
  }

  const waitForMiddleware = () => {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (nuxtApp._processingMiddleware === undefined) {
          resolve(true)
          clearInterval(checkInterval)
        }
      }, 10)
    })
  }

  // todo: redirects do not work if clicking on route that should redirect quickly multiple times
  const handleRouteRedirect = async (resource: CwaResource | undefined) => {
    // only check for the redirect path, we know the resource returned is the primary resource,
    // and we have requested to fetch a route, so will be a route resource.
    if (resource?.redirectPath) {
      // we are not just returning the route to redirect to for client side, and that's all navigateTo does if processing middleware it true
      if (isClient && nuxtApp._processingMiddleware) {
        await waitForMiddleware()
      }

      return callWithNuxt(nuxtApp, navigateTo, [resource.redirectPath, { redirectCode: 308 }])
    }
  }

  // todo: pending https://github.com/nuxt/framework/issues/9705
  // need to await this, but if we do then returning to original page will not be triggered
  if (!isClient) {
    // the promise will be returned fast and nested fetches/manifest resource fetches not waited for if we are redirecting
    const resource = await nuxtApp.$cwa.fetchRoute(to)
    return handleRouteRedirect(resource)
  }

  // skip on first client side run as server-side will have completed
  if (nuxtApp.isHydrating && nuxtApp.payload.serverRendered) {
    return
  }

  const startedMiddlewareToken = middlewareToken
  nuxtApp.$cwa.fetchRoute(to)
    .then(async (resource: CwaResource | undefined) => {
      // check if the request finishing is still current to perform redirect
      if (startedMiddlewareToken !== middlewareToken && resource?.redirectPath) {
        return
      }
      const response = await handleRouteRedirect(resource)
      if (response) {
        logger.info('Redirect handler failed', response)
      }
    })
})
