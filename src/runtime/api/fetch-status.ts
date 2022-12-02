import { AsyncData } from '#app'
import { FetchError } from 'ohmyfetch'
import {
  CwaResourcesInterface,
  ResourcesStore
} from '@cwa/nuxt-module/runtime/storage/stores/resources/resources-store'
import { reactive } from '#imports'

interface FetchStatusInterface {
  fetchingEndpoint?: string
  endpoints: { [key: string]: AsyncData<any, FetchError|null> }
  isFetching: boolean
  fetchedEndpoint?: string
  fetchedPageIri?: string
}

export default class FetchStatus {
  private status: FetchStatusInterface
  private resourcesStoreDefinition: ResourcesStore
  public loadedPageIri: string|null = null

  constructor (resourcesStore: ResourcesStore) {
    this.resourcesStoreDefinition = resourcesStore
    this.status = reactive({
      endpoints: {},
      isFetching: false
    })
  }

  /**
   * Data getters
   */
  public get path (): string|undefined {
    return this.status.fetchingEndpoint || this.status.fetchedEndpoint
  }

  public getFetchingEndpointPromise (endpoint: string): AsyncData<any, FetchError|null> | null {
    return this.status?.endpoints[endpoint] || null
  }

  /**
   * Interface for updating/managing the fetch state
   */
  public startFetch (endpoint: string): boolean {
    if (this.status.fetchingEndpoint === endpoint || this.status.fetchedEndpoint === endpoint) {
      return false
    }

    this.resourcesStore.resetCurrentResources()
    this.initFetchStatus(endpoint)
    return true
  }

  public addEndpoint (endpoint: string, promise: AsyncData<any, FetchError|null>) {
    if (!this.status.isFetching) {
      return
    }
    this.status.endpoints[endpoint] = promise
  }

  public finishFetch ({ endpoint, pageIri, success }: { endpoint: string, pageIri?: string, success: boolean }) {
    this.initFetchStatus(endpoint, pageIri, success)
  }

  /**
   * Internal
   */
  private initFetchStatus (endpoint: string, pageIri?: string, fetchSuccess?: boolean) {
    const isFetching = fetchSuccess === undefined
    // do not reset again is we are already in fetching process
    if (this.status.isFetching && isFetching) {
      return
    }
    this.status.fetchingEndpoint = isFetching ? endpoint : undefined
    this.status.endpoints = {}
    this.status.isFetching = isFetching
    // fetchedEndpoint should be the last successfully fetched endpoint
    if (fetchSuccess && !isFetching) {
      if (pageIri) {
        this.status.fetchedPageIri = pageIri
      }
      this.status.fetchedEndpoint = endpoint
    }
  }

  private get resourcesStore (): CwaResourcesInterface {
    return this.resourcesStoreDefinition.useStore()
  }
}
