import {
  defineStore
} from 'pinia'
import {
  CwaPiniaStoreDefinitionInterface,
  CwaPiniaStoreInterface,
  CwaStore
} from '../cwa-store-types'
import CwaAuthState, { CwaAuthStateInterface } from './state'
import CwaAuthGetters, { CwaAuthGettersInterface } from './getters'

/**
 * Interface Definitions
 */
export interface CwaAuthInterface extends CwaAuthStateInterface, CwaAuthGettersInterface {}
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
      const getters = CwaAuthGetters(fetcherState)
      return {
        ...fetcherState,
        ...getters
      }
    })
  }

  public useStore (): CwaAuthStoreInterface {
    return this.storeDefinition()
  }
}
