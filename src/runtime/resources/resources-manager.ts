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

  // todo: this may be temporary, but if proves useful, functionality to be moved to a resources store getter and this as a proxy
  public get currentResources () {
    return this.resourcesStore.current.currentIds.reduce((obj, id: string) => {
      obj[id] = this.resourcesStore.current.byId[id]
      return obj
    }, {} as {
      [key: string]: CwaCurrentResourceInterface
    })
  }

  // todo: start: created this as a proxy so we can determine which page should be displayed currently and time the page change
  public get resources () {
    return this.currentResources
  }

  private get primaryResource () {
    const successFetchStatus = this.fetcherStore.resolvedSuccessFetchStatus
    if (!successFetchStatus) {
      return
    }
    return { path: successFetchStatus.path, type: getResourceTypeFromIri(successFetchStatus.path) }
  }

  private get pageIri (): string|undefined {
    const primaryResource = this.primaryResource
    if (!primaryResource || !primaryResource.type) {
      return
    }
    if (primaryResource.type === CwaResourceTypes.PAGE) {
      return primaryResource.path
    } else if ([CwaResourceTypes.ROUTE, CwaResourceTypes.PAGE_DATA].includes(primaryResource.type)) {
      const successResource = this.resourcesStore.current.byId[primaryResource.path]
      return successResource.data.page
    }
  }

  private get page () {
    if (!this.pageIri) {
      return
    }
    return this.resourcesStore.current.byId[this.pageIri]
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

      return this.resourcesStore.current.byId?.[pageResource.data?.layout]
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
