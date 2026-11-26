import { defineNuxtRouteMiddleware, navigateTo, useNuxtApp } from 'nuxt/app'
import type { RouteLocationNormalized } from 'vue-router'
import { useProcess } from '#cwa/composables/process'

export default defineNuxtRouteMiddleware(async (to: RouteLocationNormalized) => {
  const { $cwa } = useNuxtApp()

  await $cwa.auth.init()

  if ([(to.meta.cwaAdminRole as string | string[] | undefined) ?? 'ROLE_CMS_ADMIN'].flat().some(role => $cwa.auth.hasRole(role))) {
    return
  }

  if ($cwa.auth.signedIn.value) {
    return navigateTo('/')
  }

  if (useProcess().isServer) {
    return
  }

  return navigateTo({
    path: '/login',
    query: { redirect: to.fullPath },
  })
})
