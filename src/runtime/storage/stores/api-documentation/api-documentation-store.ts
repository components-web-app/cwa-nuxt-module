import {
  defineStore
} from 'pinia'
import type {
  CwaPiniaStoreDefinitionInterface,
  CwaPiniaStoreInterface,
  CwaStore
} from '../cwa-store-types'
import type { CwaApiDocumentationStateInterface } from './state'
import CwaApiDocumentationState from './state'

/**
 * Interface Definitions
 */
export interface CwaApiDocumentationInterface extends CwaApiDocumentationStateInterface {}
export interface CwaApiDocumentationStoreDefinitionInterface extends CwaPiniaStoreDefinitionInterface<`${string}.apiDocumentation`, CwaApiDocumentationInterface> {}
export interface CwaApiDocumentationStoreInterface extends CwaPiniaStoreInterface<`${string}.apiDocumentation`, CwaApiDocumentationInterface> {}

/**
 * Main Store Class
 */
export class ApiDocumentationStore implements CwaStore {
  private readonly storeDefinition: CwaApiDocumentationStoreDefinitionInterface

  constructor (storeName: string) {
    this.storeDefinition = defineStore(`${storeName}.apiDocumentation`, (): CwaApiDocumentationInterface => {
      const apiDocumentationState = CwaApiDocumentationState()
      return {
        ...apiDocumentationState
      }
    })
  }

  public useStore (): CwaApiDocumentationStoreInterface {
    return this.storeDefinition()
  }
}
