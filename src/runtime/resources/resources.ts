import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import { ResourcesStore } from '../storage/stores/resources/resources-store'
import { CwaResourceApiStatuses, NEW_RESOURCE_IRI } from '../storage/stores/resources/state'
import type { CwaCurrentResourceInterface } from '../storage/stores/resources/state'
import { FetcherStore } from '../storage/stores/fetcher/fetcher-store'
import type { FetchStatus } from '../storage/stores/fetcher/state'
import {
  CwaResourceTypes,
  getResourceTypeFromIri
} from './resource-utils'
import type ResourceStackManager from '#cwa/runtime/admin/resource-stack-manager'

interface PageLoadStatus {
  resources: (string|undefined)[]
  total: number
  complete: number
  percent: number
}

export class Resources {
  // eslint-disable-next-line no-useless-constructor
  constructor (private readonly resourcesStoreDefinition: ResourcesStore, private readonly fetcherStoreDefinition: FetcherStore, private readonly resourceManager: ResourceStackManager) {
  }

  public get currentIds () {
    return this.resourcesStore.current.currentIds
  }

  public isIriPublishableEquivalent (oldIri: string, newIri: string) {
    return this.resourcesStore.isIriPublishableEquivalent(oldIri, newIri)
  }

  public findAllPublishableIris (iri: string) {
    return this.resourcesStore.findAllPublishableIris(iri)
  }

  public getResource (id: string) {
    return computed(() => {
      return this.resourcesStore.getResource(id)
    })
  }

  public get newResource () {
    return computed(() => this.resourcesStore.getResource(NEW_RESOURCE_IRI))
  }

  public getComponentGroupByReference (reference: string) {
    const componentGroups = this.resourcesStore.resourcesByType[CwaResourceTypes.COMPONENT_GROUP]
    return componentGroups.find((componentGroupResource) => {
      return componentGroupResource.data?.reference === reference
    })
  }

  public get currentResources () {
    return this.resourcesStore.current.currentIds.reduce((obj, id: string) => {
      const idResource = this.getResource(id).value
      if (idResource) {
        obj[id] = idResource
      }
      return obj
    }, {} as {
      [key: string]: CwaCurrentResourceInterface
    })
  }

  private get displayFetchStatus () {
    const fetchingToken = this.fetcherStore.primaryFetch.fetchingToken
    // if the page is fetched in a primary fetching token in progress we start showing that page load progress
    if (fetchingToken) {
      const fetchingStatus = this.fetcherStore.fetches[fetchingToken]
      if (fetchingStatus) {
        const pageIri = this.getPageIriByFetchStatus(fetchingStatus)
        if (pageIri && this.resourcesStore.current.currentIds.includes(pageIri)) {
          const pageResource = this.getResource(pageIri).value
          if (pageResource?.data && pageResource.apiState.status === CwaResourceApiStatuses.SUCCESS) {
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

      const percent = complete ? Math.round((complete / total) * 100) : 0

      return {
        resources: pageLoadResources,
        total,
        complete,
        percent
      }
    })
  }

  public isPageDataResource (iri: Ref<string|undefined>) {
    return computed(() => {
      if (!this.pageData?.value?.data || !iri.value) {
        return false
      }
      if (getResourceTypeFromIri(iri.value) !== CwaResourceTypes.COMPONENT) {
        return false
      }
      return Object.values(this.pageData.value.data).includes(iri.value)
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
    if (!type) {
      return
    }
    if (!fetchStatus?.path) {
      return
    }

    if (type === CwaResourceTypes.PAGE) {
      return fetchStatus.path
    }
    const successResource = this.getResource(fetchStatus.path).value
    if (!successResource) {
      return
    }
    switch (type) {
      case CwaResourceTypes.PAGE_DATA: {
        return successResource.data?.page
      }
      case CwaResourceTypes.ROUTE: {
        const pageData = successResource.data?.pageData
        if (pageData) {
          const pageDataResource = this.getResource(pageData).value
          return pageDataResource?.data?.page
        }
        return successResource.data?.page
      }
    }
  }

  public get pageDataIri () {
    return computed(() => {
      const fetchStatus = this.displayFetchStatus
      const type = this.getFetchStatusType(fetchStatus)
      if (!type) {
        return
      }
      if (!fetchStatus?.path) {
        return
      }
      if (type === CwaResourceTypes.PAGE_DATA) {
        return fetchStatus.path
      }
      const successResource = this.getResource(fetchStatus.path).value
      return type === CwaResourceTypes.ROUTE ? successResource?.data?.pageData : undefined
    })
  }

  public get pageData () {
    if (!this.pageDataIri.value) {
      return
    }
    return this.getResource(this.pageDataIri.value)
  }

  public get pageIri (): ComputedRef<string|undefined> {
    return computed(() => this.getPageIriByFetchStatus(this.displayFetchStatus))
  }

  public get page () {
    if (!this.pageIri.value) {
      return
    }
    return this.getResource(this.pageIri.value)
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

  public findPublishedComponentIri (iri: string) {
    return computed(() => {
      return this.resourcesStore.findPublishedComponentIri(iri)
    })
  }

  public findDraftComponentIri (iri: string) {
    return computed(() => {
      return this.resourcesStore.findDraftComponentIri(iri)
    })
  }

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

  public get usesPageTemplate () {
    return computed(() => !!this.page?.value?.data?.isTemplate)
  }

  public get isDataPage () {
    return computed(() => {
      return this.usesPageTemplate.value && !!this.pageDataIri.value
    })
  }

  public get isDynamicPage () {
    return computed(() => {
      return this.usesPageTemplate.value && !this.pageDataIri.value
    })
  }

  public get hasNewResources () {
    return this.resourcesStore.hasNewResources
  }
}
