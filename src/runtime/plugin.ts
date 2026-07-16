import type { ObjectPlugin } from '#app/nuxt'
import { addRouteMiddleware, defineNuxtPlugin, useRouter } from '#imports'
import CwaRouteMiddleware from '#cwa/route-middleware'
import Cwa from '#cwa/cwa'
// @ts-ignore
import { options, currentModulePackageInfo } from '#build/cwa-options'

export default defineNuxtPlugin({
  name: 'cwa-plugin',
  enforce: 'post',
  dependsOn: ['pinia'],
  setup(nuxtApp) {
    const router = useRouter()
    const cwa = new Cwa(router, options, currentModulePackageInfo)
    // Nuxt sets `prerenderedAt` only when this page's HTML was prerendered at build time — the one
    // exact, clock-free signal that the hydrated resource data is a static render. See #262.
    cwa.prerendered.value = !!nuxtApp.payload.prerenderedAt
    addRouteMiddleware('cwa-route-middleware', CwaRouteMiddleware, { global: true })
    return {
      provide: {
        cwa,
      },
    }
  },
  hooks: {},
} as ObjectPlugin<{ cwa: Cwa }>)
