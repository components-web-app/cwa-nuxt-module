import { AsyncData } from '#app'
import { FetchError } from 'ohmyfetch'
import { CwaFetcherAsyncResponse } from './fetcher'
import {
  CwaResourcesInterface,
  ResourcesStore
} from '@cwa/nuxt-module/runtime/storage/stores/resources/resources-store'
import { reactive } from '#imports'

interface FetchStatusInterface {
  fetchingEndpoint?: string
  endpoints: { [key: string]: CwaFetcherAsyncResponse }
  isFetching: boolean
  fetchedEndpoint?: string
  fetchedPage?: {
    pageIri: string
    endpoint: string
  }
}

interface FinishFetchEvent {
  endpoint: string
  pageIri?: string
  success?: boolean
}

export default class FetchStatus {
  private status: FetchStatusInterface
  private resourcesStoreDefinition: ResourcesStore

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
  public startFetch (endpoint: string): CwaFetcherAsyncResponse|null {
    if (this.status.fetchingEndpoint !== undefined) {
      // we are in the process of fetching
      // do we have a promise to return for this resource already / prevent duplicate response in the stack of requests..
      return this.status.endpoints[endpoint] || null
    }

    this.resourcesStore.resetCurrentResources()
    this.initFetchStatus({ endpoint })
    return null
  }

  public addEndpoint (endpoint: string, promise: CwaFetcherAsyncResponse) {
    if (!this.status.isFetching) {
      return
    }
    this.status.endpoints[endpoint] = promise
  }

  public finishFetch ({ endpoint, pageIri, success }: FinishFetchEvent & { success: boolean }) {
    this.initFetchStatus({
      endpoint,
      pageIri,
      success
    })
  }

  /**
   * Internal
   */
  private initFetchStatus ({ endpoint, pageIri, success }: FinishFetchEvent) {
    const isFetching = success === undefined
    // do not start/finish if the primary endpoint is different, or do not start if already in progress
    if (endpoint !== this.status.fetchingEndpoint || (this.status.isFetching && isFetching)) {
      return
    }

    // fetchedEndpoint should be the last successfully fetched endpoint
    if (success && !isFetching && this.status.fetchingEndpoint) {
      if (pageIri) {
        this.status.fetchedPage = {
          endpoint: this.status.fetchingEndpoint,
          pageIri
        }
      }
      this.status.fetchedEndpoint = this.status.fetchingEndpoint
    }

    this.status.fetchingEndpoint = isFetching ? endpoint : undefined
    this.status.endpoints = {}
    this.status.isFetching = isFetching
  }

  private get resourcesStore (): CwaResourcesInterface {
    return this.resourcesStoreDefinition.useStore()
  }
}
