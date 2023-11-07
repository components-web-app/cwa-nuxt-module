import type {
  _ExtractActionsFromSetupStore,
  _ExtractGettersFromSetupStore,
  _ExtractStateFromSetupStore,
  SetupStoreDefinition,
  Store,
} from 'pinia'

export interface CwaStore {
  useStore(): any
}

export declare type CwaPiniaStoreDefinitionInterface<N extends string, I> = SetupStoreDefinition<N, I>
export declare type CwaPiniaStoreInterface<N extends string, I> = Store<N, _ExtractStateFromSetupStore<I>, _ExtractGettersFromSetupStore<I>, _ExtractActionsFromSetupStore<I>>
