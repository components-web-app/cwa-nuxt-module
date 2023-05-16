import { addRouteMiddleware, defineNuxtPlugin } from '#app'
import CwaRouteMiddleware from '#cwa/runtime/route-middleware'
import Cwa from '#cwa/runtime/cwa'
import { options } from '#build/cwa-options'

export default defineNuxtPlugin({
  name: 'cwa-plugin',
  enforce: 'pre',
  setup (nuxtApp) {
    addRouteMiddleware('cwa', CwaRouteMiddleware, { global: true })
    return {
      provide: {
        cwa: new Cwa(nuxtApp, options)
      }
    }
  },
  hooks: {}
})
