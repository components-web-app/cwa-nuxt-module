import {
  _ExtractStateFromSetupStore,
  defineStore
} from 'pinia'
import {
  CwaPiniaStoreDefinitionInterface,
  CwaPiniaStoreInterface,
  CwaStore
} from '../cwa-store-types'
import CwaApiDocumentationState, { CwaApiDocumentationStateInterface } from './state'

/**
 * Interface Definitions
 */
export interface CwaApiDocumentationInterface extends CwaApiDocumentationStateInterface {}
export interface CwaApiDocumentationStoreInterface extends CwaPiniaStoreDefinitionInterface<`${string}.apiDocumentation`, CwaApiDocumentationInterface> {}
export interface CwaApiDocumentationStoreWithStateInterface extends CwaPiniaStoreInterface<`${string}.apiDocumentation`, CwaApiDocumentationInterface> {}

/**
 * Main Store Class
 */
export class ApiDocumentationStore implements CwaStore {
  private readonly storeDefinition: CwaApiDocumentationStoreInterface

  constructor (storeName: string) {
    this.storeDefinition = defineStore(`${storeName}.apiDocumentation`, (): CwaApiDocumentationInterface => {
      const apiDocumentationState = CwaApiDocumentationState()
      return {
        ...apiDocumentationState
      }
    })
  }

  public useStore (): CwaApiDocumentationStoreWithStateInterface {
    return this.storeDefinition()
  }
}
