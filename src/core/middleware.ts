import { routeOption } from '../utils'

// I don't know whether the $cwa property will be required, but it is injected into all contexts throughout
// Nuxt/Vuejs components. This is the class at source /src/core/cwa.ts
export default async function routeLoaderMiddleware ({ route, $axios, $cwa }) {
  // Disable middleware if options: { cwa: false } is set on the route
  if (routeOption(route, 'cwa', false)) {
    return
  }
  console.log('will get response from api')
  // process.server will be true for SSR and false for Client-side

  // see /src/core/cwa.ts for axios interceptors etc.

  // we are using vulcain on the API so should also use
  // Preload http headers
  // I do not think we need to use the 'Fields' header to limit the fields returned for the resource yet, if at all
  // $axios.get('/any-path')

  // In version 1 we used an Axios interceptor setup which handled automatically calling the
  // API unless a property was set in the axios options explicitly overriding the baseUrl

  // Should we investigate cache-digest for client-side requests? https://github.com/dunglas/vulcain/blob/master/docs/cache.md#preventing-to-push-resources-already-in-cache-cache-digests-and-casper


  // Just a note for later
  // Disable middleware if no route was matched to allow 404/error page
  // const matches = []
  // const Components = getMatchedComponents(ctx.route, matches)
  // if (!Components.length) {
  //   return
  // }
}
