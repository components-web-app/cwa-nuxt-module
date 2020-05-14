import { routeOption } from '../utils'

export default async function routeLoaderMiddleware ({ route }) {
  // Disable middleware if options: { cwa: false } is set on the route
  if (routeOption(route, 'cwa', false)) {
    return
  }
  console.log('will get from api')
  // $axios.get('/any-path')

  // Disable middleware if no route was matched to allow 404/error page
  // const matches = []
  // const Components = getMatchedComponents(ctx.route, matches)
  // if (!Components.length) {
  //   return
  // }
}
