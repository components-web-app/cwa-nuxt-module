import {
  defineStore
} from 'pinia'
import type {
  CwaPiniaStoreDefinitionInterface,
  CwaPiniaStoreInterface,
  CwaStore
} from '../cwa-store-types'
import type { CwaMercureStateInterface } from './state'
import CwaMercureState from './state'

/**
 * Interface Definitions
 */
export interface CwaMercureInterface extends CwaMercureStateInterface {}
export interface CwaMercureStoreDefinitionInterface extends CwaPiniaStoreDefinitionInterface<`${string}.mercure`, CwaMercureInterface> {}
export interface CwaMercureStoreInterface extends CwaPiniaStoreInterface<`${string}.mercure`, CwaMercureInterface> {}

/**
 * Main Store Class
 */
export class MercureStore implements CwaStore {
  private readonly storeDefinition: CwaMercureStoreDefinitionInterface

  constructor (storeName: string) {
    this.storeDefinition = defineStore(`${storeName}.mercure`, () => {
      const mercureState = CwaMercureState()
      return {
        ...mercureState
      }
    })
  }

  public useStore (): CwaMercureStoreInterface {
    return this.storeDefinition()
  }
}
