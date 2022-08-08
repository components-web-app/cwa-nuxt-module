import Vue from 'vue'
import { resourcesState } from '@cwa/nuxt-module/core/storage'

export function MergeNewResources(state) {
  for (const [resourceName, { byId }] of Object.entries(
    state.resources.new
  ) as [string, resourcesState][]) {
    for (const [resourceId, newResource] of Object.entries(byId)) {
      Vue.set(
        state.resources.current[resourceName].byId,
        resourceId,
        newResource
      )

      const maintainedIdentifierKeys = ['allIds', 'currentIds']
      for (const idKey of maintainedIdentifierKeys) {
        if (
          !state.resources.current[resourceName][idKey].includes(resourceId)
        ) {
          state.resources.current[resourceName][idKey].push(resourceId)
        }
      }
    }
    Vue.delete(state.resources.new, resourceName)
  }
}

export default MergeNewResources
