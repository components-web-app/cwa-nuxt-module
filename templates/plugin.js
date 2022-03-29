import routeLoaderMiddleware from '@cwa/nuxt-module/core/middleware'
import CWA from '@cwa/nuxt-module/core/cwa'
import Middleware from '../middleware'

Middleware.cwa = routeLoaderMiddleware

export default function (ctx, inject) {
  const options = <%= JSON.stringify(options.options) %>
  const $cwa = new CWA(ctx, options)

  ctx.$cwa = $cwa
  inject('cwa', $cwa)

  return $cwa
}
