import consola from 'consola'
import Vue from 'vue'

export function SetCurrentRoute(state, id) {
  const routeResources = state.resources.current.Route
  const defaultWarning = `Could not set loaded route to '${id}':`
  if (routeResources === undefined) {
    if (id !== null) {
      consola.warn(`${defaultWarning} no routes have been loaded`)
    }
    return
  }
  if (id === null) {
    Vue.set(routeResources, 'current', null)
    consola.debug('Loaded route unset')
    return
  }

  if (!routeResources.allIds.includes(id)) {
    consola.warn(`${defaultWarning} does not exist`)
    return
  }
  Vue.set(routeResources, 'current', id)
  consola.debug('Loaded route set:', id)
}

export default SetCurrentRoute
