import {
  _ExtractActionsFromSetupStore,
  _ExtractGettersFromSetupStore,
  _ExtractStateFromSetupStore, _StoreWithState,
  StoreDefinition
} from 'pinia'
import { CwaApiDocumentationStateInterface } from '@cwa/nuxt-module/runtime/storage/stores/api-documentation/state'

export interface CwaStoreInterface {
  useStore(): any
}

export declare type CwaPiniaStoreDefinitionInterface<N extends string, I> = StoreDefinition<N, _ExtractStateFromSetupStore<I>, _ExtractGettersFromSetupStore<I>, _ExtractActionsFromSetupStore<I>>
export declare type CwaPiniaStoreWithStateDefinitionInterface<N extends string, I> = _ExtractStateFromSetupStore<I> & _StoreWithState<N, _ExtractStateFromSetupStore<I>, _ExtractGettersFromSetupStore<I>, _ExtractActionsFromSetupStore<I>>
