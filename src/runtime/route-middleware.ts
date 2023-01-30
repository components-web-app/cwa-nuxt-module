import { callWithNuxt, defineNuxtRouteMiddleware, navigateTo, useNuxtApp } from '#app'

export default defineNuxtRouteMiddleware(async (to) => {
  const nuxtApp = useNuxtApp()

  if (to.meta.cwa === false) {
    return
  }

  // todo: pending https://github.com/nuxt/framework/issues/9705
  // need to await this, but if we do then returning to original page will not be triggered
  if (process.client) {
    nuxtApp.$cwa.fetcher.fetchRoute(to.path)
    return
  }

  const resource = await nuxtApp.$cwa.fetcher.fetchRoute(to.path)
  if (resource?.redirectPath) {
    return callWithNuxt(nuxtApp, navigateTo, [resource?.redirectPath, { redirectCode: 308 }])
  }
})
