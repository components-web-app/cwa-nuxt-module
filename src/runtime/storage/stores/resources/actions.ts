import { showError } from '#app'
import {
  CwaResource,
  CwaResourceTypes,
  getResourceTypeFromIri,
  isCwaResourceSame
} from '../../../resources/resource-utils'
import { CwaResourceError } from '../../../errors/cwa-resource-error'
import { CwaFetchRequestHeaders } from '../../../api/fetcher/fetcher'
import {
  CwaCurrentResourceInterface,
  CwaResourceApiStateGeneral,
  CwaResourceApiStatuses,
  CwaResourcesStateInterface
} from './state'
import { CwaResourcesGettersInterface } from './getters'

export interface SaveResourceEvent { resource: CwaResource, isNew?: undefined|false }
export interface SaveNewResourceEvent { resource: CwaResource, isNew: true, path: string|undefined }

export interface DeleteResourceEvent { resource: string }

export interface SetResourceInProgressStatusEvent {
  iri: string, isComplete: false
}
export interface SetResourceCompletedStatusEvent {
  iri: string, isComplete: true, headers: CwaFetchRequestHeaders
}
export interface SetResourceResetStatusEvent {
  iri: string, isComplete: null
}
declare type SetResourceStatusEvent = SetResourceInProgressStatusEvent|SetResourceCompletedStatusEvent|SetResourceResetStatusEvent

export interface SetResourceFetchErrorEvent { iri: string, error?: CwaResourceError, isCurrent?: boolean, isPrimary?: boolean }

interface InitResourceEvent {
  iri: string
  resourcesState: CwaResourcesStateInterface
  isCurrent: boolean
}

export interface CwaResourcesActionsInterface {
  resetCurrentResources (currentIds?: string[]): void
  setResourceFetchStatus (event: SetResourceStatusEvent): void
  setResourceFetchError (event: SetResourceFetchErrorEvent): void
  saveResource(event: SaveResourceEvent|SaveNewResourceEvent): void
  deleteResource(event: DeleteResourceEvent): void
  mergeNewResources(): void
}

