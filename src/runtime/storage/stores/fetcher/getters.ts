import { computed, ComputedRef } from 'vue'
import { ResourcesStore } from '../resources/resources-store'
import { CwaFetcherStateInterface } from './state'

export interface CwaFetcherGettersInterface {
  isFetchChainComplete: ComputedRef<(token: string) => boolean|undefined>
  isFetchStatusCurrent: ComputedRef<(token: string) => boolean|undefined>
}

export default function (fetcherState: CwaFetcherStateInterface, resourcesStoreDefinition: ResourcesStore): CwaFetcherGettersInterface {
  return {
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
        const resourcesStore = resourcesStoreDefinition.useStore()
        for (const resource of resources) {
          const resourceData = resourcesStore.current.byId[resource]
          if (!resourceData) {
            throw new Error(`The resource in the fetcher '${resource}' chain has not been initialised in the resources store`)
          }
          if (resourceData.apiState.status === 0) {
            return false
          }
        }
        return true
      }
    }),
    isFetchStatusCurrent: computed(() => {
      return (token: string) => {
        const fetchStatus = fetcherState.fetches[token]
        return !fetchStatus.isPrimary || token === fetcherState.primaryFetch.fetchingToken
      }
    })
  }
}
