import { computed, ComputedRef } from 'vue'
import { ResourcesStore } from '../storage/stores/resources/resources-store'
import { CwaCurrentResourceInterface, CwaResourceApiStatuses } from '../storage/stores/resources/state'
import { FetcherStore } from '../storage/stores/fetcher/fetcher-store'
import {
  CwaResourceTypes,
  getResourceTypeFromIri
} from './resource-utils'
import { FetchStatus } from '@cwa/nuxt-module/runtime/storage/stores/fetcher/state'

export class ResourcesManager {
  private resourcesStoreDefinition: ResourcesStore
  private fetcherStoreDefinition: FetcherStore

  constructor (resourcesStoreDefinition: ResourcesStore, fetcherStoreDefinition: FetcherStore) {
    this.resourcesStoreDefinition = resourcesStoreDefinition
    this.fetcherStoreDefinition = fetcherStoreDefinition
  }

  public get currentIds () {
    return this.resourcesStore.current.currentIds
  }

  public getResource (id: string) {
    return computed(() => this.resourcesStore.current.byId?.[id])
  }

  // todo: this may be temporary, but if proves useful, functionality to be moved to a resources store getter and this as a proxy
  public get currentResources () {
    return this.resourcesStore.current.currentIds.reduce((obj, id: string) => {
      obj[id] = this.getResource(id).value
      return obj
    }, {} as {
      [key: string]: CwaCurrentResourceInterface
    })
  }

  // todo: start
  private get displayFetchStatus () {
    const fetchingToken = this.fetcherStore.primaryFetch.fetchingToken
    // if the page is fetched in a primary fetching token in progress we start showing that page load progress
    if (fetchingToken) {
      const fetchingStatus = this.fetcherStore.fetches[fetchingToken]
      if (fetchingStatus) {
        const pageIri = this.getPageIriByFetchStatus(fetchingStatus)
        if (pageIri) {
          const pageResource = this.getResource(pageIri).value
          if (pageResource && pageResource.apiState.status === CwaResourceApiStatuses.SUCCESS) {
            return fetchingStatus
          }
        }
      }
    }
    return this.fetcherStore.resolvedSuccessFetchStatus
  }

  private getPageIriByFetchStatus (fetchStatus?: FetchStatus): string|undefined {
    if (!fetchStatus) {
      return
    }
    const type = getResourceTypeFromIri(fetchStatus.path)
    if (!type) {
      return
    }
    if (type === CwaResourceTypes.PAGE) {
      return fetchStatus.path
    } else if ([CwaResourceTypes.ROUTE, CwaResourceTypes.PAGE_DATA].includes(type)) {
      const successResource = this.getResource(fetchStatus.path).value
      return successResource.data?.page
    }
  }

  public get pageIri (): ComputedRef<string|undefined> {
    return computed(() => this.getPageIriByFetchStatus(this.displayFetchStatus))
  }

  private get page () {
    if (!this.pageIri.value) {
      return
    }
    return this.getResource(this.pageIri.value).value
  }

  public get layout (): ComputedRef<CwaCurrentResourceInterface|undefined> {
    return computed(() => {
      if (!this.pageIri.value) {
        return
      }

      const pageResource = this.page
      if (!pageResource) {
        return
      }

      return this.getResource(pageResource.data?.layout).value
    })
  }

  // todo: end

  public get isLoading (): ComputedRef<boolean> {
    return computed(() => {
      return !this.fetcherStore.fetchesResolved || !!this.resourceLoadStatus.pending
    })
  }

  public get resourceLoadStatus () {
    return this.resourcesStore.resourceLoadStatus
  }

  private get fetcherStore () {
    return this.fetcherStoreDefinition.useStore()
  }

  private get resourcesStore () {
    return this.resourcesStoreDefinition.useStore()
  }
}
