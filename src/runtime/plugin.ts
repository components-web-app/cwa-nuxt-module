import type { ObjectPlugin } from '#app/nuxt'
import { addRouteMiddleware, defineNuxtPlugin, useRouter } from '#imports'
import CwaRouteMiddleware from '#cwa/route-middleware'
import Cwa from '#cwa/cwa'
// @ts-ignore
import { options, currentModulePackageInfo } from '#build/cwa-options'

export default defineNuxtPlugin({
  name: 'cwa-plugin',
  enforce: 'post',
  setup() {
    const router = useRouter()
    const cwa = new Cwa(router, options, currentModulePackageInfo)
    addRouteMiddleware('cwa-route-middleware', CwaRouteMiddleware, { global: true })
    return {
      provide: {
        cwa,
      },
    }
  },
  hooks: {},
} as ObjectPlugin<{ cwa: Cwa }>)
