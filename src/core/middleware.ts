import { routeOption } from '../utils'

export default async function routeLoaderMiddleware ({ route, $cwa }) {
  // Disable middleware if `{options: { cwa: false }}` or `{cwa: false}` is set on the route
  if (routeOption(route, 'cwa', false)) {
    return
  }

  try {
    await $cwa.fetchRoute(route.path)
  } catch (err) {
    $cwa.withError(route, err)
    return null
  }

  // Re initialise on every route
  // Plugin will initialise first load on client side
  if (process.client) {
    $cwa.initMercure()
  }
}
