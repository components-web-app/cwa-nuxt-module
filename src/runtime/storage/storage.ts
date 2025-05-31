import {
  ResourcesStore,
} from './stores/resources/resources-store'
import { FetcherStore } from './stores/fetcher/fetcher-store'
import { MercureStore } from './stores/mercure/mercure-store'
import {
  ApiDocumentationStore,
} from './stores/api-documentation/api-documentation-store'
import { AuthStore } from './stores/auth/auth-store'
import { AdminStore } from './stores/admin/admin-store'
import { ErrorStore } from './stores/error/error-store'
import { SiteConfigStore } from '#cwa/runtime/storage/stores/site-config/site-config-store'

export interface CwaStores {
  resources: ResourcesStore
  fetcher: FetcherStore
  mercure: MercureStore
  apiDocumentation: ApiDocumentationStore
  auth: AuthStore
  admin: AdminStore
  error: ErrorStore
  siteConfig: SiteConfigStore
}

export class Storage {
  public readonly stores: CwaStores

  constructor(storeName: string) {
    this.stores = {
      resources: new ResourcesStore(storeName),
      fetcher: new FetcherStore(storeName),
      mercure: new MercureStore(storeName),
      apiDocumentation: new ApiDocumentationStore(storeName),
      auth: new AuthStore(storeName),
      admin: new AdminStore(storeName),
      error: new ErrorStore(storeName),
      siteConfig: new SiteConfigStore(storeName),
    }
  }
}
