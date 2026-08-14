import { defineNuxtRouteMiddleware, navigateTo, useNuxtApp } from 'nuxt/app'
import type { RouteLocationNormalized } from 'vue-router'

/**
 * Require a signed-in user.
 *
 * Opt in per page: `definePageMeta({ middleware: 'cwa-auth' })`. Named `cwa-auth` rather than `auth`
 * so it cannot collide with an application's own middleware of that name.
 *
 * A signed-out visitor is sent to the login page with the path they wanted in a `redirect` query
 * parameter, which `useLogin()` reads by default — so the round trip needs no application code.
 */
export default defineNuxtRouteMiddleware(async (to: RouteLocationNormalized) => {
  const { $cwa } = useNuxtApp()

  // Resolve the session first. `signedIn` is derived from a cookie, which can outlive the session:
  // deciding on it alone would wave a signed-out visitor through to a page that then loads nothing.
  // `init()` only calls /me once per instance, and is safe on the server — the request cookie is
  // captured eagerly by CwaFetch (see #263).
  await $cwa.auth.init()

  if ($cwa.auth.signedIn.value) {
    return
  }

  return navigateTo({
    path: '/login',
    query: { redirect: to.fullPath },
  })
})
