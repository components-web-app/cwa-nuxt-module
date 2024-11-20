import { addRouteMiddleware, defineNuxtPlugin } from '#app'
import CwaRouteMiddleware from '#cwa/runtime/route-middleware'
import Cwa from '#cwa/runtime/cwa'
// @ts-expect-error-next-line
import { options, currentModulePackageInfo } from '#build/cwa-options'

export default defineNuxtPlugin({
  name: 'cwa-plugin',
  enforce: 'post',
  setup(nuxtApp) {
    const cwa = new Cwa(nuxtApp, options, currentModulePackageInfo)
    addRouteMiddleware('cwa-route-middleware', CwaRouteMiddleware, { global: true })
    return {
      provide: {
        cwa,
      },
    }
  },
  hooks: {},
})
