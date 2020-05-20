import { routeOption } from '../utils'

export default async function routeLoaderMiddleware ({ route }) {
  // Disable middleware if options: { cwa: false } is set on the route
  if (routeOption(route, 'cwa', false)) {
    return
  }
  console.log('will get response from api')
  // API_URL
  // e.g. https://api.website.com/

  // Must use VERCEL_GITLAB_COMMIT_REF with the API url to determine which API endpoint we should be using.
  // Where VERCEL_GITLAB_COMMIT_REF is 'dev' the endpoint would be
  // https://dev-review.api.website.com/

  // we are using vulcain on the API so should also use
  // Preload http headers
  // I do not think we need to use the 'Fields' header to limit the fields returned for the resource yet, if at all
  // $axios.get('/any-path')

  // In version 1 we used an Axios interceptor setup which handled automatically calling the
  // API unless a property was set in the axios options explicitly overriding the baseUrl.
  // The axios interceptors also handled refresh tokens

  // Should we investigate cache-digest? https://github.com/dunglas/vulcain/blob/master/docs/cache.md#preventing-to-push-resources-already-in-cache-cache-digests-and-casper



  // Disable middleware if no route was matched to allow 404/error page
  // const matches = []
  // const Components = getMatchedComponents(ctx.route, matches)
  // if (!Components.length) {
  //   return
  // }
}
