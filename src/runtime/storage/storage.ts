import { reactive } from 'vue'
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
import { SiteConfigStore } from '#cwa/storage/stores/site-config/site-config-store'

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
  private readonly uniquePromiseStore: Record<string, Map<string, Promise<void>>>

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
    this.uniquePromiseStore = {}
  }

  private getUniquePromiseStore(scope: string) {
    const existingMap = this.uniquePromiseStore[scope]
    if (existingMap) {
      return existingMap
    }
    this.uniquePromiseStore[scope] = reactive(new Map())
    return this.uniquePromiseStore[scope]
  }

  public addUniquePromise(scope: string, key: string, fn: () => Promise<void>) {
    const map = this.getUniquePromiseStore(scope)
    if (map.has(key)) {
      return map.get(key)
    }
    const requestPromise = fn()
      .finally(() => {
        map.delete(key)
      })
    map.set(key, requestPromise)
  }
}
