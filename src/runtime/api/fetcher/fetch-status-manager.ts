import { computed, ComputedRef, watch, WatchStopHandle } from 'vue'
import Bluebird, { TimeoutError } from 'bluebird'
import consola from 'consola'
import { storeToRefs } from 'pinia'
import Mercure from '../mercure'
import ApiDocumentation from '../api-documentation'
import { FetcherStore } from '../../storage/stores/fetcher/fetcher-store'
import {
  AddFetchResourceEvent,
  FinishFetchEvent, ManifestErrorFetchEvent,
  ManifestSuccessFetchEvent,
  StartFetchEvent, StartFetchResponse
} from '../../storage/stores/fetcher/actions'
import { ResourcesStore } from '../../storage/stores/resources/resources-store'
import { createCwaResourceError, CwaResourceError } from '../../errors/cwa-resource-error'
import { CwaResource, isCwaResource } from '../../resources/resource-utils'
import { CwaResourceApiStatuses } from '../../storage/stores/resources/state'
import { CwaFetchRequestHeaders, CwaFetchResponse } from './fetcher'

export interface FinishFetchResourceEvent {
  resource: string,
  success: boolean,
  token: string
}

export interface FinishFetchResourceSuccessEvent extends FinishFetchResourceEvent {
  success: true
  fetchResponse: CwaFetchResponse|any
  headers: CwaFetchRequestHeaders
  noSave?: boolean
}

export interface FinishFetchResourceErrorEvent extends FinishFetchResourceEvent {
  success: false
  error?: CwaResourceError
}

