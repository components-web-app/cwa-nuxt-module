import { CwaResource, CwaResourceTypes } from '../../../resources/resource-utils'
import { CwaResourceError } from '../../../errors/cwa-resource-error'
import {
  CwaCurrentResourceInterface,
  CwaResourceApiStateGeneral,
  CwaResourceApiStatuses,
  CwaResourcesStateInterface
} from './state'
import { CwaFetchRequestHeaders } from '@cwa/nuxt-module/runtime/api/fetcher/fetcher'
import { CwaResourcesGettersInterface } from '@cwa/nuxt-module/runtime/storage/stores/resources/getters'

export interface SaveResourceEvent { resource: CwaResource, isNew?: boolean }

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

export interface SetResourceFetchErrorEvent { iri: string, error?: CwaResourceError, isCurrent?: boolean }

interface InitResourceEvent {
  iri: string
  resourcesState: CwaResourcesStateInterface
  isCurrent: boolean
}

export interface CwaResourcesActionsInterface {
  resetCurrentResources (currentIds?: string[]): void
  setResourceFetchStatus (event: SetResourceStatusEvent): void
  setResourceFetchError (event: SetResourceFetchErrorEvent): void
  saveResource(event: SaveResourceEvent): void
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

  function deleteResource (event: DeleteResourceEvent) {
    const resource = resourcesState.current.byId[event.resource]
    if (!resource) {
      return
    }
    const type = resource.data['@type']
    switch (type) {
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
          if (!positionResource.data.pageDataProperty) {
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
    currentIdsIndex !== -1 && resourcesState.current.allIds.splice(currentIdsIndex, 1)
    delete resourcesState.current.byId[event.resource]
  }

  return {
    deleteResource,
    mergeNewResources () {
      for (const newId of resourcesState.new.allIds) {
        const newResource = resourcesState.new.byId[newId]

        // if empty resource, it should be deleted
        if (Object.keys(newResource).length === 1 && newResource['@id']) {
          deleteResource({
            resource: newId
          })
          continue
        }

        // save/replace new resource
        resourcesState.current.byId[newId] = {
          apiState: {
            status: CwaResourceApiStatuses.SUCCESS
          },
          data: newResource
        }

        // if a new resource, we should populate into allIds and currentIds
        if (!resourcesState.current.allIds.includes(newId)) {
          resourcesState.current.allIds.push(newId)
        }
        if (!resourcesState.current.currentIds.includes(newId)) {
          resourcesState.current.currentIds.push(newId)
        }
      }
      resourcesState.new.allIds = []
      resourcesState.new.byId = {}
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
    setResourceFetchError ({ iri, error, isCurrent }: SetResourceFetchErrorEvent): void {
      const data = initResource({
        resourcesState,
        iri,
        isCurrent: isCurrent === undefined ? true : isCurrent
      })
      data.apiState = {
        status: CwaResourceApiStatuses.ERROR,
        error: error?.asObject
      }
    },
    saveResource ({ resource, isNew }: SaveResourceEvent): void {
      const iri = resource['@id']
      if (isNew === true) {
        resourcesState.new.byId[iri] = resource
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
      data.data = resource
    }
  }
}
