import { ComputedRef, computed } from 'vue'
import { CwaFetcherStateInterface } from './state'

export interface CwaFetcherGettersInterface {
  inProgress: ComputedRef<boolean>
}

export default function (fetcherState: CwaFetcherStateInterface): CwaFetcherGettersInterface {
  return {
    inProgress: computed<boolean>(() => {
      if (fetcherState.status.fetch === undefined) {
        return false
      }
      return fetcherState.status.fetch.success === undefined
    })
  }
}
