import type {
  CwaResource,
} from '../../../resources/resource-utils'
import {
  CwaResourceTypes, getPublishedResourceState,
  getResourceTypeFromIri,
  isCwaResourceSame,
} from '../../../resources/resource-utils'
import type { CwaResourceError } from '../../../errors/cwa-resource-error'
import type { CwaFetchRequestHeaders } from '../../../api/fetcher/fetcher'
import type {
  CwaCurrentResourceInterface,
  CwaResourceApiStateGeneral,
  CwaResourcesStateInterface,
} from './state'
import {
  CwaResourceApiStatuses, NEW_RESOURCE_IRI,
} from './state'
import type { CwaResourcesGettersInterface } from './getters'
import { showError } from '#app'
import type { AddResourceEvent } from '#cwa/runtime/admin/resource-stack-manager'

export interface SaveResourceEvent { resource: CwaResource, isNew?: undefined | false }
export interface SaveNewResourceEvent { resource: CwaResource, isNew: true, path: string | undefined }

export interface DeleteResourceEvent { resource: string, noCascade?: boolean }

export interface SetResourceInProgressStatusEvent {
  iri: string
  path: string
  isComplete: false
}
export interface SetResourceCompletedStatusEvent {
  iri: string
  path?: string
  isComplete: true
  headers: CwaFetchRequestHeaders
}
export interface SetResourceResetStatusEvent {
  iri: string
  path?: undefined
  isComplete: null
}
declare type SetResourceStatusEvent = SetResourceInProgressStatusEvent | SetResourceCompletedStatusEvent | SetResourceResetStatusEvent

export interface SetResourceFetchErrorEvent { iri: string, error?: CwaResourceError, isCurrent?: boolean, showErrorPage?: boolean }

interface InitResourceEvent {
  iri: string
  resourcesState: CwaResourcesStateInterface
  isCurrent: boolean
}

export interface CwaResourcesActionsInterface {
  resetNewResource (): void
  initNewResource (addResourceEvent: AddResourceEvent, resourceType: string, endpoint: string, isPublishable: boolean, instantAdd: boolean, defaultData?: { [key: string]: any }): void
  resetCurrentResources (currentIds?: string[]): void
  clearResources (): void
  setResourceFetchStatus (event: SetResourceStatusEvent): void
  setResourceFetchError (event: SetResourceFetchErrorEvent): void
  saveResource(event: SaveResourceEvent | SaveNewResourceEvent): void
  deleteResource(event: DeleteResourceEvent): void
  mergeNewResources(): void
}

