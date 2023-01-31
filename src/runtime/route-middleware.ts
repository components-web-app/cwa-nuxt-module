import { callWithNuxt, defineNuxtRouteMiddleware, navigateTo, useNuxtApp } from '#app'
import { CwaResource } from '@cwa/nuxt-module/runtime/resources/resource-utils'

export default defineNuxtRouteMiddleware(async (to) => {
  const nuxtApp = useNuxtApp()

  if (to.meta.cwa === false) {
    return
  }

  const handleRouteRedirect = (resource: CwaResource|undefined) => {
    // only check for the redirect path, we know the resource returned is the primary resource
    // and we have requested to fetch a route, so will be a route resource.
    if (resource?.redirectPath) {
      return callWithNuxt(nuxtApp, navigateTo, [resource.redirectPath, { redirectCode: 308 }])
    }
  }

  // todo: pending https://github.com/nuxt/framework/issues/9705
  // need to await this, but if we do then returning to original page will not be triggered
  if (process.client) {
    nuxtApp.$cwa.fetcher.fetchRoute(to.path).then((resource: CwaResource|undefined) => {
      handleRouteRedirect(resource)
    })
    return
  }

  // the promise will be returned fast and nested fetches/manifest resource fetches not waited for if we are redirecting
  const resource = await nuxtApp.$cwa.fetcher.fetchRoute(to.path)
  return handleRouteRedirect(resource)
})
