import {
  defineStore
} from 'pinia'
import {
  CwaPiniaStoreDefinitionInterface,
  CwaPiniaStoreInterface,
  CwaStore
} from '../cwa-store-types'
import CwaManagerState, { CwaManagerStateInterface } from './state'

/**
 * Interface Definitions
 */
export interface CwaManagerInterface extends CwaManagerStateInterface {}
export interface CwaManagerStoreDefinitionInterface extends CwaPiniaStoreDefinitionInterface<`${string}.manager`, CwaManagerInterface> {}
export interface CwaManagerStoreInterface extends CwaPiniaStoreInterface<`${string}.manager`, CwaManagerInterface> {}

/**
 * Main Store Class
 */
export class ManagerStore implements CwaStore {
  private readonly storeDefinition: CwaManagerStoreDefinitionInterface

  constructor (storeName: string) {
    this.storeDefinition = defineStore(`${storeName}.manager`, () => {
      const managerState = CwaManagerState()
      return {
        ...managerState
      }
    })
  }

  public useStore (): CwaManagerStoreInterface {
    return this.storeDefinition()
  }
}
