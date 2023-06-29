import { addRouteMiddleware, defineNuxtPlugin } from '#app'
import CwaRouteMiddleware from '#cwa/runtime/route-middleware'
import Cwa from '#cwa/runtime/cwa'
// @ts-ignore
import { options } from '#build/cwa-options'
import { NuxtApp } from '#app/nuxt'

interface SetupInterface {
  provide: {
    cwa: Cwa
  }
}

export default defineNuxtPlugin({
  name: 'cwa-plugin',
  enforce: 'pre',
  setup (nuxtApp: NuxtApp): SetupInterface {
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
