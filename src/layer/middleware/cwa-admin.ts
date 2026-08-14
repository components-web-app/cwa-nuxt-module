import { defineNuxtRouteMiddleware, navigateTo, useNuxtApp } from 'nuxt/app'
import type { RouteLocationNormalized } from 'vue-router'

/**
 * Require an admin user.
 *
 * Opt in per page: `definePageMeta({ middleware: 'cwa-admin' })`. Named `cwa-admin` rather than
 * `admin` so it cannot collide with an application's own middleware of that name.
 */
export default defineNuxtRouteMiddleware(async (to: RouteLocationNormalized) => {
  const { $cwa } = useNuxtApp()

  // `isAdmin` reads roles off the fetched user, which `init()` populates — deciding before it
  // resolves would bounce a legitimate admin off their own page on a server-rendered load, which is
  // far worse than not guarding at all. See the note in `cwa-auth` on why this is SSR-safe.
  await $cwa.auth.init()

  if ($cwa.auth.isAdmin.value) {
    return
  }

  // Someone signed in without the role will not gain it by signing in again, so sending them to
  // login would be a loop. Home, as the admin pages themselves have always done.
  if ($cwa.auth.signedIn.value) {
    return navigateTo('/')
  }

  return navigateTo({
    path: '/login',
    query: { redirect: to.fullPath },
  })
})
