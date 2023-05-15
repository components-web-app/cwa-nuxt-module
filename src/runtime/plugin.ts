import { addRouteMiddleware, defineNuxtPlugin } from '#app'
import { createPinia, setActivePinia } from 'pinia';
import CwaRouteMiddleware from '@cwa/nuxt-module/runtime/route-middleware'
import Cwa from '@cwa/nuxt-module/runtime/cwa'
import { options } from '#build/cwa-options'

export default defineNuxtPlugin({
  name: 'cwa-plugin',
  enforce: 'pre',
  setup (nuxtApp) {
    if (process.env.NODE_ENV === 'test') {
      const pinia = createPinia();
      nuxtApp.vueApp.use(pinia);
      setActivePinia(pinia);
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
