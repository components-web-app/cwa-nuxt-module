import type { RouteLocationNormalizedLoaded } from 'vue-router'
import type { PageLoadStatus } from '#cwa/resources/resources'

export function cwaPageLoadPercent(progress: PageLoadStatus, route: Pick<RouteLocationNormalizedLoaded, 'meta'>): number | undefined {
  if (route.meta.cwa?.disabled === true || !progress.resources.length) {
    return
  }
  return progress.percent
}
