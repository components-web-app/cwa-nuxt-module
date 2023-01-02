import { ComputedRef, computed } from 'vue'
import { CwaResource, CwaResourceTypes, getResourceTypeFromIri } from '../../../resources/resource-utils'
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
  resourcesApiStateIsPending: ComputedRef<boolean>
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
    resourcesApiStateIsPending: computed<boolean>(() => {
      for (const resourceState of Object.values(resourcesState.current.byId)) {
        if (resourceState.apiState.status === CwaResourceApiStatuses.IN_PROGRESS) {
          return true
        }
      }
      return false
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
