import {
  defineStore
} from 'pinia'
import {
  CwaPiniaStoreDefinitionInterface,
  CwaPiniaStoreWithStateDefinitionInterface,
  CwaStoreInterface
} from '../cwa-store-interface'
import CwaResourcesActions, { CwaResourcesActionsInterface } from './actions'
import CwaResourcesState, { CwaResourcesStateInterface } from './state'

/**
 * Interface Definitions
 */
export interface CwaResourcesInterface extends CwaResourcesStateInterface, CwaResourcesActionsInterface {}
export interface CwaResourcesStoreInterface extends CwaPiniaStoreDefinitionInterface<`${string}.resources`, CwaResourcesInterface> {}
export interface CwaResourcesStoreWithStateInterface extends CwaResourcesInterface, CwaPiniaStoreWithStateDefinitionInterface<`${string}.resources`, CwaResourcesInterface> {}

/**
 * Main Store Class
 */
export class ResourcesStore implements CwaStoreInterface {
  private readonly storeDefinition: CwaResourcesStoreInterface

  constructor (storeName: string) {
    this.storeDefinition = defineStore(`${storeName}.resources`, (): CwaResourcesInterface => {
      const resourcesState = CwaResourcesState()
      return {
        ...resourcesState,
        ...CwaResourcesActions(resourcesState)
      }
    })
  }

  public useStore (): CwaResourcesStoreWithStateInterface {
    return this.storeDefinition()
  }
}
