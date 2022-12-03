import {
  _ExtractActionsFromSetupStore,
  _ExtractGettersFromSetupStore,
  _ExtractStateFromSetupStore,
  defineStore, StoreDefinition
} from 'pinia'
import { CwaStoreInterface } from '../cwa-store-interface'
import { ResourcesStore } from '../resources/resources-store'
import CwaFetcherActions, { CwaFetcherActionsInterface } from './actions'
import CwaFetcherState, { CwaFetcherStateInterface } from './state'

/**
 * Interface Definitions
 */
export interface CwaFetcherInterface extends CwaFetcherStateInterface, CwaFetcherActionsInterface {}
export interface CwaFetcherStoreInterface extends StoreDefinition<`${string}.fetcher`, _ExtractStateFromSetupStore<CwaFetcherInterface>, _ExtractGettersFromSetupStore<CwaFetcherInterface>, _ExtractActionsFromSetupStore<CwaFetcherInterface>> {}

/**
 * Main Store Class
 */
export class FetcherStore implements CwaStoreInterface {
  private readonly storeDefinition: CwaFetcherStoreInterface

  constructor (storeName: string, resourcesStore: ResourcesStore) {
    this.storeDefinition = defineStore(`${storeName}.fetcher`, (): CwaFetcherInterface => {
      const resourcesState = CwaFetcherState()
      return {
        ...resourcesState,
        ...CwaFetcherActions(resourcesState, resourcesStore)
      }
    })
  }

  public useStore (): CwaFetcherInterface {
    return this.storeDefinition()
  }
}
