import {
  defineStore
} from 'pinia'
import {
  CwaPiniaStoreDefinitionInterface,
  CwaPiniaStoreInterface,
  CwaStore
} from '../cwa-store-types'
import { ResourcesStore } from '../resources/resources-store'
import CwaFetcherActions, { CwaFetcherActionsInterface } from './actions'
import CwaFetcherState, { CwaFetcherStateInterface } from './state'
import CwaFetcherGetters, { CwaFetcherGettersInterface } from './getters'

/**
 * Interface Definitions
 */
export interface CwaFetcherInterface extends CwaFetcherStateInterface, CwaFetcherActionsInterface, CwaFetcherGettersInterface {}
export interface CwaFetcherStoreDefinitionInterface extends CwaPiniaStoreDefinitionInterface<`${string}.fetcher`, CwaFetcherInterface> {}
export interface CwaFetcherStoreInterface extends CwaPiniaStoreInterface<`${string}.fetcher`, CwaFetcherInterface> {}

/**
 * Main Store Class
 */
export class FetcherStore implements CwaStore {
  private readonly storeDefinition: CwaFetcherStoreDefinitionInterface

  constructor (storeName: string, resourcesStore: ResourcesStore) {
    this.storeDefinition = defineStore(`${storeName}.fetcher`, (): CwaFetcherInterface => {
      const fetcherState = CwaFetcherState()
      const getters = CwaFetcherGetters(fetcherState)
      return {
        ...fetcherState,
        ...getters,
        ...CwaFetcherActions(fetcherState, getters, resourcesStore)
      }
    })
  }

  public useStore (): CwaFetcherStoreInterface {
    return this.storeDefinition()
  }
}
