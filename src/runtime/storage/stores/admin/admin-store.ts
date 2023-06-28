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
export interface CwaAdminStoreDefinitionInterface extends CwaPiniaStoreDefinitionInterface<`${string}.manager`, CwaAdminInterface> {}
export interface CwaAdminStoreInterface extends CwaPiniaStoreInterface<`${string}.manager`, CwaAdminInterface> {}

/**
 * Main Store Class
 */
export class AdminStore implements CwaStore {
  private readonly storeDefinition: CwaAdminStoreDefinitionInterface

  constructor (storeName: string) {
    this.storeDefinition = defineStore(`${storeName}.manager`, () => {
      const managerState = CwaAdminState()
      return {
        ...managerState
      }
    })
  }

  public useStore (): CwaAdminStoreInterface {
    return this.storeDefinition()
  }
}
