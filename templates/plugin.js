import routeLoaderMiddleware from '~cwa/core/middleware'
import CWA from '~cwa/core/cwa'
import Middleware from './middleware'

Middleware.routeLoader = routeLoaderMiddleware

export default function (ctx, inject) {
  const options = <%= JSON.stringify(options.options) %>
  const $cwa = new CWA(ctx, options)
  inject('cwa', $cwa)
  ctx.$cwa = $cwa

  return $cwa.init().catch(error => {
    if (process.client) {
      console.error('[ERROR] [AUTH]', error)
    }
  })
}
