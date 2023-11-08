import { showError } from '#app'
import type {
  CwaResource
} from '../../../resources/resource-utils'
import {
  CwaResourceTypes, getPublishedResourceState,
  getResourceTypeFromIri,
  isCwaResourceSame
} from '../../../resources/resource-utils'
import { CwaResourceError } from '../../../errors/cwa-resource-error'
import type { CwaFetchRequestHeaders } from '../../../api/fetcher/fetcher'
import type {
  CwaCurrentResourceInterface,
  CwaResourceApiStateGeneral,
  CwaResourcesStateInterface
} from './state'
import {
  CwaResourceApiStatuses
} from './state'
import type { CwaResourcesGettersInterface } from './getters'

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

export interface SetResourceFetchErrorEvent { iri: string, error?: CwaResourceError, isCurrent?: boolean, showErrorPage?: boolean }

interface InitResourceEvent {
  iri: string
  resourcesState: CwaResourcesStateInterface
  isCurrent: boolean
}

export interface CwaResourcesActionsInterface {
  resetCurrentResources (currentIds?: string[]): void
  clearResources (): void
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
          const componentPositions = componentGroup.data?.componentPositions
          const positionIndex = componentPositions.indexOf(event.resource)
          if (positionIndex !== -1) {
            componentPositions.splice(positionIndex, 1)
          }
        }
        break
      }
      case CwaResourceTypes.COMPONENT: {
        if (!resource.data) {
          break
        }
        // if it is a component, the position will also be deleted in an auto-cascade on the server if the position is not dynamic, we should replicate locally and delete the position
        const componentPositions = resource.data.componentPositions
        for (const positionIri of componentPositions) {
          const positionResource = resourcesState.current.byId[positionIri]
          if (!positionResource.data) {
            continue
          }
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

  function clearPublishableMapping (iri: string) {
    resourcesState.current.publishableMapping = resourcesState.current.publishableMapping.filter((mapping) => {
      return ![mapping.publishedIri, mapping.draftIri].includes(iri)
    })
  }

  function mapPublishableResource (resource: CwaResource) {
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
        draftIri: resource.draftResource
      })
      return
    }

    if (!resource.publishedResource) {
      return
    }
    clearPublishableMapping(resource.publishedResource)
    resourcesState.current.publishableMapping.push({
      publishedIri: resource.publishedResource,
      draftIri: resource['@id']
    })
  }

  return {
    deleteResource,
    mergeNewResources (): void {
      console.log('mergeNewResources')
      for (const newId of resourcesState.new.allIds) {
        const newResource = resourcesState.new.byId[newId]

        // if empty resource, it should be deleted
        if (Object.keys(newResource.resource).length === 1 && newResource.resource['@id']) {
          deleteResource({
            resource: newId
          })
          // todo: test we save publishable mapping here
          clearPublishableMapping(newId)
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
        // todo: test we save publishable mapping here
        mapPublishableResource(newResource.resource)
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
              headers: currentState.headers,
              ssr: currentState.ssr
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
    clearResources (): void {
      resourcesState.current.byId = {}
      resourcesState.current.allIds = []
      resourcesState.current.currentIds = []
      // todo: test mapping clears
      resourcesState.current.publishableMapping = []
      resourcesState.new.byId = {}
      resourcesState.new.allIds = []
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
          headers: event.headers,
          // todo: test we reset the ssr state and do not reuse from previous when resource loader re-fetches
          ssr: process.server
        }

        return
      }

      const newApiState: CwaResourceApiStateGeneral = {
        status: CwaResourceApiStatuses.IN_PROGRESS,
        ssr: process.server
      }
      // if in progress, retain headers and final url from last success state
      if (data.apiState.status === CwaResourceApiStatuses.SUCCESS) {
        newApiState.headers = data.apiState.headers
        newApiState.ssr = data.apiState.ssr
      }
      data.apiState = newApiState
    },
    setResourceFetchError ({ iri, error, isCurrent, showErrorPage }: SetResourceFetchErrorEvent): void {
      const data = initResource({
        resourcesState,
        iri,
        isCurrent: isCurrent === undefined ? true : isCurrent
      })
      data.apiState = {
        status: CwaResourceApiStatuses.ERROR,
        error: error?.asObject,
        ssr: process.server
      }

      if (showErrorPage && error) {
        showError({ statusCode: error.statusCode, message: error.message })
      }
    },
    saveResource (event: SaveResourceEvent|SaveNewResourceEvent): void {
      const iri = event.resource['@id']
      if (event.isNew) {
        const existingResource = resourcesState.current.byId[iri]
        if (existingResource?.data && isCwaResourceSame(existingResource.data, event.resource)) {
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

      // todo: test we save publishable mapping here
      mapPublishableResource(event.resource)
    }
  }
}