export default function (resourcesState: CwaResourcesStateInterface, resourcesGetters: CwaResourcesGettersInterface): CwaResourcesActionsInterface {
  function initResource({ iri, resourcesState, isCurrent }: InitResourceEvent): CwaCurrentResourceInterface {
    if (!resourcesState.current.byId[iri]) {
      resourcesState.current.byId[iri] = {
        apiState: {
          status: undefined,
        },
      }
    }
    if (!resourcesState.current.allIds.includes(iri)) {
      resourcesState.current.allIds.push(iri)
    }
    if (isCurrent && !resourcesState.current.currentIds.includes(iri)) {
      resourcesState.current.currentIds.push(iri)
    }
    return resourcesState.current.byId[iri]
  }

  function deleteResource(event: DeleteResourceEvent): void {
    const resource = resourcesState.current.byId[event.resource]
    if (!resource) {
      return
    }
    const resourceType = getResourceTypeFromIri(event.resource)

    switch (resourceType) {
      case CwaResourceTypes.COMPONENT_POSITION: {
        if (event.noCascade) {
          break
        }
        // remove a component position from all component groups
        const componentGroups = resourcesGetters.resourcesByType.value[CwaResourceTypes.COMPONENT_GROUP]
        for (const componentGroup of Object.values(componentGroups)) {
          const componentPositions = componentGroup.data?.componentPositions
          const positionIndex = componentPositions.indexOf(event.resource)
          if (positionIndex !== -1) {
            componentPositions.splice(positionIndex, 1)
          }
        }
        clearPositionToComponentMapping(event.resource)
        break
      }
      case CwaResourceTypes.COMPONENT: {
        if (!resource.data || event.noCascade) {
          break
        }

        const alternativeVersions = resourcesGetters.findAllPublishableIris.value(event.resource)
        const hasAlternativeVersion = alternativeVersions.length > 1
        const mappedPositions = [...(resource.data.componentPositions || []), ...(resourcesState.current.positionsByComponent[event.resource] || [])]
        if (hasAlternativeVersion) {
          // nice to do even if we are refreshing the resource from the API to prevent possible delay and flickers?
          const otherVersions = alternativeVersions.filter(altIri => altIri !== (event.resource))
          if (otherVersions.length) {
            const newPositionIri = otherVersions[0]
            for (const positionIri of mappedPositions) {
              const positionResource = resourcesState.current.byId[positionIri]
              if (!positionResource?.data) {
                continue
              }
              positionResource.data.component = newPositionIri
            }
          }
        }
        else {
          for (const positionIri of mappedPositions) {
            const positionResource = resourcesState.current.byId[positionIri]
            if (!positionResource?.data) {
              continue
            }
            if (!positionResource.data.pageDataProperty) {
              // if we are deleting a component because it has been replaced by a live, we should not be deleting the
              // position, it will be being refreshed
              deleteResource({
                resource: positionIri,
              })
            }
            else if (positionResource.data.component === event.resource) {
              delete positionResource.data.component
            }
          }
        }

        clearPublishableMapping(event.resource)
        clearPositionToComponentMapping(event.resource)
        break
      }
    }

    const allIdsIndex = resourcesState.current.allIds.indexOf(event.resource)

    allIdsIndex !== -1 && resourcesState.current.allIds.splice(allIdsIndex, 1)
    const currentIdsIndex = resourcesState.current.currentIds.indexOf(event.resource)

    currentIdsIndex !== -1 && resourcesState.current.currentIds.splice(currentIdsIndex, 1)
    delete resourcesState.current.byId[event.resource]
  }

  function clearPublishableMapping(iri: string) {
    resourcesState.current.publishableMapping = resourcesState.current.publishableMapping.filter((mapping) => {
      return ![mapping.publishedIri, mapping.draftIri].includes(iri)
    })
  }

  function mapPublishableResource(resource: CwaResource) {
    if (!resource['@id'] || getResourceTypeFromIri(resource['@id']) !== CwaResourceTypes.COMPONENT) {
      return
    }
    const isPublished = getPublishedResourceState({ data: resource })
    if (isPublished === undefined) {
      return
    }

    clearPublishableMapping(resource['@id'])
    if (isPublished) {
      if (!resource.draftResource) {
        return
      }
      clearPublishableMapping(resource.draftResource)
      resourcesState.current.publishableMapping.push({
        publishedIri: resource['@id'],
        draftIri: resource.draftResource,
      })
      return
    }

    if (!resource.publishedResource) {
      return
    }
    clearPublishableMapping(resource.publishedResource)
    resourcesState.current.publishableMapping.push({
      publishedIri: resource.publishedResource,
      draftIri: resource['@id'],
    })
  }

  function mapPositionToComponent(resource: CwaResource) {
    if (!resource['@id'] || getResourceTypeFromIri(resource['@id']) !== CwaResourceTypes.COMPONENT_POSITION || !resource.component) {
      return
    }
    const existingPositions = resourcesState.current.positionsByComponent[resource.component] || []

    existingPositions.includes(resource['@id']) === false && existingPositions.push(resource['@id'])
    resourcesState.current.positionsByComponent[resource.component] = existingPositions
  }

  function clearPositionToComponentMapping(iri: string) {
    const resourceType = getResourceTypeFromIri(iri)
    if (resourceType === CwaResourceTypes.COMPONENT_POSITION) {
      const entries = Object.entries(resourcesState.current.positionsByComponent)
      for (const [componentIri, positionIris] of entries) {
        resourcesState.current.positionsByComponent[componentIri] = positionIris.filter(pIri => (iri !== pIri))
      }
      return
    }
    if (resourceType === CwaResourceTypes.COMPONENT) {
      if (resourcesState.current.positionsByComponent[iri]) {
        delete resourcesState.current.positionsByComponent[iri]
      }
    }
  }

  function saveResource(event: SaveResourceEvent | SaveNewResourceEvent): void {
    const clearExistingNewResource = () => {
      // todo: test we clear off any pending new resources awaiting merge
      const allIdsIndex = resourcesState.new.allIds.indexOf(iri)
      if (allIdsIndex !== -1) {
        resourcesState.new.allIds.splice(allIdsIndex, 1)
        delete resourcesState.new.byId[iri]
      }
    }

    const iri = event.resource['@id']
    if (event.isNew) {
      const existingResource = resourcesState.current.byId[iri]
      if (existingResource?.data && isCwaResourceSame(existingResource.data, event.resource)) {
        clearExistingNewResource()
        return
      }
      resourcesState.new.byId[iri] = {
        path: event.path,
        resource: event.resource,
      }
      if (!resourcesState.new.allIds.includes(iri)) {
        resourcesState.new.allIds.push(iri)
      }
      return
    }

    const data = initResource({
      resourcesState,
      iri,
      isCurrent: true,
    })

    data.data = event.resource

    clearExistingNewResource()

    // todo: test we save publishable mapping here
    mapPublishableResource(event.resource)
    mapPositionToComponent(event.resource)
  }

  return {
    resetNewResource(): void {
      if (!resourcesState.adding.value) {
        return
      }

      function clearPositionFromGroup(positionIri: string) {
        const positionResource = resourcesGetters.getResource.value(positionIri)
        if (!positionResource?.data) {
          return
        }
        const groupIri = positionResource.data.componentGroup
        if (!groupIri) {
          return
        }
        const componentGroup = resourcesGetters.getResource.value(groupIri)
        if (!componentGroup?.data) {
          return
        }
        const positions = [...componentGroup.data.componentPositions]
        const posIndex = positions.indexOf(positionIri)
        if (posIndex !== -1) {
          positions.splice(posIndex, 1)
        }
        saveResource({
          resource: {
            ...componentGroup.data,
            componentPositions: positions,
          },
        })
      }

      if (resourcesState.adding.value.position) {
        clearPositionFromGroup(resourcesState.adding.value.position)
        deleteResource({ resource: resourcesState.adding.value.position })
      }
      else {
        clearPositionFromGroup(resourcesState.adding.value.resource)
      }
      deleteResource({ resource: resourcesState.adding.value.resource })
      resourcesState.adding.value = undefined
    },
    initNewResource(addResourceEvent: AddResourceEvent, resourceType: string, endpoint: string, isPublishable: boolean, instantAdd: boolean, defaultData?: { [key: string]: any }): void {
      const closestGroup = addResourceEvent.closest.group
      const closestPosition = addResourceEvent.closest.position
      const addingToGroup = addResourceEvent.targetIri === addResourceEvent.closest.group

      const newResource: CwaResource = {
        ...defaultData,
        '@id': NEW_RESOURCE_IRI,
        '@type': resourceType,
        '_metadata': {
          adding: {
            instantAdd,
            endpoint,
            isPublishable,
          },
          persisted: false,
        },
      }

      // also add a position resource as a temporary resource if we are not adding a dynamnic position
      let position: string | undefined
      let positionResource: CwaResource | undefined

      if (resourceType === 'ComponentPosition') {
        newResource.componentGroup = closestGroup
      }
      else if (addResourceEvent.addAfter !== null) {
        position = `/_/component_positions/${NEW_RESOURCE_IRI}`

        // update the resource to reference that it is in this position
        newResource.componentPositions = [position]

        positionResource = {
          '@id': position,
          '@type': 'ComponentPosition',
          'component': NEW_RESOURCE_IRI,
          'componentGroup': closestGroup,
          '_metadata': {
            persisted: false,
          },
        }

        saveResource({
          resource: positionResource,
        })
      }
      else if (!addResourceEvent.pageDataProperty) {
        newResource.componentPositions = [addResourceEvent.closest.position]
      }

      const newPosition = positionResource || (newResource['@type'] === 'ComponentPosition' ? newResource : undefined)

      if (!addingToGroup && closestPosition && newPosition) {
        const positionSortValue = resourcesGetters.getPositionSortDisplayNumber.value(closestPosition)
        if (positionSortValue !== undefined) {
          newPosition._metadata.sortDisplayNumber = addResourceEvent?.addAfter ? positionSortValue + 1 : positionSortValue
        }
      }

      // finish saving the new resource with any modifications arising from if we need a position as well
      saveResource({
        resource: newResource,
      })

      // set IRI references to these new resource
      resourcesState.adding.value = {
        resource: NEW_RESOURCE_IRI,
        position,
      }

      if (closestGroup && newPosition) {
        const groupResource = resourcesGetters.getResource.value(closestGroup)
        if (groupResource?.data) {
          const existingPositionIris = groupResource.data.componentPositions

          // add to start or end of component group
          if (addingToGroup && existingPositionIris) {
            newPosition._metadata.sortDisplayNumber = addResourceEvent?.addAfter ? existingPositionIris.length + 1 : 1
          }

          const updatedGroupResource = {
            ...groupResource.data,
            componentPositions: [...(existingPositionIris || []), (position || NEW_RESOURCE_IRI)],
          }
          saveResource({
            resource: updatedGroupResource,
          })
        }
      }
    },
    deleteResource,
    mergeNewResources(): void {
      for (const newId of resourcesState.new.allIds) {
        const newResource = resourcesState.new.byId[newId]

        // if empty resource, it should be deleted
        if (Object.keys(newResource.resource).length === 1 && newResource.resource['@id']) {
          deleteResource({
            resource: newId,
          })
          // todo: test we clear publishable mapping here
          clearPublishableMapping(newId)
          clearPositionToComponentMapping(newId)
          continue
        }

        // save/replace new resource
        resourcesState.current.byId[newId] = {
          apiState: {
            status: CwaResourceApiStatuses.SUCCESS,
            headers: {
              path: newResource.path,
            },
            fetchedAt: (new Date()).getTime(),
          },
          data: newResource.resource,
        }

        // if a new resource, we should populate into allIds and currentIds
        if (!resourcesState.current.allIds.includes(newId)) {
          resourcesState.current.allIds.push(newId)
        }
        if (!resourcesState.current.currentIds.includes(newId)) {
          resourcesState.current.currentIds.push(newId)
        }
        // todo: test we save publishable mapping here
        mapPublishableResource(newResource.resource)
      }
      resourcesState.new.allIds = []
      resourcesState.new.byId = {}
    },
    resetCurrentResources(currentIds?: string[]): void {
      if (currentIds) {
        for (const currentId of currentIds) {
          if (!resourcesState.current.byId[currentId]) {
            throw new Error(`Cannot set current resource ID '${currentId}'. It does not exist.`)
          }
          const currentState = resourcesState.current.byId[currentId].apiState

          // not an error and has been successful in the past
          if (currentState.status !== CwaResourceApiStatuses.ERROR && currentState.headers) {
            resourcesState.current.byId[currentId].apiState = {
              status: currentState.status, // we had forced this to show as successful. when fetching route though with redirect, right on a tab change, tab changing url will trigger a reset, and then if this is success state, the fetch of redirects would fail with the postfix /redirects
              headers: currentState.headers,
              ssr: currentState.ssr,
              path: currentState.path,
              fetchedAt: currentState.status === CwaResourceApiStatuses.SUCCESS ? currentState.fetchedAt : (new Date()).getTime(),
            }
          }
        }
      }
      resourcesState.new.byId = {}
      resourcesState.new.allIds = []
      resourcesState.current.currentIds = currentIds || []
      // do not clear mapping relating to 'current' as this will clear too early loading new pages
      // other methods keep publishable mapping in sync with the resources we have
    },
    clearResources(): void {
      resourcesState.current.byId = {}
      resourcesState.current.allIds = []
      resourcesState.current.currentIds = []
      // todo: test mapping clears
      resourcesState.current.publishableMapping = []
      resourcesState.current.positionsByComponent = {}
      resourcesState.new.byId = {}
      resourcesState.new.allIds = []
    },
    setResourceFetchStatus(event: SetResourceStatusEvent): void {
      const data = initResource({
        resourcesState,
        iri: event.iri,
        isCurrent: true,
      })

      if (event.isComplete) {
        data.apiState = {
          status: CwaResourceApiStatuses.SUCCESS,
          headers: event.headers,
          path: event.path,
          // todo: test we reset the ssr state and do not reuse from previous when resource loader re-fetches
          ssr: import.meta.server,
          fetchedAt: (new Date()).getTime(),
        }

        return
      }

      const newApiState: CwaResourceApiStateGeneral = {
        status: CwaResourceApiStatuses.IN_PROGRESS,
        ssr: import.meta.server,
        path: event.path,
      }
      // if in progress, retain headers and final url from last success state
      if (data.apiState.status === CwaResourceApiStatuses.SUCCESS) {
        newApiState.headers = data.apiState.headers
        newApiState.ssr = data.apiState.ssr
      }
      data.apiState = newApiState
    },
    setResourceFetchError({ iri, error, isCurrent, showErrorPage }: SetResourceFetchErrorEvent): void {
      const data = initResource({
        resourcesState,
        iri,
        isCurrent: isCurrent === undefined ? true : isCurrent,
      })
      data.apiState = {
        status: CwaResourceApiStatuses.ERROR,
        error: error?.asObject,
        ssr: import.meta.server,
        fetchedAt: (new Date()).getTime(),
      }

      if (showErrorPage && error) {
        showError({ statusCode: error.statusCode, statusMessage: error.statusMessage, message: error.message })
      }
    },
    saveResource,
  }
}
