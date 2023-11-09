import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import type { CwaErrorEvent, CwaErrorStateInterface } from './state'

export interface CwaErrorsGettersInterface {
  hasErrors: ComputedRef<boolean>
  getLastError: ComputedRef<CwaErrorEvent | null>
  getErrors: ComputedRef<CwaErrorEvent[]>
}

export default function (resourcesState: CwaErrorStateInterface): CwaErrorsGettersInterface {
  return {
    hasErrors: computed<boolean>(() => {
      return resourcesState.lastErrorId !== null
    }),
    getLastError: computed<CwaErrorEvent | null>(() => {
      if (resourcesState.lastErrorId === null) {
        return null
      }

      return resourcesState.byId[resourcesState.lastErrorId]
    }),
    getErrors: computed<CwaErrorEvent[]>(() => {
      return resourcesState.allIds.map(e => resourcesState.byId[e])
    })
  }
}
