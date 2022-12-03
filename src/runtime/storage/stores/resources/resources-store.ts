import {
  _ExtractActionsFromSetupStore,
  _ExtractGettersFromSetupStore,
  _ExtractStateFromSetupStore,
  defineStore, StoreDefinition
} from 'pinia'
import { CwaStoreInterface } from '../cwa-store-interface'
import CwaResourcesActions, { CwaResourcesActionsInterface } from './actions'
import CwaResourcesState, { CwaResourcesStateInterface } from './state'

/**
 * Interface Definitions
 */
export interface CwaResourcesInterface extends CwaResourcesStateInterface, CwaResourcesActionsInterface {}
export interface CwaResourcesStoreInterface extends StoreDefinition<`${string}.resources`, _ExtractStateFromSetupStore<CwaResourcesInterface>, _ExtractGettersFromSetupStore<CwaResourcesInterface>, _ExtractActionsFromSetupStore<CwaResourcesInterface>> {}

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

  public useStore (): CwaResourcesInterface {
    return this.storeDefinition()
  }
}
