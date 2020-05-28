import { routeOption } from '../utils'

// I don't know whether the $cwa property will be required, but it is injected into all contexts throughout
// Nuxt/Vuejs components. This is the class at source /src/core/cwa.ts
export default async function routeLoaderMiddleware ({ route, $cwa }) {
  // Disable middleware if options: { cwa: false } is set on the route
  if (routeOption(route, 'cwa', false)) {
    return
  }

  $cwa.fetchRoute(route.path)

  // process.server will be true for SSR and false for Client-side

  // see /src/core/cwa.ts for axios interceptors etc.

  // we are using vulcain on the API so should also use
  // Preload http headers
  // I do not think we need to use the 'Fields' header to limit the fields returned for the resource yet, if at all
  // $axios.get('/any-path')

  // In version 1 we used an Axios interceptor setup which handled automatically calling the
  // API unless a property was set in the axios options explicitly overriding the baseUrl

  // Should we investigate cache-digest for client-side requests? https://github.com/dunglas/vulcain/blob/master/docs/cache.md#preventing-to-push-resources-already-in-cache-cache-digests-and-casper

  // A route that is redirected will return the data for the redirected page withou
  // the need to perform any further requests. It will also have a parameter redirectPath
  // so that this front-end application can update the URL to the redirected URL.
  // SSR will likely want a 301 redirect though and therefore can result in a new page load
  // for client-side, this prevents the need for an additional request

  // Just a note for later
  // Disable middleware if no route was matched to allow 404/error page
  // const matches = []
  // const Components = getMatchedComponents(ctx.route, matches)
  // if (!Components.length) {
  //   return
  // }
}
