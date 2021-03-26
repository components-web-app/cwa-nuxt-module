import { cwaRouteDisabled, routeOption } from '../utils'
import DebugTimer from '../utils/DebugTimer'

// I don't know whether the $cwa property will be required, but it is injected into all contexts throughout
// Nuxt/Vuejs components. This is the class at source /src/core/cwa.ts
export default async function routeLoaderMiddleware({ route, $cwa }) {
  const pageParam = routeOption(route, 'pageIriParam')
  if (pageParam) {
    try {
      await $cwa.fetcher.fetchPage(decodeURIComponent(route.params[pageParam]))
    } catch (err) {
      $cwa.withError(route, err)
    }
    return
  }

  // Disable middleware if options: { cwa: false } is set on the route
  if (cwaRouteDisabled(route)) {
    return
  }

  const timer = new DebugTimer()
  timer.start('CWA middleware')

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

  timer.end('CWA middleware')
  timer.print()
}
