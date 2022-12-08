import {
  defineStore
} from 'pinia'
import {
  CwaPiniaStoreDefinitionInterface,
  CwaPiniaStoreWithStateDefinitionInterface,
  CwaStoreInterface
} from '../cwa-store-interface'
import CwaMercureState, { CwaMercureStateInterface } from './state'

/**
 * Interface Definitions
 */
export interface CwaMercureInterface extends CwaMercureStateInterface {}
export interface CwaMercureStoreInterface extends CwaPiniaStoreDefinitionInterface<`${string}.mercure`, CwaMercureInterface> {}
export interface CwaMercureStoreWithStateInterface extends CwaPiniaStoreWithStateDefinitionInterface<`${string}.mercure`, CwaMercureInterface> {}

/**
 * Main Store Class
 */
export class MercureStore implements CwaStoreInterface {
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
