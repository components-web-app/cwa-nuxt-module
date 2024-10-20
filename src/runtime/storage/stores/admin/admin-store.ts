import {
  defineStore,
} from 'pinia'
import type {
  CwaPiniaStoreDefinitionInterface,
  CwaPiniaStoreInterface,
  CwaStore,
} from '../cwa-store-types'
import type { CwaAdminStateInterface } from './state'
import CwaAdminState from './state'
import type { CwaAdminActionsInterface } from './actions'
import CwaAdminActions from './actions'

/**
 * Interface Definitions
 */
export interface CwaAdminInterface extends CwaAdminStateInterface, CwaAdminActionsInterface {}
export type CwaAdminStoreDefinitionInterface = CwaPiniaStoreDefinitionInterface<`${string}.admin`, CwaAdminInterface>
export type CwaAdminStoreInterface = CwaPiniaStoreInterface<`${string}.admin`, CwaAdminInterface>

/**
 * Main Store Class
 */
export class AdminStore implements CwaStore {
  private readonly storeDefinition: CwaAdminStoreDefinitionInterface

  constructor(storeName: string) {
    this.storeDefinition = defineStore(`${storeName}.admin`, () => {
      const adminState = CwaAdminState()
      return {
        ...adminState,
        ...CwaAdminActions(adminState),
      }
    })
  }

  public useStore(): CwaAdminStoreInterface {
    return this.storeDefinition()
  }
}
