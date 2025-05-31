import {
  defineStore,
} from 'pinia'
import type {
  CwaPiniaStoreDefinitionInterface,
  CwaPiniaStoreInterface,
  CwaStore,
} from '../cwa-store-types'

import CwaSiteConfigState, { type CwaSiteConfigStateInterface } from './state'
import CwaSiteConfigGetters, { type CwaSiteConfigGettersInterface } from './getters'
import CwaSiteConfigActions, { type CwaSiteConfigActionsInterface } from './actions'

/**
 * Interface Definitions
 */
export interface CwaSiteConfigInterface extends CwaSiteConfigStateInterface, CwaSiteConfigActionsInterface, CwaSiteConfigGettersInterface {}
export type CwaSiteConfigStoreDefinitionInterface = CwaPiniaStoreDefinitionInterface<`${string}.siteConfig`, CwaSiteConfigInterface>
export type CwaSiteConfigStoreInterface = CwaPiniaStoreInterface<`${string}.siteConfig`, CwaSiteConfigInterface>

/**
 * Main Store Class
 */
export class SiteConfigStore implements CwaStore {
  private readonly storeDefinition: CwaSiteConfigStoreDefinitionInterface

  constructor(storeName: string) {
    this.storeDefinition = defineStore(`${storeName}.siteConfig`, () => {
      const siteConfigState = CwaSiteConfigState()
      const getters = CwaSiteConfigGetters(siteConfigState)
      return {
        ...siteConfigState,
        ...getters,
        ...CwaSiteConfigActions(siteConfigState),
      }
    })
  }

  public useStore(): CwaSiteConfigStoreInterface {
    return this.storeDefinition()
  }
}
