import { setActivePinia, createPinia } from 'pinia'
import { addRouteMiddleware, defineNuxtPlugin } from '#app'
import CwaRouteMiddleware from '#cwa/runtime/route-middleware'
import Cwa from '#cwa/runtime/cwa'
// @ts-ignore
import { options } from '#build/cwa-options'

interface SetupInterface {
  provide: {
    cwa: Cwa
  }
}

export default defineNuxtPlugin({
  name: 'cwa-plugin',
  enforce: 'pre',
  setup (nuxtApp): SetupInterface {
    if (process.env.NODE_ENV === 'test') {
      setActivePinia(createPinia())
    }
    addRouteMiddleware('cwa', CwaRouteMiddleware, { global: true })
    return {
      provide: {
        cwa: new Cwa(nuxtApp, options)
      }
    }
  },
  hooks: {}
})
