import type { ComputedRef } from 'vue'
import { computed } from 'vue'
import {

  CwaResourceTypes,
  getPublishedResourceState,
  getResourceTypeFromIri,
  resourceTypeToNestedResourceProperties,
} from '../../../resources/resource-utils'
import type { CwaResource } from '../../../resources/resource-utils'
import type { FetchStatus } from '../fetcher/state'
import {

  CwaResourceApiStatuses,

  NEW_RESOURCE_IRI,
} from './state'
import type { CwaCurrentResourceInterface, CwaResourcesStateInterface } from './state'
import { ResourcesGetterUtils } from './getter-utils'
import type { AddResourceEvent } from '#cwa/runtime/admin/resource-stack-manager'

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
  getOrderedPositionsForGroup: ComputedRef<(groupIri: string, includeNewIri?: boolean) => string[] | undefined>
  getPositionSortDisplayNumber: ComputedRef<(groupIri: string, includeNewIri?: boolean) => number | undefined>
  getResource: ComputedRef<(iri: string) => CwaCurrentResourceInterface | undefined>
  getChildIris: ComputedRef<(iri: string, addResourceEvent: undefined | AddResourceEvent) => string[]>
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

  function findIsPublishedByIri(iri: string) {
    const resource = resourcesState.current.byId?.[iri]
    if (!resource) {
      return false
    }
    const publishedState = getPublishedResourceState(resource)
    return publishedState === undefined ? true : publishedState
  }

  const getOrderedPositionsForGroup = computed(() => {
    return (groupIri: string, includeNewIri: boolean = true) => {
      const groupResource = resourcesState.current.byId?.[groupIri]
      const positions: string[] | undefined = groupResource.data?.componentPositions
      if (!positions) {
        return
      }
      // remove the temporary resource
      const positionResources = positions
        .filter((iri: string) => !iri.endsWith(NEW_RESOURCE_IRI))
        .map((iri: string) => resourcesState.current.byId?.[iri]?.data)

      const resourcesThatExist: CwaResource[] = positionResources.filter((resource: CwaResource | undefined) => resource !== undefined)

      const getSortNumber = (res: CwaResource | undefined) => {
        if (res?._metadata.sortDisplayNumber !== undefined) {
          return res._metadata.sortDisplayNumber
        }
        return res?.sortValue || 0
      }

      const orderedWithoutTemp = resourcesThatExist
        .sort((a: CwaResource, b: CwaResource) => {
          const sortA = getSortNumber(a)
          const sortB = getSortNumber(b)
          return sortA === sortB ? 0 : (sortA > sortB ? 1 : -1)
        })
        .map((resource: CwaResource) => {
          return resource['@id']
        })
      if (includeNewIri) {
        const newIriPositions = positions.filter((iri: string) => iri.endsWith(NEW_RESOURCE_IRI))
        if (newIriPositions.length) {
          for (const newIriPosition of newIriPositions) {
            const newPositionSortNumber = resourcesState.current.byId?.[newIriPosition]?.data?._metadata?.sortDisplayNumber

            newPositionSortNumber !== undefined && orderedWithoutTemp.splice(newPositionSortNumber - 1, 0, newIriPosition)
          }
        }
      }
      return orderedWithoutTemp
    }
  })

  const getChildIris = computed(() => {
    return (iri: string, addResourceEvent: undefined | AddResourceEvent) => {
      const childIris: string[] = []
      // New resources will not have any children mounting inside it
      if (iri === NEW_RESOURCE_IRI) {
        return childIris
      }

      // No resource, no children
      const resource = resourcesState.current.byId?.[iri]

      if (!resource) {
        // resource may not be found if just deleted...
        // consola.warn(`Could not get children for '${iri}' - Resource not found`)
        return childIris
      }

      // No resource type, we cannot calculate the properties which will count as children
      const resourceType = getResourceTypeFromIri(iri)
      if (!resourceType) {
        return childIris
      }

      // There can be a placeholder in the positions and groups which should count as children
      if (
        resourceType === CwaResourceTypes.COMPONENT_POSITION
        || resourceType === CwaResourceTypes.COMPONENT_GROUP
      ) {
        childIris.push(`${iri}_placeholder`)
      }

      // is this is a component position and there is a new resource being added within it, then the new resource is a child
      if (addResourceEvent) {
        if (
          resourceType === CwaResourceTypes.COMPONENT_POSITION
          && addResourceEvent.closest.position === iri
          && addResourceEvent.targetIri === iri
          && addResourceEvent.addAfter === null
        ) {
          childIris.push(NEW_RESOURCE_IRI)
        }

        if (
          resourceType === CwaResourceTypes.COMPONENT_GROUP
          && addResourceEvent.closest.group === iri
        ) {
          const childIri = `/_/component_positions/${NEW_RESOURCE_IRI}`
          childIris.push(childIri)
          childIris.push(...getChildIris.value(childIri, addResourceEvent))
        }
      }

      // get the known properties for the resource type to hold children in the known structure
      const propertiesWithChildIris = resourceTypeToNestedResourceProperties[resourceType]
      for (const propWithChildIri of propertiesWithChildIris) {
        const children: string | string[] = resource.data?.[propWithChildIri]
        if (!children) {
          continue
        }

        // detach the array from any object it is within
        const childrenAsArray = Array.isArray(children) ? [...children] : [children]

        for (const child of childrenAsArray) {
          childIris.push(child)
          childIris.push(...getChildIris.value(child, addResourceEvent))
        }
      }

      return childIris
    }
  })

  const findAllPublishableIris = computed(() => {
    return (iri: string) => {
      const iris = [iri]
      const relatedIri = draftToPublishedIris.value[iri] || publishedToDraftIris.value[iri]
      if (relatedIri) iris.push(relatedIri)
      return iris
    }
  })

  return {
    getOrderedPositionsForGroup,
    getPositionSortDisplayNumber: computed(() => {
      return (positionIri: string, includeNewIri: boolean = true) => {
        const positionResource = resourcesState.current.byId?.[positionIri]?.data
        if (!positionResource) {
          return
        }
        const groupIri = positionResource.componentGroup
        if (!groupIri) {
          return
        }
        const orderedPositions = getOrderedPositionsForGroup.value(groupIri, includeNewIri)
        if (!orderedPositions) {
          return
        }
        const index = orderedPositions.indexOf(positionIri)
        if (index === -1) {
          return
        }
        return index + 1
      }
    }),
    getResource: computed(() => {
      return (id: string) => {
        return resourcesState.current.byId?.[id]
      }
    }),
    getChildIris,
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
    findAllPublishableIris,
    resourcesByType: computed<ResourcesByTypeInterface>(() => {
      const resources: ResourcesByTypeInterface = {
        [CwaResourceTypes.ROUTE]: [],
        [CwaResourceTypes.PAGE]: [],
        [CwaResourceTypes.PAGE_DATA]: [],
        [CwaResourceTypes.LAYOUT]: [],
        [CwaResourceTypes.COMPONENT_GROUP]: [],
        [CwaResourceTypes.COMPONENT_POSITION]: [],
        [CwaResourceTypes.COMPONENT]: [],
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
            // the resource that was fetched previously may have now been deleted and removed from the store.
            continue
            // throw new Error(`The resource '${resource}' does not exist.`)
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
      }
      else {
        percent = Math.round((complete / total) * 100)
      }
      return {
        pending,
        complete,
        total,
        percent,
      }
    }),
  }
}
