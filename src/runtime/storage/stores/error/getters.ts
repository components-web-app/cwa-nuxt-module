import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import type { CwaErrorEvent, CwaErrorStateInterface } from './state'

export interface CwaErrorsGettersInterface {
  hasErrors: ComputedRef<boolean>
  getErrors: ComputedRef<CwaErrorEvent[]>
}

export default function (errorsState: CwaErrorStateInterface): CwaErrorsGettersInterface {
  return {
    hasErrors: computed<boolean>(() => {
      return errorsState.allIds.length > 0
    }),
    getErrors: computed<CwaErrorEvent[]>(() => {
      return errorsState.allIds.map(e => errorsState.byId[e])
    }),
  }
}
