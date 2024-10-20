import {
  defineStore,
} from 'pinia'
import type {
  CwaPiniaStoreDefinitionInterface,
  CwaPiniaStoreInterface,
  CwaStore,
} from '../cwa-store-types'
import type { CwaApiDocumentationStateInterface } from './state'
import CwaApiDocumentationState from './state'

/**
 * Interface Definitions
 */
export type CwaApiDocumentationInterface = CwaApiDocumentationStateInterface
export type CwaApiDocumentationStoreDefinitionInterface = CwaPiniaStoreDefinitionInterface<`${string}.apiDocumentation`, CwaApiDocumentationInterface>
export type CwaApiDocumentationStoreInterface = CwaPiniaStoreInterface<`${string}.apiDocumentation`, CwaApiDocumentationInterface>

/**
 * Main Store Class
 */
export class ApiDocumentationStore implements CwaStore {
  private readonly storeDefinition: CwaApiDocumentationStoreDefinitionInterface

  constructor(storeName: string) {
    this.storeDefinition = defineStore(`${storeName}.apiDocumentation`, (): CwaApiDocumentationInterface => {
      const apiDocumentationState = CwaApiDocumentationState()
      return {
        ...apiDocumentationState,
      }
    })
  }

  public useStore(): CwaApiDocumentationStoreInterface {
    return this.storeDefinition()
  }
}
