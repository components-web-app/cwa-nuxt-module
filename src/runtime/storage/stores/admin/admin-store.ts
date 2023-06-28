import {
  defineStore
} from 'pinia'
import {
  CwaPiniaStoreDefinitionInterface,
  CwaPiniaStoreInterface,
  CwaStore
} from '../cwa-store-types'
import CwaAdminState, { CwaAdminStateInterface } from './state'

/**
 * Interface Definitions
 */
export interface CwaAdminInterface extends CwaAdminStateInterface {}
export interface CwaAdminStoreDefinitionInterface extends CwaPiniaStoreDefinitionInterface<`${string}.admin`, CwaAdminInterface> {}
export interface CwaAdminStoreInterface extends CwaPiniaStoreInterface<`${string}.admin`, CwaAdminInterface> {}

/**
 * Main Store Class
 */
export class AdminStore implements CwaStore {
  private readonly storeDefinition: CwaAdminStoreDefinitionInterface

  constructor (storeName: string) {
    this.storeDefinition = defineStore(`${storeName}.admin`, () => {
      const adminState = CwaAdminState()
      return {
        ...adminState
      }
    })
  }

  public useStore (): CwaAdminStoreInterface {
    return this.storeDefinition()
  }
}
