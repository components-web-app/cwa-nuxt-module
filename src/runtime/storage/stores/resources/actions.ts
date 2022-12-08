import { FetchError } from 'ohmyfetch'
import { reactive } from 'vue'
import { CwaResource } from '../../../resources/resource-utils'
import { CwaCurrentResourceInterface, CwaResourcesStateInterface } from './state'

export interface SaveResourceEvent { resource: CwaResource, isNew?: boolean }
export interface SetResourceStatusEvent { iri: string, status: 0 | 1 }
export interface SetResourceFetchErrorEvent { iri: string, fetchError?: FetchError }

export interface CwaResourcesActionsInterface {
  resetCurrentResources (): void
  setResourceFetchStatus (event: SetResourceStatusEvent): void
  setResourceFetchError (event: SetResourceFetchErrorEvent): void
  saveResource(event: SaveResourceEvent): void
}

export default function (resourcesState: CwaResourcesStateInterface): CwaResourcesActionsInterface {
  function initCurrentResource (resourcesState: CwaResourcesStateInterface, iri: string): CwaCurrentResourceInterface {
    if (!resourcesState.current.byId[iri]) {
      resourcesState.current.byId[iri] = reactive({
        apiState: reactive({
          status: null
        })
      })
    }
    return resourcesState.current.byId[iri]
  }

  return {
    resetCurrentResources (): void {
      resourcesState.new = reactive({
        byId: {},
        allIds: []
      })
      resourcesState.current.currentIds = []
    },
    setResourceFetchStatus ({ iri, status }: SetResourceStatusEvent): void {
      const data = initCurrentResource(resourcesState, iri)
      data.apiState.status = status
      data.apiState.fetchError = undefined
    },
    setResourceFetchError ({ iri, fetchError }: SetResourceFetchErrorEvent): void {
      const data = initCurrentResource(resourcesState, iri)
      data.apiState.status = -1
      if (fetchError) {
        data.apiState.fetchError = {
          statusCode: fetchError.statusCode,
          path: fetchError.request?.toString()
        }
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
