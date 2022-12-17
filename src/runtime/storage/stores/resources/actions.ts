import { CwaResource } from '../../../resources/resource-utils'
import { CwaResourceError } from '../../../errors/cwa-resource-error'
import {
  CwaCurrentResourceInterface,
  CwaResourceApiStateGeneral,
  CwaResourceApiStatuses,
  CwaResourcesStateInterface
} from './state'
import { CwaFetchRequestHeaders } from '@cwa/nuxt-module/runtime/api/fetcher/fetcher'

export interface SaveResourceEvent { resource: CwaResource, isNew?: boolean }

export interface SetResourceInProgressStatusEvent {
  iri: string, isComplete: false
}
export interface SetResourceCompletedStatusEvent {
  iri: string, isComplete: true, headers: CwaFetchRequestHeaders, finalUrl: string
}
export interface SetResourceResetStatusEvent {
  iri: string, isComplete: null
}
declare type SetResourceStatusEvent = SetResourceInProgressStatusEvent|SetResourceCompletedStatusEvent|SetResourceResetStatusEvent

export interface SetResourceFetchErrorEvent { iri: string, error?: CwaResourceError, isCurrent?: boolean }

export interface CwaResourcesActionsInterface {
  resetCurrentResources (currentIds?: string[]): void
  setResourceFetchStatus (event: SetResourceStatusEvent): void
  setResourceFetchError (event: SetResourceFetchErrorEvent): void
  saveResource(event: SaveResourceEvent): void
}

interface InitResourceEvent {
  iri: string
  resourcesState: CwaResourcesStateInterface
  isCurrent: boolean
}

export default function (resourcesState: CwaResourcesStateInterface): CwaResourcesActionsInterface {
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

  return {
    resetCurrentResources (currentIds?: string[]): void {
      if (currentIds) {
        for (const currentId of currentIds) {
          if (!resourcesState.current.byId[currentId]) {
            throw new Error(`Cannot set current resource ID '${currentId}'. It does not exist.`)
          }
          // todo: test we set status back to success to prevent further saving of ongoing fetches
          const currentState = resourcesState.current.byId[currentId].apiState
          // not an error and has been successful in the past
          if (currentState.status !== CwaResourceApiStatuses.ERROR && currentState.headers && currentState.finalUrl) {
            resourcesState.current.byId[currentId].apiState = {
              status: CwaResourceApiStatuses.SUCCESS,
              headers: currentState.headers,
              finalUrl: currentState.finalUrl
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

      if (event.isComplete === null) {
        data.apiState.status = CwaResourceApiStatuses.SUCCESS
        return
      }

      if (event.isComplete) {
        data.apiState = {
          status: CwaResourceApiStatuses.SUCCESS,
          headers: event.headers,
          finalUrl: event.finalUrl
        }
        return
      }

      const newApiState: CwaResourceApiStateGeneral = {
        status: CwaResourceApiStatuses.IN_PROGRESS
      }
      // retain headers and final url from last success state
      if (data.apiState.status === CwaResourceApiStatuses.SUCCESS) {
        newApiState.headers = data.apiState.headers
        newApiState.finalUrl = data.apiState.finalUrl
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
