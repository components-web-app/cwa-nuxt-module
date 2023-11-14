import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import { CwaResourceTypes, getPublishedResourceState, getResourceTypeFromIri } from '../../../resources/resource-utils'
import type { FetchStatus } from '../fetcher/state'
import type { CwaCurrentResourceInterface, CwaResourcesStateInterface } from './state'
import { CwaResourceApiStatuses } from './state'
import { ResourcesGetterUtils } from './getter-utils'

export interface ResourcesLoadStatusInterface {
  pending: number
  complete: number
  total: number
  percent: number
}

type ResourcesByTypeInterface = {
  [T in CwaResourceTypes]: CwaCurrentResourceInterface[];
}

interface PublishableMapping {
  [key: string]: string
}

export interface CwaResourcesGettersInterface {
  hasNewResources: ComputedRef<boolean>
  findPublishedComponentIri: ComputedRef<(iri: string) => string | undefined>
  findDraftComponentIri: ComputedRef<(iri: string) => string | undefined>
  publishedToDraftIris: ComputedRef<PublishableMapping>
  draftToPublishedIris: ComputedRef<PublishableMapping>
  isIriPublishableEquivalent: ComputedRef<(oldIri: string, newIri: string) => boolean>
  findAllPublishableIris: ComputedRef<(iri: string) => string[]>
  resourcesByType: ComputedRef<ResourcesByTypeInterface>
  totalResourcesPending: ComputedRef<number>
  currentResourcesApiStateIsPending: ComputedRef<boolean>
  resourcesApiStateIsPending: ComputedRef<(resources: string[]) => boolean>
  isFetchStatusResourcesResolved: ComputedRef<(fetchStatus: FetchStatus) => boolean>
  resourceLoadStatus: ComputedRef<ResourcesLoadStatusInterface>
}

export default function (resourcesState: CwaResourcesStateInterface): CwaResourcesGettersInterface {
  const utils = new ResourcesGetterUtils(resourcesState)

  const publishedToDraftIris = computed(() => (
    resourcesState.current.publishableMapping.reduce((obj, mapping) => {
      obj[mapping.publishedIri] = mapping.draftIri
      return obj
    }, {} as PublishableMapping)
  ))

  const draftToPublishedIris = computed(() => (
    resourcesState.current.publishableMapping.reduce((obj, mapping) => {
      obj[mapping.draftIri] = mapping.publishedIri
      return obj
    }, {} as PublishableMapping)
  ))

  function findIsPublishedByIri (iri: string) {
    const resource = resourcesState.current.byId?.[iri]
    if (!resource) {
      return false
    }
    const publishedState = getPublishedResourceState(resource)
    return publishedState === undefined ? true : publishedState
  }

  return {
    hasNewResources: computed(() => resourcesState.new.allIds.length > 0),
    findPublishedComponentIri: computed(() => {
      return (iri: string) => {
        const isPublished = findIsPublishedByIri(iri)
        if (isPublished === undefined) {
          return
        }
        if (isPublished) {
          return iri
        }
        return draftToPublishedIris.value[iri]
      }
    }),
    findDraftComponentIri: computed(() => {
      return (iri: string) => {
        const isPublished = findIsPublishedByIri(iri)
        if (isPublished === undefined) {
          return
        }
        if (!isPublished) {
          return iri
        }
        return publishedToDraftIris.value[iri]
      }
    }),
    publishedToDraftIris,
    draftToPublishedIris,
    isIriPublishableEquivalent: computed(() => {
      return (oldIri: string, newIri: string) => {
        return [publishedToDraftIris.value[oldIri], draftToPublishedIris.value[oldIri]].includes(newIri)
      }
    }),
    findAllPublishableIris: computed(() => {
      return (iri: string) => {
        const iris = [iri]
        const relatedIri = draftToPublishedIris.value[iri] || publishedToDraftIris.value[iri]
        relatedIri && iris.push(relatedIri)
        return iris
      }
    }),
    resourcesByType: computed<ResourcesByTypeInterface>(() => {
      const resources: ResourcesByTypeInterface = {
        [CwaResourceTypes.ROUTE]: [],
        [CwaResourceTypes.PAGE]: [],
        [CwaResourceTypes.PAGE_DATA]: [],
        [CwaResourceTypes.LAYOUT]: [],
        [CwaResourceTypes.COMPONENT_GROUP]: [],
        [CwaResourceTypes.COMPONENT_POSITION]: [],
        [CwaResourceTypes.COMPONENT]: []
      }
      for (const iri of resourcesState.current.allIds) {
        const type = getResourceTypeFromIri(iri)
        const resource = resourcesState.current.byId[iri]
        if (!type || !resource) {
          continue
        }
        resources[type].push(resource)
      }
      return resources
    }),
    totalResourcesPending: computed<number>(() => utils.totalResourcesPending),
    currentResourcesApiStateIsPending: computed<boolean>(() => {
      return utils.resourcesApiStateIsPending(Object.keys(resourcesState.current.byId))
    }),
    resourcesApiStateIsPending: computed(() => {
      return (resources: string[]) => utils.resourcesApiStateIsPending(resources)
    }),
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
          if (resourceData.data?.['@type'] === CwaResourceTypes.COMPONENT_POSITION && resourceData.apiState.headers?.path !== fetchStatus.path) {
            return false
          }
        }

        return true
      }
    }),
    resourceLoadStatus: computed(() => {
      const pending = utils.totalResourcesPending
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
