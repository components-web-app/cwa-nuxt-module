import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import type { CwaErrorEvent, CwaErrorStateInterface } from './state'

export interface CwaErrorsGettersInterface {
  hasErrors: ComputedRef<boolean>
  getErrors: ComputedRef<CwaErrorEvent[]>
}

export default function (resourcesState: CwaErrorStateInterface): CwaErrorsGettersInterface {
  return {
    hasErrors: computed<boolean>(() => {
      return resourcesState.allIds.length > 0
    }),
    getErrors: computed<CwaErrorEvent[]>(() => {
      return resourcesState.allIds.map(e => resourcesState.byId[e])
    })
  }
}
