import { ComputedRef, computed } from 'vue'
import { CwaFetcherStateInterface } from './state'

export interface CwaFetcherGettersInterface {
  inProgress: ComputedRef<boolean>
  manifestInProgress: ComputedRef<(manifestPath: string) => boolean>
  manifestsInProgress: ComputedRef<boolean>
}

export default function (fetcherState: CwaFetcherStateInterface): CwaFetcherGettersInterface {
  return {
    inProgress: computed(() => {
      if (fetcherState.status.fetch === undefined) {
        return false
      }
      return fetcherState.status.fetch.success === undefined
    }),
    manifestInProgress: computed(() => {
      return (manifestPath: string): boolean => {
        const currentManifestStatus = fetcherState.manifests[manifestPath]
        if (!currentManifestStatus) {
          return false
        }
        return currentManifestStatus.inProgress
      }
    }),
    manifestsInProgress: computed(() => {
      for (const manifestStatus of Object.values(fetcherState.manifests)) {
        if (manifestStatus.inProgress) {
          return true
        }
      }
      return false
    })
  }
}
