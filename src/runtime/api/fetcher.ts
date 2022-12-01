import { $Fetch, $fetch } from 'ohmyfetch'
import { Storage } from '../storage/storage'
import { CwaResourcesInterface, ResourcesStore } from '../storage/stores/resources/resources-store'
import { Mercure } from './mercure'
import { FetchStatus } from '@cwa/nuxt-module/runtime/api/fetch-status'

interface FetchStatusInterface {
  fetchingEndpoint?: string|null
  endpoints: { [key: string]: Promise<any> }
  isFetching: boolean
  fetchedEndpoint?: string
}

export class Fetcher {
  private readonly mercure: Mercure
  private readonly resourcesStoreDefinition: ResourcesStore
  private fetchStatus: FetchStatus
  private $fetch: $Fetch

  constructor (apiUrl: string, resourcesStore: ResourcesStore) {
    this.mercure = new Mercure()
    this.resourcesStoreDefinition = resourcesStore
    this.fetchStatus = new FetchStatus(this.resourcesStoreDefinition)
    this.$fetch = $fetch.create({ baseURL: apiUrl })
  }

  private get resourcesStore (): CwaResourcesInterface {
    return this.resourcesStoreDefinition.useStore()
  }

  public fetchRoute (path: string) {
    if (!this.fetchStatus.startFetch(path)) {
      return
    }
    console.log('fetchRoute TO DO', path)
    this.fetchStatus.finishFetch(path, false)
  }

  public fetchPage (pageIri: string) {
    if (!this.fetchStatus.startFetch(pageIri)) {
      return
    }
    console.log('fetchPage TO DO', pageIri)
    this.fetchStatus.finishFetch(pageIri, false)
  }

  public fetchPageData (pageDataIri: string) {
    if (!this.fetchStatus.startFetch(pageDataIri)) {
      return
    }
    console.log('fetchPageData TO DO', pageDataIri)
    this.fetchStatus.finishFetch(pageDataIri, false)
  }

  public fetchResource (endpoint: string) {
    if (!this.fetchStatus.startFetch(endpoint)) {
      return
    }
    console.log('fetchResource TO DO', endpoint)
    this.fetchStatus.finishFetch(endpoint, false)
  }

  private fetchBatch ({ endpoints }: { endpoints: Array<string> }): void {}

  private fetchComponent (endpoint: string) {}
}
