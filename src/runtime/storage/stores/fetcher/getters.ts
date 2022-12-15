import { computed, ComputedRef } from 'vue'
import { ResourcesStore } from '../resources/resources-store'
import { CwaFetcherStateInterface } from './state'

export interface CwaFetcherGettersInterface {
  primaryFetchPath: ComputedRef<string|undefined>
  isFetchChainComplete: ComputedRef<(token: string) => boolean|undefined>
  isCurrentFetchingToken: ComputedRef<(token: string) => boolean|undefined>
}

export default function (fetcherState: CwaFetcherStateInterface, resourcesStoreDefinition: ResourcesStore): CwaFetcherGettersInterface {
  return {
    primaryFetchPath: computed(() => {
      const primaryFetchToken = fetcherState.primaryFetch.fetchingToken || fetcherState.primaryFetch.successToken
      if (!primaryFetchToken) {
        return
      }
      const fetchStatus = fetcherState.fetches[primaryFetchToken]
      return fetchStatus.path
    }),
    isFetchChainComplete: computed(() => {
      return (token: string) => {
        const fetchStatus = fetcherState.fetches[token]
        if (!fetchStatus) {
          return
        }
        const resources = fetchStatus.resources
        if (!resources.length) {
          return
        }

        if (fetchStatus.manifest && fetchStatus.manifest.resources === undefined && fetchStatus.manifest.error === undefined) {
          return false
        }

        const resourcesStore = resourcesStoreDefinition.useStore()
        for (const resource of resources) {
          const resourceData = resourcesStore.current.byId[resource]
          if (!resourceData) {
            throw new Error(`The resource '${resource}' does not exist but is defined in the fetch chain with token '${token}'`)
          }
          if (resourceData.apiState.status === 0) {
            return false
          }
        }
        return true
      }
    }),
    isCurrentFetchingToken: computed(() => {
      return (token: string) => {
        const fetchStatus = fetcherState.fetches[token]
        if (!fetchStatus) {
          throw new Error(`Failed to check if the token '${token}' is current. It does not exist.`)
        }
        return !fetchStatus.isPrimary || token === fetcherState.primaryFetch.fetchingToken
      }
    })
  }
}
