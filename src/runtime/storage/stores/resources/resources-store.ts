import {
  defineStore
} from 'pinia'
import {
  CwaPiniaStoreDefinitionInterface,
  CwaPiniaStoreInterface,
  CwaStore
} from '../cwa-store-types'
import CwaResourcesState, { CwaResourcesStateInterface } from './state'
import CwaResourcesGetters, { CwaResourcesGettersInterface } from './getters'
import CwaResourcesActions, { CwaResourcesActionsInterface } from './actions'

/**
 * Interface Definitions
 */
export interface CwaResourcesInterface extends CwaResourcesStateInterface, CwaResourcesGettersInterface, CwaResourcesActionsInterface {}
export interface CwaResourcesStoreInterface extends CwaPiniaStoreDefinitionInterface<`${string}.resources`, CwaResourcesInterface> {}
export interface CwaResourcesStoreWithStateInterface extends CwaPiniaStoreInterface<`${string}.resources`, CwaResourcesInterface> {}

/**
 * Main Store Class
 */
export class ResourcesStore implements CwaStore {
  private readonly storeDefinition: CwaResourcesStoreInterface

  constructor (storeName: string) {
    this.storeDefinition = defineStore(`${storeName}.resources`, (): CwaResourcesInterface => {
      const resourcesState = CwaResourcesState()
      return {
        ...resourcesState,
        ...CwaResourcesGetters(resourcesState),
        ...CwaResourcesActions(resourcesState)
      }
    })
  }

  public useStore (): CwaResourcesStoreWithStateInterface {
    return this.storeDefinition()
  }
}
