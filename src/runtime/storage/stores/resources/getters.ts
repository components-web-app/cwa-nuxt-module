import { ComputedRef, computed } from 'vue'
import { CwaResource, CwaResourceTypes, getResourceTypeFromIri } from '../../../resources/resource-utils'
import { FetchStatus } from '../fetcher/state'
import { CwaResourceApiStatuses, CwaResourcesStateInterface } from './state'

interface ResourcesLoadStatusInterface {
  pending: number
  complete: number
  total: number
  percent: number
}

type ResourcesByTypeInterface = {
  [T in CwaResourceTypes]: CwaResource[];
}

export interface CwaResourcesGettersInterface {
  resourcesByType: ComputedRef<ResourcesByTypeInterface>
  totalResourcesPending: ComputedRef<number>
  currentResourcesApiStateIsPending: ComputedRef<boolean>
  isFetchStatusResourcesResolved: ComputedRef<(fetchStatus: FetchStatus) => boolean>,
  resourcesApiStateIsPending: ComputedRef<(resources: string[]) => boolean>
  resourceLoadStatus: ComputedRef<ResourcesLoadStatusInterface>
}

export default function (resourcesState: CwaResourcesStateInterface): CwaResourcesGettersInterface {
  const totalResourcesPending = computed<number>(() => {
    return resourcesState.current.currentIds.reduce((count, id) => {
      if (resourcesState.current.byId[id].apiState.status === CwaResourceApiStatuses.IN_PROGRESS) {
        return ++count
      }
      return count
    }, 0)
  })

  return {
    resourcesByType: computed(() => {
      const resources: ResourcesByTypeInterface = {
        [CwaResourceTypes.ROUTE]: [],
        [CwaResourceTypes.PAGE]: [],
        [CwaResourceTypes.PAGE_DATA]: [],
        [CwaResourceTypes.LAYOUT]: [],
        [CwaResourceTypes.COMPONENT_GROUP]: [],
        [CwaResourceTypes.COMPONENT_POSITION]: [],
        [CwaResourceTypes.COMPONENT]: []
      }
      for (const iri of resourcesState.current.currentIds) {
        const type = getResourceTypeFromIri(iri)
        if (!type) {
          continue
        }
        resources[type].push(resourcesState.current.byId[iri].data)
      }
      return resources
    }),
    totalResourcesPending,
    currentResourcesApiStateIsPending: computed<boolean>(() => {
      for (const resourceState of Object.values(resourcesState.current.byId)) {
        if (resourceState.apiState.status === CwaResourceApiStatuses.IN_PROGRESS) {
          return true
        }
      }
      return false
    }),
    // todo: test
    isFetchStatusResourcesResolved: computed(() => {
      return (fetchStatus: FetchStatus) => {
        // can check to ensure the main fetch path is successful
        const resourceData = resourcesState.current.byId[fetchStatus.path]
        // Any errors for the primary resource should result in a re-fetch. In progress handled below
        if (!resourceData || resourceData.apiState.status === CwaResourceApiStatuses.ERROR) {
          return false
        }

        for (const resource of fetchStatus.resources) {
          const resourceData = resourcesState.current.byId[resource]
          if (!resourceData) {
            throw new Error(`The resource '${resource}' does not exist.`)
          }

          // Some errored results still class as successful. In fact, only server errors are really unsuccessful and would warrant a re-fetch
          if (resourceData.apiState.status === CwaResourceApiStatuses.ERROR) {
            const lastStatusCode = resourceData.apiState.error?.statusCode
            if ((!lastStatusCode || lastStatusCode >= 500)) {
              return false
            }
            continue
          }

          // in progress and never been successful
          if (resourceData.apiState.status === CwaResourceApiStatuses.IN_PROGRESS && !resourceData.data) {
            return false
          }

          // component positions can be dynamic and different depending on the path
          if (resourceData.data['@type'] === CwaResourceTypes.COMPONENT_POSITION && resourceData.apiState.headers?.path !== fetchStatus.path) {
            return false
          }
        }

        return true
      }
    }),
    // todo: test
    resourcesApiStateIsPending: computed(() => {
      return (resources: string[]) => {
        for (const resource of resources) {
          const resourceData = resourcesState.current.byId[resource]
          if (!resourceData) {
            // resources should all be initialised with an api state even if no data
            throw new Error(`The resource '${resource}' does not exist.`)
          }

          if (resourceData.apiState.status === CwaResourceApiStatuses.IN_PROGRESS) {
            return true
          }
        }
        return false
      }
    }),
    resourceLoadStatus: computed(() => {
      const pending = totalResourcesPending.value
      const total = resourcesState.current.currentIds.length
      const complete = total - pending
      let percent
      if (complete === 0) {
        percent = total === 0 ? 100 : 0
      } else {
        percent = Math.round((complete / total) * 100)
      }
      return {
        pending,
        complete,
        total,
        percent
      }
    })
  }
}
