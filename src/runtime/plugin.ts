import { addRouteMiddleware, defineNuxtPlugin } from '#app'
import CwaRouteMiddleware from '#cwa/runtime/route-middleware'
import Cwa from '#cwa/runtime/cwa'
// @ts-ignore
import { options } from '#build/cwa-options'

export default defineNuxtPlugin({
  name: 'cwa-plugin',
  enforce: 'post',
  setup (nuxtApp) {
    // @ts-ignore-next-line
    const cwa = new Cwa(nuxtApp, options)
    addRouteMiddleware('cwa-route-middleware', CwaRouteMiddleware, { global: true })
    return {
      provide: {
        cwa
      }
    }
  },
  hooks: {}
})
