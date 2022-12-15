import { computed, watch } from 'vue'
import Mercure from '../mercure'
import ApiDocumentation from '../api-documentation'
import { FetcherStore } from '../../storage/stores/fetcher/fetcher-store'
import {
  AddFetchResourceEvent,
  FinishFetchEvent, ManifestErrorFetchEvent,
  ManifestSuccessFetchEvent,
  StartFetchEvent
} from '../../storage/stores/fetcher/actions'
import { ResourcesStore } from '../../storage/stores/resources/resources-store'
import { createCwaResourceError, CwaResourceError } from '../../errors/cwa-resource-error'
import { isCwaResource } from '../../resources/resource-utils'
import { CwaFetchResponse } from './fetcher'

export interface FinishFetchResourceEvent {
  resource: string,
  success: boolean,
  token: string
}

export interface FinishFetchResourceSuccessEvent extends FinishFetchResourceEvent {
  success: true
  fetchResponse: CwaFetchResponse
}

export interface FinishFetchResourceErrorEvent extends FinishFetchResourceEvent {
  success: false
  error?: CwaResourceError
}

/**
 * This class manages the state across the fetcher store, resources store and additional services for API Documentation and Mercure
 */
export default class FetchStatusManager {
  private fetcherStoreDefinition: FetcherStore
  private readonly mercure: Mercure
  private readonly apiDocumentation: ApiDocumentation
  private resourcesStoreDefinition: ResourcesStore

  constructor (
    fetcherStoreDefinition: FetcherStore,
    mercure: Mercure,
    apiDocumentation: ApiDocumentation,
    resourcesStoreDefinition: ResourcesStore
  ) {
    this.fetcherStoreDefinition = fetcherStoreDefinition
    this.mercure = mercure
    this.apiDocumentation = apiDocumentation
    this.resourcesStoreDefinition = resourcesStoreDefinition
  }

  public startFetch (event: StartFetchEvent) {
    const startFetchStatus = this.fetcherStore.startFetch(event)
    if (event.isPrimary) {
      this.resourcesStore.resetCurrentResources(startFetchStatus.resources)
    }
    if (!startFetchStatus.continue) {
      this.mercure.init()
    }
    return startFetchStatus
  }

  public startFetchResource (event: AddFetchResourceEvent) {
    const addedToFetcherResources = this.fetcherStore.addFetchResource(event)
    if (addedToFetcherResources) {
      this.resourcesStore.setResourceFetchStatus({ iri: event.resource, isComplete: false })
    }
    return addedToFetcherResources
  }

  public finishFetchResource (event: FinishFetchResourceSuccessEvent|FinishFetchResourceErrorEvent) {
    if (!event.success) {
      this.resourcesStore.setResourceFetchError({ iri: event.resource, error: event.error, isCurrent: true })
      return
    }

    if (!this.fetcherStore.isCurrentFetchingToken(event.token)) {
      this.resourcesStore.setResourceFetchError({
        iri: event.resource,
        // TODO: TEST
        error: createCwaResourceError(new Error(`Not Saved. Fetching token '${event.token}' is no longer current`)),
        isCurrent: false
      })
      return
    }

    /**
     * TODO: TO TEST
     */
    const cwaResource = event.fetchResponse._data

    if (!isCwaResource(cwaResource)) {
      this.resourcesStore.setResourceFetchError({
        iri: event.resource,
        error: createCwaResourceError(new Error('Not Saved. The response was not a valid CWA Resource')),
        isCurrent: false
      })
      return
    }

    const linkHeader = event.fetchResponse.headers.get('link')
    if (linkHeader) {
      this.mercure.setMercureHubFromLinkHeader(linkHeader)
      this.apiDocumentation.setDocsPathFromLinkHeader(linkHeader)
    }
    /**
     * END TODO: TEST
     */

    this.resourcesStore.saveResource({
      resource: cwaResource
    })

    this.resourcesStore.setResourceFetchStatus({ iri: event.resource, isComplete: true })
  }

  public async finishFetch (event: FinishFetchEvent) {
    this.fetcherStore.finishFetch(event)
    await this.waitForFetchChainToComplete(event.token)
  }

  private async waitForFetchChainToComplete (token: string) {
    let fetchChainCompletePromiseResolver: () => void
    const fetchChainCompletePromise = new Promise<void>((resolve) => {
      fetchChainCompletePromiseResolver = resolve
    })

    const computedFetchChainComplete = computed(() => this.fetcherStore.isFetchChainComplete(token))
    const callback = (isFetchChainComplete: boolean|undefined) => {
      if (isFetchChainComplete === true) {
        fetchChainCompletePromiseResolver()
      }
    }
    const stopWatch = watch(computedFetchChainComplete, callback, {
      immediate: true
    })
    await fetchChainCompletePromise
    stopWatch()
  }

  public finishManifestFetch (event: ManifestSuccessFetchEvent | ManifestErrorFetchEvent) {
    this.fetcherStore.finishManifestFetch(event)
  }

  public get primaryFetchPath (): string|undefined {
    return this.fetcherStoreDefinition.useStore().primaryFetchPath
  }

  private get fetcherStore () {
    return this.fetcherStoreDefinition.useStore()
  }

  private get resourcesStore () {
    return this.resourcesStoreDefinition.useStore()
  }
}
