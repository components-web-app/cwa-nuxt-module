import { defineNuxtRouteMiddleware, navigateTo, useNuxtApp } from 'nuxt/app'
import type { RouteLocationNormalized } from 'vue-router'
import { useProcess } from '#cwa/composables/process'
import { canOpenAdminPage } from '#cwa/admin/admin-role'

export default defineNuxtRouteMiddleware(async (to: RouteLocationNormalized) => {
  const { $cwa } = useNuxtApp()

  await $cwa.auth.init()

  if (canOpenAdminPage($cwa.auth, to.meta.cwaAdminRole as string | undefined)) {
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
