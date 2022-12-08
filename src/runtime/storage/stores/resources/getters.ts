import { ComputedRef, computed } from 'vue'
import { CwaResourcesStateInterface } from './state'

export interface CwaResourcesGettersInterface {
  resourcesApiStateIsPending: ComputedRef<boolean>|boolean
}

export default function (resourcesState: CwaResourcesStateInterface): CwaResourcesGettersInterface {
  return {
    resourcesApiStateIsPending: computed<boolean>(() => {
      for (const resourceState of Object.values(resourcesState.current.byId)) {
        if (resourceState.apiState.status === 0) {
          return true
        }
      }
      return false
    })
  }
}
