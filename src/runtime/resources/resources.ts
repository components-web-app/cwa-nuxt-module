import { computed, ComputedRef } from 'vue'
import { ResourcesStore } from '../storage/stores/resources/resources-store'
import { CwaCurrentResourceInterface, CwaResourceApiStatuses } from '../storage/stores/resources/state'
import { FetcherStore } from '../storage/stores/fetcher/fetcher-store'
import {
  CwaResourceTypes,
  getResourceTypeFromIri
} from './resource-utils'
import { FetchStatus } from '@cwa/nuxt-module/runtime/storage/stores/fetcher/state'

interface PageLoadStatus {
  resources: (string|undefined)[]
  total: number
  complete: number
  percent: number
}

export class Resources {
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

  public checkResourceTypeExistence (id: string, type: CwaResourceTypes): boolean {
    return !!this.resourcesStore.resourcesByType[type].find(resource => resource.data?.['@id'] === id)
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
        if (pageIri && this.resourcesStore.current.currentIds.includes(pageIri)) {
          const pageResource = this.getResource(pageIri).value
          if (pageResource.data && pageResource.apiState.status === CwaResourceApiStatuses.SUCCESS) {
            return fetchingStatus
          }
        }
      }
    }
    return this.fetcherStore.resolvedSuccessFetchStatus
  }

  private get pageLoadResources () {
    const token = this.fetcherStore.primaryFetch.fetchingToken
    if (!token) {
      return
    }
    const fetchStatus = this.fetcherStore.fetches[token]
    if (!fetchStatus) {
      return
    }
    const type = this.getFetchStatusType(fetchStatus)
    if (!type) {
      return
    }

    const resources: (string|undefined)[] = [
      this.getLayoutIriByFetchStatus(fetchStatus),
      this.getPageIriByFetchStatus(fetchStatus)
    ]

    if (type === CwaResourceTypes.ROUTE || type === CwaResourceTypes.PAGE_DATA) {
      resources.push(fetchStatus.path)
    }

    if (type === CwaResourceTypes.ROUTE) {
      const routeResource = this.getResource(fetchStatus.path).value
      if (routeResource) {
        const pageDataIri = routeResource.data?.value?.pageData
        if (pageDataIri) {
          resources.push(pageDataIri)
        }
      }
    }

    return resources
  }

  public get pageLoadProgress (): ComputedRef<PageLoadStatus> {
    return computed<PageLoadStatus>(() => {
      const pageLoadResources = this.pageLoadResources
      if (!pageLoadResources) {
        return {
          resources: [],
          total: 0,
          complete: 0,
          percent: 100
        }
      }

      const total = pageLoadResources.length
      let complete = 0
      for (const resourceIri of pageLoadResources) {
        if (!resourceIri) {
          continue
        }
        const resource = this.getResource(resourceIri).value
        if (resource?.apiState.status !== CwaResourceApiStatuses.IN_PROGRESS) {
          complete++
        }
      }

      let percent
      if (complete === 0) {
        percent = total === 0 ? 100 : 0
      } else {
        percent = Math.round((complete / total) * 100)
      }

      return {
        resources: pageLoadResources,
        total,
        complete,
        percent
      }
    })
  }

  private getFetchStatusType (fetchStatus?: FetchStatus): undefined|string {
    if (!fetchStatus) {
      return
    }
    const type = getResourceTypeFromIri(fetchStatus.path)
    if (!type) {
      return
    }
    return type
  }

  private getLayoutIriByFetchStatus (fetchStatus?: FetchStatus): string|undefined {
    const pageIri = this.getPageIriByFetchStatus(fetchStatus)
    if (!pageIri) {
      return
    }
    const pageResource = this.getResource(pageIri).value
    return pageResource?.data?.layout
  }

  private getPageIriByFetchStatus (fetchStatus?: FetchStatus): string|undefined {
    const type = this.getFetchStatusType(fetchStatus)
    if (!fetchStatus || !type) {
      return
    }

    if (type === CwaResourceTypes.PAGE) {
      return fetchStatus.path
    }
    const successResource = this.getResource(fetchStatus.path).value
    switch (type) {
      case CwaResourceTypes.PAGE_DATA: {
        return successResource.data?.page
      }
      case CwaResourceTypes.ROUTE: {
        const pageData = successResource.data?.pageData
        if (pageData) {
          const pageDataResource = this.getResource(pageData).value
          return pageDataResource.data?.page
        }
        return successResource.data?.page
      }
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

  public get layoutIri (): ComputedRef<string|undefined> {
    return computed(() => this.getLayoutIriByFetchStatus(this.displayFetchStatus))
  }

  public get layout (): ComputedRef<CwaCurrentResourceInterface|undefined> {
    return computed(() => {
      const layoutIri = this.layoutIri.value
      if (!layoutIri) {
        return
      }
      return this.getResource(layoutIri).value
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
