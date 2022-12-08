import {
  defineStore
} from 'pinia'
import {
  CwaPiniaStoreDefinitionInterface,
  CwaPiniaStoreInterface,
  CwaStore
} from '../cwa-store-types'
import CwaMercureState, { CwaMercureStateInterface } from './state'

/**
 * Interface Definitions
 */
export interface CwaMercureInterface extends CwaMercureStateInterface {}
export interface CwaMercureStoreInterface extends CwaPiniaStoreDefinitionInterface<`${string}.mercure`, CwaMercureInterface> {}
export interface CwaMercureStoreWithStateInterface extends CwaPiniaStoreInterface<`${string}.mercure`, CwaMercureInterface> {}

/**
 * Main Store Class
 */
export class MercureStore implements CwaStore {
  private readonly storeDefinition: CwaMercureStoreInterface

  constructor (storeName: string) {
    this.storeDefinition = defineStore(`${storeName}.mercure`, () => {
      const mercureState = CwaMercureState()
      return {
        ...mercureState
      }
    })
  }

  public useStore (): CwaMercureStoreWithStateInterface {
    return this.storeDefinition()
  }
}
