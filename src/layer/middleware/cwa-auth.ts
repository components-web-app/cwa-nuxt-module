import { defineNuxtRouteMiddleware, navigateTo, useNuxtApp } from 'nuxt/app'
import type { RouteLocationNormalized } from 'vue-router'
import { useProcess } from '#cwa/composables/process'

export default defineNuxtRouteMiddleware(async (to: RouteLocationNormalized) => {
  const { $cwa } = useNuxtApp()

  await $cwa.auth.init()

  if ($cwa.auth.signedIn.value) {
    return
  }

  if (useProcess().isServer) {
    return
  }

  return navigateTo({
    path: '/login',
    query: { redirect: to.fullPath },
  })
})
