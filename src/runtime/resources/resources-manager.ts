import { ResourcesStore } from '../storage/stores/resources/resources-store'
import { FetcherStore } from '../storage/stores/fetcher/fetcher-store'
import CwaFetch from '../api/fetcher/cwa-fetch'
import FetchStatusManager from '../api/fetcher/fetch-status-manager'
import { CwaResource } from './resource-utils'

interface CreateResourceEvent {
  endpoint: string
  data: any
}

interface RequestHeaders extends Record<string, string> {
  path: string
}

interface RequestOptions {
  headers: RequestHeaders
  method: 'POST'|'PUT'
}

export class ResourcesManager {
  private cwaFetch: CwaFetch
  private resourcesStoreDefinition: ResourcesStore
  private fetcherStoreDefinition: FetcherStore
  private fetchStatusManager: FetchStatusManager

  constructor (cwaFetch: CwaFetch, resourcesStoreDefinition: ResourcesStore, fetcherStoreDefinition: FetcherStore, fetchStatusManager: FetchStatusManager) {
    this.cwaFetch = cwaFetch
    this.resourcesStoreDefinition = resourcesStoreDefinition
    this.fetcherStoreDefinition = fetcherStoreDefinition
    this.fetchStatusManager = fetchStatusManager
  }

  public async createResource (event: CreateResourceEvent) {
    const resource = await this.cwaFetch.fetch<CwaResource>(
      event.endpoint,
      this.requestOptions('POST')
    )
    this.resourcesStore.saveResource({
      resource
    })
  }

  private requestOptions (method: 'POST'|'PUT'): RequestOptions {
    return {
      method,
      headers: {
        path: this.fetchStatusManager.primaryFetchPath || ''
      }
    }
  }

  private get fetcherStore () {
    return this.fetcherStoreDefinition.useStore()
  }

  private get resourcesStore () {
    return this.resourcesStoreDefinition.useStore()
  }
}
