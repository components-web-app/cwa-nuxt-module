import { defineNuxtRouteMiddleware, useNuxtApp } from '#app'

export default defineNuxtRouteMiddleware(async (to) => {
  const { $cwa } = useNuxtApp()

  if (to.meta.cwa === false) {
    return
  }

  // todo: pending https://github.com/nuxt/framework/issues/9705
  // need to await this, but if we do then returning to original page will not be triggered
  if (process.client) {
    $cwa.fetcher.fetchRoute(to.path)
    return
  }

  await $cwa.fetcher.fetchRoute(to.path)
})
