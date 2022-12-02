import { CwaResource } from '../../../resource-types'
import { CwaResourcesStateInterface } from './state'

export interface SaveResourceEvent { resource: CwaResource, isNew?: boolean }

export interface CwaResourcesActionsInterface {
  resetCurrentResources (): void
  saveResource(event: SaveResourceEvent): void
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
    saveResource ({ resource, isNew }: SaveResourceEvent) {
      if (isNew === true) {
        console.log('SAVE NEW MERCURE RESOURCE TO DO')
        return
      }
      const iri = resource['@id']
      resourcesState.current.byId[iri] = {
        data: resource
      }
      if (!resourcesState.current.allIds.includes(iri)) {
        resourcesState.current.allIds.push(iri)
      }
      if (!resourcesState.current.currentIds.includes(iri)) {
        resourcesState.current.currentIds.push(iri)
      }
    }
  }
}
