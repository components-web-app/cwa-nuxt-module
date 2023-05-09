import { callWithNuxt, defineNuxtRouteMiddleware, navigateTo, useNuxtApp } from '#app'
import { v4 as uuidv4 } from 'uuid'
import logger from 'consola'
import { CwaResource } from './resources/resource-utils'

let middlewareToken = ''

export default defineNuxtRouteMiddleware(async (to) => {
  middlewareToken = uuidv4()
  const nuxtApp = useNuxtApp()

  if (to.meta.cwa === false) {
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
  const handleRouteRedirect = async (resource: CwaResource|undefined) => {
    // only check for the redirect path, we know the resource returned is the primary resource
    // and we have requested to fetch a route, so will be a route resource.
    if (resource?.redirectPath) {
      // we are not just returning the route to redirect to for client side, and that's all navigateTo does if processing middleware it true
      if (process.client && nuxtApp._processingMiddleware) {
        await waitForMiddleware()
      }

      return callWithNuxt(nuxtApp, navigateTo, [resource.redirectPath, { redirectCode: 308 }])
    }
  }

  // todo: pending https://github.com/nuxt/framework/issues/9705
  // need to await this, but if we do then returning to original page will not be triggered
  if (process.client) {
    // todo: typehint $cwa
    await nuxtApp.$cwa.initClientSide()

    // skip on first client side run as server-side will have completed
    if (nuxtApp.isHydrating && nuxtApp.payload.serverRendered) {
      return
    }

    const startedMiddlewareToken = middlewareToken
    nuxtApp.$cwa.fetchRoute(to)
      .then(async (resource: CwaResource|undefined) => {
        // check if the request finishing is still current to perform redirect
        if (startedMiddlewareToken !== middlewareToken && resource?.redirectPath) {
          return
        }
        const response = await handleRouteRedirect(resource)
        if (response) {
          logger.info('Redirect handler failed', response)
        }
      })
    return
  }

  // the promise will be returned fast and nested fetches/manifest resource fetches not waited for if we are redirecting
  const resource = await nuxtApp.$cwa.fetchRoute(to)
  return handleRouteRedirect(resource)
})
