import {
  CwaResourcesInterface,
  ResourcesStore
} from '@cwa/nuxt-module/runtime/storage/stores/resources/resources-store'
import { reactive } from '#imports'

interface FetchStatusInterface {
  fetchingEndpoint?: string|null
  endpoints: { [key: string]: Promise<any> }
  isFetching: boolean
  fetchedEndpoint?: string
}

export class FetchStatus {
  private status: FetchStatusInterface
  private resourcesStoreDefinition: ResourcesStore

  constructor (resourcesStore: ResourcesStore) {
    this.resourcesStoreDefinition = resourcesStore
    this.status = reactive({
      endpoints: {},
      isFetching: false
    })
  }

  private get resourcesStore (): CwaResourcesInterface {
    return this.resourcesStoreDefinition.useStore()
  }

  public startFetch (endpoint: string): boolean {
    if (this.status.fetchingEndpoint === endpoint || this.status.fetchedEndpoint === endpoint) {
      return false
    }

    this.resourcesStore.resetCurrentResources()
    this.initFetchStatus(endpoint)
    return true
  }

  public finishFetch (endpoint: string, success: boolean) {
    this.initFetchStatus(endpoint, success)
  }

  private initFetchStatus (endpoint: null|string = null, fetchSuccess?: boolean) {
    const isFetching = fetchSuccess === undefined
    // do not reset again is we are already in fetching process
    if (this.status.isFetching && isFetching) {
      return
    }
    this.status.fetchingEndpoint = isFetching ? endpoint : null
    this.status.endpoints = {}
    this.status.isFetching = isFetching
    if (this.status.fetchingEndpoint && fetchSuccess && !isFetching) {
      this.status.fetchedEndpoint = this.status.fetchingEndpoint
    }
  }
}
