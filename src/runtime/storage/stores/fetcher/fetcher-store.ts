import {
  defineStore
} from 'pinia'
import {
  CwaPiniaStoreDefinitionInterface,
  CwaPiniaStoreWithStateDefinitionInterface,
  CwaStoreInterface
} from '../cwa-store-interface'
import { ResourcesStore } from '../resources/resources-store'
import CwaFetcherActions, { CwaFetcherActionsInterface } from './actions'
import CwaFetcherState, { CwaFetcherStateInterface } from './state'

/**
 * Interface Definitions
 */
export interface CwaFetcherInterface extends CwaFetcherStateInterface, CwaFetcherActionsInterface {}
export interface CwaFetcherStoreInterface extends CwaPiniaStoreDefinitionInterface<`${string}.fetcher`, CwaFetcherInterface> {}
export interface CwaFetcherStoreWithStateInterface extends CwaFetcherInterface, CwaPiniaStoreWithStateDefinitionInterface<`${string}.fetcher`, CwaFetcherInterface> {}

/**
 * Main Store Class
 */
export class FetcherStore implements CwaStoreInterface {
  private readonly storeDefinition: CwaFetcherStoreInterface

  constructor (storeName: string, resourcesStore: ResourcesStore) {
    this.storeDefinition = defineStore(`${storeName}.fetcher`, (): CwaFetcherInterface => {
      const fetcherState = CwaFetcherState()
      return {
        ...fetcherState,
        ...CwaFetcherActions(fetcherState, resourcesStore)
      }
    })
  }

  public useStore (): CwaFetcherStoreWithStateInterface {
    return this.storeDefinition()
  }
}
