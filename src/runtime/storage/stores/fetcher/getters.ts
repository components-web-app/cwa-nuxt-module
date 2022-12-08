import { ComputedRef, computed } from 'vue'
import { CwaFetcherStateInterface } from './state'

export interface CwaFetcherGettersInterface {
  inProgress: ComputedRef<boolean>
}

export default function (fetcherState: CwaFetcherStateInterface): CwaFetcherGettersInterface {
  return {
    inProgress: computed<boolean>(() => {
      return fetcherState.status.fetch.path !== undefined
    })
  }
}
