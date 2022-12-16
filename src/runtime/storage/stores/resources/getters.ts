import { ComputedRef, computed } from 'vue'
import { CwaResourceApiStatuses, CwaResourcesStateInterface } from './state'

export interface CwaResourcesGettersInterface {
  totalResourcesPending: ComputedRef<number>
  resourcesApiStateIsPending: ComputedRef<boolean>
}

export default function (resourcesState: CwaResourcesStateInterface): CwaResourcesGettersInterface {
  return {
    totalResourcesPending: computed<number>(() => {
      return resourcesState.current.currentIds.reduce((count, id) => {
        if (resourcesState.current.byId[id].apiState.status === CwaResourceApiStatuses.IN_PROGRESS) {
          return ++count
        }
        return count
      }, 0)
    }),
    resourcesApiStateIsPending: computed<boolean>(() => {
      for (const resourceState of Object.values(resourcesState.current.byId)) {
        if (resourceState.apiState.status === CwaResourceApiStatuses.IN_PROGRESS) {
          return true
        }
      }
      return false
    })
  }
}
