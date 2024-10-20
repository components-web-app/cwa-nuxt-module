import {
  defineStore,
} from 'pinia'
import type {
  CwaPiniaStoreDefinitionInterface,
  CwaPiniaStoreInterface,
  CwaStore,
} from '../cwa-store-types'
import type { CwaResourcesStateInterface } from './state'
import type { CwaResourcesGettersInterface } from './getters'
import type { CwaResourcesActionsInterface } from './actions'
import CwaResourcesState from './state'
import CwaResourcesGetters from './getters'
import CwaResourcesActions from './actions'

/**
 * Interface Definitions
 */
export interface CwaResourcesInterface extends CwaResourcesStateInterface, CwaResourcesGettersInterface, CwaResourcesActionsInterface {}
export type CwaResourcesStoreDefinitionInterface = CwaPiniaStoreDefinitionInterface<`${string}.resources`, CwaResourcesInterface>
export type CwaResourcesStoreInterface = CwaPiniaStoreInterface<`${string}.resources`, CwaResourcesInterface>

/**
 * Main Store Class
 */
export class ResourcesStore implements CwaStore {
  private readonly storeDefinition: CwaResourcesStoreDefinitionInterface

  constructor(storeName: string) {
    this.storeDefinition = defineStore(`${storeName}.resources`, (): CwaResourcesInterface => {
      const resourcesState = CwaResourcesState()
      const getters = CwaResourcesGetters(resourcesState)
      return {
        ...resourcesState,
        ...getters,
        ...CwaResourcesActions(resourcesState, getters),
      }
    })
  }

  public useStore(): CwaResourcesStoreInterface {
    return this.storeDefinition()
  }
}
