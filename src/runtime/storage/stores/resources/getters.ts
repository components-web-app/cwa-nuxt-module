import { ComputedRef, computed } from 'vue'
import { CwaResourceApiStatuses, CwaResourcesStateInterface } from './state'

interface ResourcesLoadStatusInterface {
  pending: number
  complete: number
  total: number
  percent: number
}

export interface CwaResourcesGettersInterface {
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
