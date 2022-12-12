import { addRouteMiddleware, defineNuxtPlugin } from '#app'
import CwaRouteMiddleware from '@cwa/nuxt-module/runtime/route-middleware'
import Cwa from '@cwa/nuxt-module/runtime/cwa'
import { CwaModuleOptions } from '@cwa/nuxt-module/module'

export default defineNuxtPlugin((nuxtApp) => {
  // @ts-ignore
  const options: CwaModuleOptions = <%= JSON.stringify(options) %>

  addRouteMiddleware('cwa', CwaRouteMiddleware, { global: true })

  return {
    provide: {
      cwa: new Cwa(nuxtApp, options)
    }
  }
})
