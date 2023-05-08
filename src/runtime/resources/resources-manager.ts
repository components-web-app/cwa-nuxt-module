import { ResourcesStore } from '../storage/stores/resources/resources-store'
import { FetcherStore } from '../storage/stores/fetcher/fetcher-store'
import CwaFetch from '../api/fetcher/cwa-fetch'
import FetchStatusManager from '../api/fetcher/fetch-status-manager'
import { CwaResource } from './resource-utils'
import {
  DeleteResourceEvent,
  SaveNewResourceEvent,
  SaveResourceEvent
} from '@cwa/nuxt-module/runtime/storage/stores/resources/actions'

interface ApiResourceEvent {
  endpoint: string
  data: any
}

interface RequestHeaders extends Record<string, string> {}

interface RequestOptions {
  headers: RequestHeaders
  method: 'POST'|'PATCH'
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

  public async createResource (event: ApiResourceEvent) {
    const resource = await this.cwaFetch.fetch<CwaResource>(
      event.endpoint,
      { ...this.requestOptions('POST'), body: event.data }
    )
    this.saveResource({
      resource
    })
  }

  public async updateResource (event: ApiResourceEvent) {
    const resource = await this.cwaFetch.fetch<CwaResource>(
      event.endpoint,
      { ...this.requestOptions('PATCH'), body: event.data }
    )
    this.saveResource({
      resource
    })
  }

  public saveResource (event: SaveResourceEvent|SaveNewResourceEvent) {
    return this.resourcesStore.saveResource(event)
  }

  public deleteResource (event: DeleteResourceEvent) {
    return this.resourcesStore.deleteResource(event)
  }

  private requestOptions (method: 'POST'|'PATCH'): RequestOptions {
    const headers: {
      accept: string
      path?: string
      'Content-Type'?: string
    } = {
      accept: 'application/ld+json,application/json'
    }
    if (this.fetchStatusManager.primaryFetchPath) {
      headers.path = this.fetchStatusManager.primaryFetchPath
    }
    if (method === 'PATCH') {
      headers['Content-Type'] = 'application/merge-patch+json'
    }
    return {
      method,
      headers
    }
  }

  private get fetcherStore () {
    return this.fetcherStoreDefinition.useStore()
  }

  private get resourcesStore () {
    return this.resourcesStoreDefinition.useStore()
  }
}
