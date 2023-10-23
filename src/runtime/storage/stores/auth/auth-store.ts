import {
  defineStore
} from 'pinia'
import type {
  CwaPiniaStoreDefinitionInterface,
  CwaPiniaStoreInterface,
  CwaStore
} from '../cwa-store-types'
import type { CwaAuthStateInterface } from './state'
import CwaAuthState from './state'

/**
 * Interface Definitions
 */
export interface CwaAuthInterface extends CwaAuthStateInterface {}
export interface CwaAuthStoreDefinitionInterface extends CwaPiniaStoreDefinitionInterface<`${string}.auth`, CwaAuthInterface> {}
export interface CwaAuthStoreInterface extends CwaPiniaStoreInterface<`${string}.auth`, CwaAuthInterface> {}

/**
 * Main Store Class
 */
export class AuthStore implements CwaStore {
  private readonly storeDefinition: CwaAuthStoreDefinitionInterface

  constructor (storeName: string) {
    this.storeDefinition = defineStore(`${storeName}.auth`, (): CwaAuthInterface => {
      const fetcherState = CwaAuthState()
      return {
        ...fetcherState
      }
    })
  }

  public useStore (): CwaAuthStoreInterface {
    return this.storeDefinition()
  }
}
