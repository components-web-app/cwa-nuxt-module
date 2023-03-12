import {
  ResourcesStore
} from './stores/resources/resources-store'
import { FetcherStore } from './stores/fetcher/fetcher-store'
import { MercureStore } from './stores/mercure/mercure-store'
import {
  ApiDocumentationStore
} from './stores/api-documentation/api-documentation-store'

export interface CwaStores {
  resources: ResourcesStore
  fetcher: FetcherStore
  mercure: MercureStore
  apiDocumentation: ApiDocumentationStore
}

export class Storage {
  private readonly storeName: string
  public readonly stores: CwaStores

  constructor (storeName: string) {
    this.storeName = storeName

    this.stores = {
      resources: new ResourcesStore(storeName),
      fetcher: new FetcherStore(storeName),
      mercure: new MercureStore(storeName),
      apiDocumentation: new ApiDocumentationStore(storeName)
    }
  }
}
