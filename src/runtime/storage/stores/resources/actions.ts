import { FetchError } from 'ohmyfetch'
import { CwaResource } from '../../../resources/resource-types'
import { CwaCurrentResourceInterface, CwaResourcesStateInterface } from './state'
import consola from 'consola'

export interface SaveResourceEvent { resource: CwaResource, isNew?: boolean }
export interface SetResourceStatusEvent { iri: string, status: -1 | 0 | 1 }
export interface SetResourceFetchErrorEvent { iri: string, fetchError: FetchError }

export interface CwaResourcesActionsInterface {
  resetCurrentResources (): void
  setResourceFetchStatus (event: SetResourceStatusEvent): void
  setResourceFetchError (event: SetResourceFetchErrorEvent): void
  saveResource(event: SaveResourceEvent): void
}

function initCurrentResource (resourcesState: CwaResourcesStateInterface, iri: string): CwaCurrentResourceInterface {
  if (!resourcesState.current.byId[iri]) {
    resourcesState.current.byId[iri] = {
      apiState: {
        status: null
      }
    }
  }
  return resourcesState.current.byId[iri]
}

export default function (resourcesState: CwaResourcesStateInterface): CwaResourcesActionsInterface {
  return {
    resetCurrentResources (): void {
      resourcesState.new = {
        byId: {},
        allIds: []
      }
      resourcesState.current.currentIds = []
    },
    setResourceFetchStatus ({ iri, status }: SetResourceStatusEvent): void {
      const data = initCurrentResource(resourcesState, iri)
      data.apiState.status = status
      if (status !== -1) {
        data.apiState.fetchError = undefined
      }
    },
    setResourceFetchError ({ iri, fetchError }: SetResourceFetchErrorEvent): void {
      const data = initCurrentResource(resourcesState, iri)
      data.apiState.fetchError = {
        statusCode: fetchError.statusCode,
        path: fetchError.request?.toString()
      }
    },
    saveResource ({ resource, isNew }: SaveResourceEvent): void {
      if (isNew === true) {
        consola.log('SAVE NEW MERCURE RESOURCE TO DO')
        return
      }
      const iri = resource['@id']
      const data = initCurrentResource(resourcesState, iri)
      data.data = resource

      if (!resourcesState.current.allIds.includes(iri)) {
        resourcesState.current.allIds.push(iri)
      }
      if (!resourcesState.current.currentIds.includes(iri)) {
        resourcesState.current.currentIds.push(iri)
      }
    }
  }
}