export default function (resourcesState: CwaResourcesStateInterface, resourcesGetters: CwaResourcesGettersInterface): CwaResourcesActionsInterface {
  function initResource ({ iri, resourcesState, isCurrent }: InitResourceEvent): CwaCurrentResourceInterface {
    if (!resourcesState.current.byId[iri]) {
      resourcesState.current.byId[iri] = {
        apiState: {
          status: undefined
        }
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

  function deleteResource (event: DeleteResourceEvent): void {
    const resource = resourcesState.current.byId[event.resource]
    if (!resource) {
      return
    }
    switch (getResourceTypeFromIri(event.resource)) {
      case CwaResourceTypes.COMPONENT_POSITION: {
        // remove a component position from all component groups
        const componentGroups = resourcesGetters.resourcesByType.value[CwaResourceTypes.COMPONENT_GROUP]
        for (const componentGroup of Object.values(componentGroups)) {
          const componentPositions = componentGroup.componentPositions
          const positionIndex = componentPositions.indexOf(event.resource)
          if (positionIndex !== -1) {
            componentPositions.splice(positionIndex, 1)
          }
        }
        break
      }
      case CwaResourceTypes.COMPONENT: {
        // if it is a component, the position will also be deleted in an auto-cascade on the server if the position is not dynamic, we should replicate locally and delete the position
        const componentPositions = resource.data.componentPositions
        for (const positionIri of componentPositions) {
          const positionResource = resourcesState.current.byId[positionIri]
          if (positionResource.data.pageDataProperty) {
            positionResource.data.component = undefined
          } else {
            deleteResource({
              resource: positionIri
            })
          }
        }
        break
      }
    }

    const allIdsIndex = resourcesState.current.allIds.indexOf(event.resource)
    allIdsIndex !== -1 && resourcesState.current.allIds.splice(allIdsIndex, 1)
    const currentIdsIndex = resourcesState.current.currentIds.indexOf(event.resource)
    currentIdsIndex !== -1 && resourcesState.current.currentIds.splice(currentIdsIndex, 1)
    delete resourcesState.current.byId[event.resource]
  }

  return {
    deleteResource,
    mergeNewResources (): void {
      for (const newId of resourcesState.new.allIds) {
        const newResource = resourcesState.new.byId[newId]

        // if empty resource, it should be deleted
        if (Object.keys(newResource.resource).length === 1 && newResource.resource['@id']) {
          deleteResource({
            resource: newId
          })
          continue
        }

        // save/replace new resource
        resourcesState.current.byId[newId] = {
          apiState: {
            status: CwaResourceApiStatuses.SUCCESS,
            headers: {
              path: newResource.path
            }
          },
          data: newResource.resource
        }

        // if a new resource, we should populate into allIds and currentIds
        if (!resourcesState.current.allIds.includes(newId)) {
          resourcesState.current.allIds.push(newId)
        }
        if (!resourcesState.current.currentIds.includes(newId)) {
          resourcesState.current.currentIds.push(newId)
        }
      }
      resourcesState.new = {
        byId: {},
        allIds: []
      }
    },
    resetCurrentResources (currentIds?: string[]): void {
      if (currentIds) {
        for (const currentId of currentIds) {
          if (!resourcesState.current.byId[currentId]) {
            throw new Error(`Cannot set current resource ID '${currentId}'. It does not exist.`)
          }
          const currentState = resourcesState.current.byId[currentId].apiState
          // not an error and has been successful in the past
          if (currentState.status !== CwaResourceApiStatuses.ERROR && currentState.headers) {
            resourcesState.current.byId[currentId].apiState = {
              status: CwaResourceApiStatuses.SUCCESS,
              headers: currentState.headers
            }
          }
        }
      }
      resourcesState.new = {
        byId: {},
        allIds: []
      }
      resourcesState.current.currentIds = currentIds || []
    },
    setResourceFetchStatus (event: SetResourceStatusEvent): void {
      const data = initResource({
        resourcesState,
        iri: event.iri,
        isCurrent: true
      })

      if (event.isComplete) {
        data.apiState = {
          status: CwaResourceApiStatuses.SUCCESS,
          headers: event.headers
        }
        return
      }

      const newApiState: CwaResourceApiStateGeneral = {
        status: CwaResourceApiStatuses.IN_PROGRESS
      }
      // if in progress, retain headers and final url from last success state
      if (data.apiState.status === CwaResourceApiStatuses.SUCCESS) {
        newApiState.headers = data.apiState.headers
      }
      data.apiState = newApiState
    },
    setResourceFetchError ({ iri, error, isCurrent, isPrimary }: SetResourceFetchErrorEvent): void {
      const data = initResource({
        resourcesState,
        iri,
        isCurrent: isCurrent === undefined ? true : isCurrent
      })
      data.apiState = {
        status: CwaResourceApiStatuses.ERROR,
        error: error?.asObject
      }

      // todo: test isPrimary
      if (isPrimary && error) {
        showError({ statusCode: error.statusCode, message: error.message })
      }
    },
    saveResource (event: SaveResourceEvent|SaveNewResourceEvent): void {
      const iri = event.resource['@id']
      if (event.isNew) {
        const existingResource = resourcesState.current.byId[iri]
        if (existingResource && isCwaResourceSame(existingResource.data, event.resource)) {
          return
        }
        resourcesState.new.byId[iri] = {
          path: event.path,
          resource: event.resource
        }
        if (!resourcesState.new.allIds.includes(iri)) {
          resourcesState.new.allIds.push(iri)
        }
        return
      }

      const data = initResource({
        resourcesState,
        iri,
        isCurrent: true
      })
      data.data = event.resource
    }
  }
}
