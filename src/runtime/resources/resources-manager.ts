import { computed, ComputedRef } from 'vue'
import { ResourcesStore } from '../storage/stores/resources/resources-store'
import { CwaCurrentResourceInterface } from '../storage/stores/resources/state'
import { FetcherStore } from '../storage/stores/fetcher/fetcher-store'
import {
  CwaResourceTypes,
  getResourceTypeFromIri
} from './resource-utils'

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
  private get primaryResource () {
    const successFetchStatus = this.fetcherStore.resolvedSuccessFetchStatus
    if (!successFetchStatus) {
      return
    }
    return { path: successFetchStatus.path, type: getResourceTypeFromIri(successFetchStatus.path) }
  }

  public get pageIri (): string|undefined {
    const primaryResource = this.primaryResource
    if (!primaryResource || !primaryResource.type) {
      return
    }
    if (primaryResource.type === CwaResourceTypes.PAGE) {
      return primaryResource.path
    } else if ([CwaResourceTypes.ROUTE, CwaResourceTypes.PAGE_DATA].includes(primaryResource.type)) {
      const successResource = this.getResource(primaryResource.path).value
      return successResource.data.page
    }
  }

  private get page () {
    if (!this.pageIri) {
      return
    }
    return this.getResource(this.pageIri).value
  }

  public get layout (): ComputedRef<CwaCurrentResourceInterface|undefined> {
    return computed(() => {
      if (!this.pageIri) {
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
