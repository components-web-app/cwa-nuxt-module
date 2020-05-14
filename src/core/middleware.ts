import consola from 'consola'
import { routeOption } from '../utils'

export default async function routeLoaderMiddleware ({ route, redirect }) {
  consola.log('middleingwareigogo')
  return redirect('/another-page')
  // Disable middleware if options: { auth: false } is set on the route
  if (routeOption(route, 'auth', false)) {
    return
  }

  // Disable middleware if no route was matched to allow 404/error page
  // const matches = []
  // const Components = getMatchedComponents(ctx.route, matches)
  // if (!Components.length) {
  //   return
  // }
}
