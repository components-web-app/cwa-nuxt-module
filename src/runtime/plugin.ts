import { addRouteMiddleware, defineNuxtPlugin } from '#app'
import CwaRouteMiddleware from '@cwa/nuxt-module/runtime/route-middleware'
import Cwa from '@cwa/nuxt-module/runtime/cwa'
import { options } from '#build/cwa-options'

export default defineNuxtPlugin((nuxtApp) => {
  addRouteMiddleware('cwa', CwaRouteMiddleware, { global: true })
  return {
    provide: {
      cwa: new Cwa(nuxtApp, options)
    }
  }
})
