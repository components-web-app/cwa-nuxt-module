import { CwaResourcesStateInterface } from './state'

export interface CwaResourcesActionsInterface {
  resetCurrentResources (): void
}

export default function (resourcesState: CwaResourcesStateInterface): CwaResourcesActionsInterface {
  return {
    resetCurrentResources (): void {
      resourcesState.new = {
        byId: {},
        allIds: []
      }
      resourcesState.current.currentIds = []
    }
  }
}
