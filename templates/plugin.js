import consola from 'consola'
import routeLoaderMiddleware from '@cwa/nuxt-module/core/middleware'
import CWA from '@cwa/nuxt-module/core/cwa'
import Middleware from '../middleware'

Middleware.routeLoader = routeLoaderMiddleware

export default function (ctx, inject) {
  const options = <%= JSON.stringify(options.options) %>
  const $cwa = new CWA(ctx, options)
  inject('cwa', $cwa)
  ctx.$cwa = $cwa

  return $cwa.init().catch(error => {
    consola.error('[ERROR] [CWA]', error)
  })
}
