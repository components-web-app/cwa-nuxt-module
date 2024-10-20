import { defineStore } from 'pinia'

import type {
  CwaPiniaStoreDefinitionInterface,
  CwaPiniaStoreInterface,
  CwaStore,
} from '../cwa-store-types'
import type { CwaErrorStateInterface } from './state'
import CwaErrorState from './state'
import type { CwaErrorActionsInterface } from './actions'
import CwaErrorActions from './actions'
import CwaErrorGetters from './getters'
import type { CwaErrorsGettersInterface } from './getters'

export interface CwaErrorInterface extends CwaErrorStateInterface, CwaErrorActionsInterface, CwaErrorsGettersInterface {}
export type CwaErrorStoreDefinitionInterface = CwaPiniaStoreDefinitionInterface<`${string}.error`, CwaErrorInterface>
export type CwaErrorStoreInterface = CwaPiniaStoreInterface<`${string}.error`, CwaErrorInterface>

export class ErrorStore implements CwaStore {
  private readonly storeDefinition: CwaErrorStoreDefinitionInterface

  constructor(storeName: string) {
    this.storeDefinition = defineStore(`${storeName}.error`, () => {
      const errorState = CwaErrorState()
      const getters = CwaErrorGetters(errorState)
      return {
        ...errorState,
        ...getters,
        ...CwaErrorActions(errorState),
      }
    })
  }

  public useStore(): CwaErrorStoreInterface {
    return this.storeDefinition()
  }
}
