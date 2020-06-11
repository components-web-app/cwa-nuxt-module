import { routeOption } from '../utils'

// I don't know whether the $cwa property will be required, but it is injected into all contexts throughout
// Nuxt/Vuejs components. This is the class at source /src/core/cwa.ts
export default async function routeLoaderMiddleware ({ route, $cwa }) {
  // Disable middleware if options: { cwa: false } is set on the route
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
