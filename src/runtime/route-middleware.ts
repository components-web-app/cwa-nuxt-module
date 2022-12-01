import { defineNuxtRouteMiddleware, useNuxtApp } from '#app'

export default defineNuxtRouteMiddleware((to) => {
  const { $cwa } = useNuxtApp()

  if (to.meta?.cwa === false) {
    return
  }

  $cwa.fetcher.fetchRoute(to.path)
})
