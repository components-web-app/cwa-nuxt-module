import { defineNuxtRouteMiddleware, useNuxtApp } from '#app'
import { joinURL } from 'ufo'
import { sendRedirect } from 'h3'

export default defineNuxtRouteMiddleware(async (to) => {
  const { $cwa, callHook, ssrContext, $router, $config } = useNuxtApp()

  if (to.meta.cwa === false) {
    return
  }

  // todo: pending https://github.com/nuxt/framework/issues/9705
  // need to await this, but if we do then returning to original page will not be triggered
  if (process.client) {
    $cwa.fetcher.fetchRoute(to.path)
    return
  }

  // todo: pending https://github.com/nuxt/framework/issues/9748
  const resource = await $cwa.fetcher.fetchRoute(to.path)
  if (resource?.redirectPath) {
    // for server-side only
    const redirectLocation = joinURL($config.app.baseURL, $router.resolve(resource.redirectPath).fullPath || '/')
    await callHook('app:redirected')
    await sendRedirect(ssrContext.event, redirectLocation, 308)
  }
})
