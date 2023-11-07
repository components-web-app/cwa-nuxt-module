import type {
  SetupStoreDefinition,
  Store,
  StoreActions,
  StoreGetters,
  StoreState
} from 'pinia'

export interface CwaStore {
  useStore(): any
}

export declare type CwaPiniaStoreDefinitionInterface<N extends string, I> = SetupStoreDefinition<N, I>
export declare type CwaPiniaStoreInterface<N extends string, I> = Store<N, StoreState<I>, StoreGetters<I>, StoreActions<I>>