type _StartFetchEvent = Omit<StartFetchEvent, 'isCurrentSuccessResourcesResolved'>

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

  public async getFetchedCurrentResource (iri:string, timeout?: number): Promise<CwaResource|undefined> {
    const { current: { value: { byId: currentById } } } = storeToRefs(this.resourcesStore)
    const currentResource = currentById[iri]
    if (!currentResource) {
      return
    }

    timeout = timeout || 10000
    let stopWatch: WatchStopHandle
    const bluebirdPromise = new Bluebird<CwaResource|undefined>((resolve) => {
      stopWatch = watch(currentResource, (resolvedResource) => {
        if (resolvedResource?.apiState.status !== CwaResourceApiStatuses.IN_PROGRESS) {
          resolve(resolvedResource?.data)
        }
      }, {
        immediate: true
      })
    })
      .timeout(timeout, `Timed out ${timeout}ms waiting to fetch current resource '${iri}' in pending API state.`)
      .catch((error) => {
        if (error instanceof TimeoutError) {
          consola.warn(error.message)
        }
      })
      .finally(() => {
        stopWatch()
      })
    const resolvedResource = await bluebirdPromise
    return resolvedResource || currentResource.data
  }

  public startFetch (event: _StartFetchEvent): StartFetchResponse {
    const startFetchStatus = this.fetcherStore.startFetch({ ...event, isCurrentSuccessResourcesResolved: this.isCurrentSuccessResourcesResolved })
    if (event.isPrimary) {
      this.resourcesStore.resetCurrentResources(startFetchStatus.resources)
    }
    if (!startFetchStatus.continue) {
      this.mercure.init()
    }
    return startFetchStatus
  }

  public startFetchResource (event: AddFetchResourceEvent): boolean {
    const addedToFetcherResources = this.fetcherStore.addFetchResource(event)
    if (addedToFetcherResources) {
      this.resourcesStore.setResourceFetchStatus({ iri: event.resource, isComplete: false })
    }
    return addedToFetcherResources
  }

  public finishFetchResource (event: FinishFetchResourceSuccessEvent|FinishFetchResourceErrorEvent): CwaResource|undefined {
    // if resource is already in success state, leave it alone, we may have already been fetching, we can set it as an error if token old and new one will save it.
    // What if order of api responses is different? Then it'd be a success already and skipped for error.
    if (this.resourcesStore.current.byId?.[event.resource]?.apiState.status === CwaResourceApiStatuses.SUCCESS) {
      return
    }
    const isCurrent = this.fetcherStore.isCurrentFetchingToken(event.token)
    const fetchStatus = this.fetcherStore.fetches[event.token]

    // we do not want to wait for timeouts for duplicate fetch requests from resources. We can set an error. It will not be saved to current resources
    if (fetchStatus?.abort) {
      this.resourcesStore.setResourceFetchError({
        iri: event.resource,
        error: createCwaResourceError(new Error(`Not Saved. Fetching token '${event.token}' has been aborted.`)),
        isCurrent
      })
      return
    }

    // todo: test isPrimary and passing to setResourceFetchError
    const isPrimary = fetchStatus?.path === event.resource

    if (!event.success) {
      this.resourcesStore.setResourceFetchError({ iri: event.resource, error: event.error, isCurrent, isPrimary })
      return
    }

    if (!isCurrent) {
      this.resourcesStore.setResourceFetchError({
        iri: event.resource,
        error: createCwaResourceError(new Error(`Not Saved. Fetching token '${event.token}' is no longer current.`)),
        isCurrent
      })
      return
    }

    const cwaResource = event.fetchResponse._data

    if (!isCwaResource(cwaResource)) {
      this.resourcesStore.setResourceFetchError({
        iri: event.resource,
        error: createCwaResourceError(new Error('Not Saved. The response was not a valid CWA Resource.')),
        isCurrent,
        isPrimary
      })
      return
    }

    const linkHeader = event.fetchResponse.headers.get('link')
    if (linkHeader) {
      this.mercure.setMercureHubFromLinkHeader(linkHeader)
      this.apiDocumentation.setDocsPathFromLinkHeader(linkHeader)
    }

    if (!event.noSave) {
      this.resourcesStore.saveResource({
        resource: cwaResource
      })
    }

    this.resourcesStore.setResourceFetchStatus({ iri: event.resource, isComplete: true, headers: event.headers })

    return cwaResource
  }

  public async finishFetch (event: FinishFetchEvent): Promise<void> {
    await this.waitForFetchChainToComplete(event.token)
    this.fetcherStore.finishFetch(event)
  }

  private computedFetchChainComplete (token: string): ComputedRef<boolean> {
    return computed(() => {
      const resolvingResponse = this.fetcherStore.isFetchResolving(token)
      if (resolvingResponse.resolving) {
        return false
      }

      if (resolvingResponse.fetchStatus?.abort) {
        return true
      }

      const resources = resolvingResponse.fetchStatus?.resources
      if (!resources) {
        return false
      }

      return !this.resourcesStore.resourcesApiStateIsPending(resources)
    })
  }

  private async waitForFetchChainToComplete (token: string): Promise<void> {
    let fetchChainCompletePromiseResolver: () => void
    const fetchChainCompletePromise = new Promise<void>((resolve) => {
      fetchChainCompletePromiseResolver = resolve
    })

    const computedFetchChainComplete = this.computedFetchChainComplete(token)

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

  public finishManifestFetch (event: ManifestSuccessFetchEvent | ManifestErrorFetchEvent): void {
    this.fetcherStore.finishManifestFetch(event)
  }

  public isCurrentFetchingToken (token: string) {
    return this.fetcherStore.isCurrentFetchingToken(token)
  }

  public abortFetch (token: string) {
    return this.fetcherStore.abortFetch({ token })
  }

  public get primaryFetchPath (): string|undefined {
    return this.fetcherStore.primaryFetchPath
  }

  public get isCurrentSuccessResourcesResolved (): boolean {
    const successFetchStatus = this.fetcherStore.resolvedSuccessFetchStatus
    if (!successFetchStatus) {
      return false
    }
    return this.resourcesStore.isFetchStatusResourcesResolved(successFetchStatus)
  }

  private get fetcherStore () {
    return this.fetcherStoreDefinition.useStore()
  }

  private get resourcesStore () {
    return this.resourcesStoreDefinition.useStore()
  }
}
