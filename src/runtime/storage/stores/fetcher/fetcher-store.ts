import {
  defineStore
} from 'pinia'
import type {
  CwaPiniaStoreDefinitionInterface,
  CwaPiniaStoreInterface,
  CwaStore
} from '../cwa-store-types'
import type { CwaFetcherActionsInterface } from './actions'
import type { CwaFetcherStateInterface } from './state'
import type { CwaFetcherGettersInterface } from './getters'
import CwaFetcherActions from './actions'
import CwaFetcherState from './state'
import CwaFetcherGetters from './getters'

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

  constructor (storeName: string) {
    this.storeDefinition = defineStore(`${storeName}.fetcher`, (): CwaFetcherInterface => {
      const fetcherState = CwaFetcherState()
      const getters = CwaFetcherGetters(fetcherState)
      return {
        ...fetcherState,
        ...getters,
        ...CwaFetcherActions(fetcherState, getters)
      }
    })
  }

  public useStore (): CwaFetcherStoreInterface {
    return this.storeDefinition()
  }
}
