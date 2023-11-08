import { defineStore } from 'pinia'

import type {
  CwaPiniaStoreDefinitionInterface,
  CwaPiniaStoreInterface,
  CwaStore
} from '../cwa-store-types'
import type { CwaErrorStateInterface } from './state'
import CwaErrorState from './state'
import type { CwaErrorActionsInterface } from './actions'
import CwaErrorActions from './actions'

export interface CwaErrorInterface extends CwaErrorStateInterface, CwaErrorActionsInterface {}
export interface CwaErrorStoreDefinitionInterface extends CwaPiniaStoreDefinitionInterface<`${string}.error`, CwaErrorInterface> {}
export interface CwaErrorStoreInterface extends CwaPiniaStoreInterface<`${string}.error`, CwaErrorInterface> {}

export class ErrorStore implements CwaStore {
  private readonly storeDefinition: CwaErrorStoreDefinitionInterface

  constructor (storeName: string) {
    this.storeDefinition = defineStore(`${storeName}.error`, () => {
      const errorState = CwaErrorState()
      return {
        ...errorState,
        ...CwaErrorActions(errorState)
      }
    })
  }

  public useStore (): CwaErrorStoreInterface {
    return this.storeDefinition()
  }
}
