import { defineNuxtRouteMiddleware, useNuxtApp } from '#app'

export default defineNuxtRouteMiddleware(async (to) => {
  const { $cwa } = useNuxtApp()

  if (to.meta?.cwa === false) {
    return
  }

  await $cwa.fetcher.fetchRoute(to.path)
})
