import Vue from 'vue'
import { StoreCategories } from '../../../storage'

export function DeleteResource(state, payload) {
  const doDeleteResource = (state, payload) => {
    ;['new', 'current'].forEach((stateName) => {
      const resourceState = state.resources[stateName]
      if (!resourceState) {
        return
      }
      const namedResources = resourceState[payload.name]
      if (!namedResources) {
        return
      }

      const allIdsIndex = namedResources.allIds.indexOf(payload.id)
      if (allIdsIndex !== -1) {
        // Delete positions if a component
        // Should this really be done here??
        // Or should this be the responsibility of the task that is deleting a resource...
        // will positions actually be deleted?? We can't guarantee that can we, so
        // by doing this we are making assumptions...
        if (payload.category === StoreCategories.Component) {
          const componentPositions =
            namedResources.byId[payload.id]?.componentPositions
          if (componentPositions) {
            componentPositions.forEach((positionIri) => {
              doDeleteResource(state, {
                id: positionIri,
                name: 'ComponentPosition',
                category: 'Default'
              })
            })
          }
        }

        // Delete from id mapping table
        namedResources.allIds.splice(allIdsIndex, 1)
        if (namedResources.currentIds) {
          const currentIdsIndex = namedResources.currentIds.indexOf(payload.id)
          if (currentIdsIndex !== -1) {
            namedResources.currentIds.splice(currentIdsIndex, 1)
          }
        }

        // Delete from draft mapping if either no longer exists
        // for (const [key, value] of Object.entries(
        //   state.resources.draftMapping
        // )) {
        //   if (key === payload.id || value === payload.id) {
        //     Vue.delete(state.resources.draftMapping, payload.id)
        //   }
        // }

        Vue.delete(namedResources.byId, payload.id)
      }
    })
  }
  doDeleteResource(state, payload)
}

export default DeleteResource
