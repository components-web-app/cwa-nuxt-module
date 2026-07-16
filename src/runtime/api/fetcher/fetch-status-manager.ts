import { computed, watch, watchEffect } from 'vue'
import type { ComputedRef, WatchStopHandle } from 'vue'
import { consola as logger } from 'consola'
import { storeToRefs } from 'pinia'
import type Mercure from '../mercure'
import type ApiDocumentation from '../api-documentation'
import type { CwaFetcherStoreInterface, FetcherStore } from '../../storage/stores/fetcher/fetcher-store'
import type {
  AddFetchResourceEvent,
  FinishFetchEvent, ManifestErrorFetchEvent,
  ManifestSuccessFetchEvent,
  SetManifestIrisByDepthEvent,
  StartFetchEvent, StartFetchResponse,
} from '../../storage/stores/fetcher/actions'
import { FinishFetchManifestType } from '../../storage/stores/fetcher/actions'
import type { CwaResourcesStoreInterface, ResourcesStore } from '../../storage/stores/resources/resources-store'
import type { CwaResourceError } from '../../errors/cwa-resource-error'
import { createCwaResourceError } from '../../errors/cwa-resource-error'
import { CwaResourceTypes, getResourceTypeFromIri, isCwaResource } from '../../resources/resource-utils'
import type { CwaResource } from '../../resources/resource-utils'
import { CwaResourceApiStatuses } from '../../storage/stores/resources/state'
import type { CwaFetchRequestHeaders, CwaFetchResponse } from './fetcher'
import type { FetchAbortReason, FetchStatus, RouteCacheEntry } from '#cwa/storage/stores/fetcher/state'
import { clearError, useError } from '#imports'

export interface FinishFetchResourceEvent {
  resource: string
  userProvidedIri?: string
  success: boolean
  token: string
  path: string
}

export interface FinishFetchResourceSuccessEvent extends FinishFetchResourceEvent {
  success: true
  fetchResponse: CwaFetchResponse | any
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
  private readonly mercure: Mercure
  private readonly apiDocumentation: ApiDocumentation
  private readonly _fetcherStore: CwaFetcherStoreInterface
  private readonly _resourcesStore: CwaResourcesStoreInterface

  // Max routes retained in the instant-revisit cache (#257). Overridable via the `cwa` nuxt config.
  private readonly routeCacheLimit: number

  constructor(
    fetcherStoreDefinition: FetcherStore,
    mercure: Mercure,
    apiDocumentation: ApiDocumentation,
    resourcesStoreDefinition: ResourcesStore,
    routeCacheLimit = 50,
  ) {
    this.mercure = mercure
    this.apiDocumentation = apiDocumentation
    this._fetcherStore = fetcherStoreDefinition.useStore()
    this._resourcesStore = resourcesStoreDefinition.useStore()
    // 0 (or negative) disables eviction — unbounded cache
    this.routeCacheLimit = routeCacheLimit
  }

  public async getFetchedCurrentResource(iri: string, timeout?: number): Promise<CwaResource | undefined> {
    const { current: { value: { byId: currentById } } } = storeToRefs(this.resourcesStore)
    const currentResource = currentById[iri]
    if (!currentResource) {
      return
    }

    timeout = timeout || 10000
    let stopWatch: WatchStopHandle
    const getResolvedResource = new Promise<CwaResource | undefined>((resolve) => {
      const tooLongTimeout = setTimeout(() => {
        logger.warn(`Timed out ${timeout}ms waiting to fetch current resource '${iri}' in pending API state.`)
        resolve(undefined)
      }, timeout)

      stopWatch = watchEffect(() => {
        if (currentResource.apiState.status !== CwaResourceApiStatuses.IN_PROGRESS) {
          clearTimeout(tooLongTimeout)
          resolve(currentResource.data)
        }
      })
    })
    const resolvedResource = await getResolvedResource
    // @ts-expect-error
    stopWatch()
    return resolvedResource || currentResource.data
  }

  public startFetch(event: _StartFetchEvent): StartFetchResponse {
    // capture the page currently being loaded before it is superseded by this new primary fetch
    const outgoingFetchingToken = event.isPrimary ? this.fetcherStore.primaryFetch.fetchingToken : undefined
    if (event.isPrimary) {
      this.fetcherStore.resetIriDepths()
    }
    const startFetchStatus = this.fetcherStore.startFetch({ ...event, isCurrentSuccessResourcesResolved: this.isCurrentSuccessResourcesResolved })
    if (event.isPrimary) {
      // If the fetch we just superseded had already rendered its page, keep it on screen while this
      // new one loads (rather than reverting to the last fully-resolved success). See #256.
      if (
        startFetchStatus.continue
        && outgoingFetchingToken
        && outgoingFetchingToken !== startFetchStatus.token
        && this.fetchHasDisplayablePage(outgoingFetchingToken)
      ) {
        this.fetcherStore.setDisplayedToken(outgoingFetchingToken)
      }

      // #257 instant revisit: if we already hold this route's structure AND all its resources are
      // still in the store, prime the new fetch from cache so it renders IMMEDIATELY (existing
      // early-switch fires on the first render). The fetch still runs (continue:true) to revalidate
      // and patch any changed data in place — non-blanking thanks to #256.
      const cached = startFetchStatus.continue ? this.getCachedRoute(event.path) : undefined
      if (cached && this.fetcherStore.fetches[startFetchStatus.token]?.manifest) {
        this.setManifestIrisByDepth({ token: startFetchStatus.token, resourceIris: cached.resourceTree })
        this.fetcherStore.finishManifestFetch({ token: startFetchStatus.token, type: FinishFetchManifestType.SUCCESS })
        this.resourcesStore.resetCurrentResources(cached.resourceIris)
        // this cached page is what's on screen NOW — mark it displayed so background revalidation
        // (which flips its resources to IN_PROGRESS) doesn't fall the hold back to the previous page.
        this.fetcherStore.setDisplayedToken(startFetchStatus.token)
      }
      else {
        this.resourcesStore.resetCurrentResources(startFetchStatus.resources)
      }
    }
    return startFetchStatus
  }

  // A route revisit is instantly renderable when we retained its manifest structure AND every
  // resource it needs is still in the store. Touches recency for the LRU. See #257.
  private getCachedRoute(path: string): RouteCacheEntry | undefined {
    const cached = this.fetcherStore.routeCache.get(path)
    if (!cached) {
      return undefined
    }
    const allResourcesPresent = cached.resourceIris.every(iri => !!this.resourcesStore.current.byId?.[iri]?.data)
    if (!allResourcesPresent) {
      return undefined
    }
    cached.lastAccessed = (new Date()).getTime()
    return cached
  }

  // Whether a fetch was fully rendered — EVERY depth's page resource has data in the store. A
  // partially-loaded nested view (e.g. the shared parent at depth 0 loaded but the child at depth 1
  // still loading) must NOT be held as the displayed page, or clicking away leaves the user stuck on
  // a parent + spinning child instead of falling back to the last fully-loaded page. See #256.
  private fetchHasDisplayablePage(token: string): boolean {
    const irisByDepth = this.fetcherStore.fetches[token]?.manifest?.irisByDepth
    if (!irisByDepth?.length) {
      return false
    }
    return irisByDepth.every((depthGroup) => {
      const pageIri = depthGroup.find(iri => getResourceTypeFromIri(iri) === CwaResourceTypes.PAGE)
      return !!(pageIri && this.resourcesStore.current.byId?.[pageIri]?.data)
    })
  }

  public startFetchResource(event: AddFetchResourceEvent): boolean {
    const addedToFetcherResources = this.fetcherStore.addFetchResource(event)
    if (addedToFetcherResources) {
      this.resourcesStore.setResourceFetchStatus({ iri: event.resource, isComplete: false, path: event.path, headers: event.headers })
    }
    return addedToFetcherResources
  }

  public finishFetchResource(event: FinishFetchResourceSuccessEvent | FinishFetchResourceErrorEvent): CwaResource | undefined {
    // if resource is already in success state, leave it alone, we may have already been fetching, we can set it as an error if token old and new one will save it.
    // What if order of api responses is different? Then it'd be a success already and skipped for error.

    // when we are fetching 1 resource but with a different endpoint, the apiState will not have been updated from the SUCCESS status during the fetch
    // e.g. on routes tab, we re-fetch the route with `/redirects` postfix to the URL to get more data into the resource
    if (
      this.resourcesStore.current.byId?.[event.resource]?.apiState.status === CwaResourceApiStatuses.SUCCESS
      && this.resourcesStore.current.byId?.[event.resource]?.apiState.path === event.path
    ) {
      return this.resourcesStore.current.byId?.[event.resource]?.data
    }

    const isCurrent = this.fetcherStore.isCurrentFetchingToken(event.token)
    const fetchStatus = this.fetcherStore.fetches[event.token]

    // Aborted or stale-token fetches: do not update the resource state.
    // The resource already has either a previous SUCCESS state (valid cached data) or an
    // IN_PROGRESS state (the current fetch token will resolve it). Overwriting with ERROR
    // here has no HTTP status code and causes spurious "Unknown error" flashes in ResourceLoader.
    if (fetchStatus?.abort || !isCurrent) {
      return
    }

    const showErrorPage = this.finishFetchShowError(fetchStatus, event.resource)

    const setFinalResourceFetchError = (error: CwaResourceError | undefined) => {
      this.resourcesStore.setResourceFetchError({
        iri: event.resource,
        error,
        isCurrent,
        showErrorPage,
      })
    }

    if (!event.success) {
      setFinalResourceFetchError(event.error)
      return
    }

    const cwaResource = event.fetchResponse._data

    if (!isCwaResource(cwaResource)) {
      const error = createCwaResourceError(new Error(`Not Saved. The response was not a valid CWA Resource. (${event.resource})`))
      setFinalResourceFetchError(error)
      logger.error('[CWA FETCH ERROR: Not a valid CWA resource]', event.resource, cwaResource)
      return
    }

    if (this.finishFetchShowError(fetchStatus, event.resource)) {
      const currentError = useError()
      if (currentError.value?.error) clearError()
    }

    const linkHeader = event.fetchResponse.headers.get('link')
    if (linkHeader) {
      this.mercure.setMercureHubFromLinkHeader(linkHeader)
      this.apiDocumentation.setDocsPathFromLinkHeader(linkHeader)
    }

    if (!event.noSave) {
      // we may be fetching a resource but with a postfix. E.g. routes//contact/redirects - this can extend the response
      // however the iri returned should really still be the one that we wanted it to be
      // In other circumstances, we want the different IRI that is returned to be saved as such
      // for example, fetching a live resource, but a draft is available.
      if (event.userProvidedIri) {
        cwaResource['@id'] = event.userProvidedIri
      }
      logger.debug(`Save resource with ID '${cwaResource['@id']}'`, cwaResource)
      this.resourcesStore.saveResource({
        resource: cwaResource,
      })
    }

    this.resourcesStore.setResourceFetchStatus({
      responseIri: cwaResource['@id'],
      iri: event.resource,
      isComplete: true,
      headers: event.headers,
      path: event.path,
    })

    return cwaResource
  }

  public async finishFetch(event: FinishFetchEvent): Promise<void> {
    await this.waitForFetchChainToComplete(event.token)
    this.fetcherStore.finishFetch(event)
    // the route was just cached by finishFetch — keep the cache within its route-count limit
    this.enforceRouteCacheLimit()
  }

  // Route-count LRU for the instant-revisit cache (#257). When over the limit, evict the
  // least-recently-accessed routes and drop the `byId` resources they exclusively owned —
  // reference-counted so shared layouts/groups/parents survive, and never evicting the route(s)
  // backing the current fetch tokens or any resource on the current page / in an in-flight fetch.
  private enforceRouteCacheLimit(): void {
    const routeCache = this.fetcherStore.routeCache
    // limit <= 0 disables eviction (unbounded)
    if (this.routeCacheLimit <= 0 || routeCache.size <= this.routeCacheLimit) {
      return
    }
    const protectedPaths = this.activeRoutePaths()
    const evictionQueue = [...routeCache.entries()]
      .filter(([path]) => !protectedPaths.has(path))
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)

    while (routeCache.size > this.routeCacheLimit && evictionQueue.length) {
      const next = evictionQueue.shift()
      if (!next) {
        break
      }
      const [path, entry] = next
      routeCache.delete(path)
      const droppable = entry.resourceIris.filter(iri => !this.isResourceReferencedByCache(iri) && !this.isResourceProtectedFromEviction(iri))
      this.resourcesStore.evictResources(droppable)
    }
  }

  // Route paths backing the fetching / success / displayed tokens — must never be evicted.
  private activeRoutePaths(): Set<string> {
    const paths = new Set<string>()
    const { fetchingToken, successToken, displayedToken } = this.fetcherStore.primaryFetch
    for (const token of [fetchingToken, successToken, displayedToken]) {
      const path = token ? this.fetcherStore.fetches[token]?.path : undefined
      if (path) {
        paths.add(path)
      }
    }
    return paths
  }

  private isResourceReferencedByCache(iri: string): boolean {
    for (const entry of this.fetcherStore.routeCache.values()) {
      if (entry.resourceIris.includes(iri)) {
        return true
      }
    }
    return false
  }

  // A resource on the current page or being loaded by any live fetch must not be evicted.
  private isResourceProtectedFromEviction(iri: string): boolean {
    if (this.resourcesStore.current.currentIds.includes(iri)) {
      return true
    }
    for (const fetchStatus of Object.values(this.fetcherStore.fetches)) {
      if (fetchStatus.resources.includes(iri)) {
        return true
      }
    }
    return false
  }

  private finishFetchShowError(fetchStatus: FetchStatus | undefined, eventResource: string) {
    return !!fetchStatus?.isPrimary && fetchStatus?.path === eventResource
  }

  private computedFetchChainComplete(token: string): ComputedRef<boolean> {
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

  private async waitForFetchChainToComplete(token: string): Promise<void> {
    let fetchChainCompletePromiseResolver: () => void
    const fetchChainCompletePromise = new Promise<void>((resolve) => {
      fetchChainCompletePromiseResolver = resolve
    })

    const computedFetchChainComplete = this.computedFetchChainComplete(token)

    const callback = (isFetchChainComplete: boolean | undefined) => {
      if (isFetchChainComplete === true) {
        fetchChainCompletePromiseResolver()
      }
    }
    const stopWatch = watch(computedFetchChainComplete, callback, {
      immediate: true,
    })
    await fetchChainCompletePromise
    stopWatch()
  }

  public setManifestIrisByDepth(event: SetManifestIrisByDepthEvent): void {
    // the store derives the depth lookups from the manifest as it stores it
    this.fetcherStore.setManifestIrisByDepth(event)
  }

  public getDepthForIri(iri: string): number | undefined {
    return this.fetcherStore.iriDepths[iri]
  }

  public getPathForDepth(depth: number): string | undefined {
    return this.fetcherStore.depthPaths[depth]
  }

  public registerIriDepth(iri: string, depth: number): void {
    this.fetcherStore.registerIriDepth({ iri, depth })
  }

  public finishManifestFetch(event: ManifestSuccessFetchEvent | ManifestErrorFetchEvent): void {
    this.fetcherStore.finishManifestFetch(event)
  }

  public isCurrentFetchingToken(token: string) {
    return this.fetcherStore.isCurrentFetchingToken(token)
  }

  public abortFetch(token: string, reason?: FetchAbortReason) {
    return this.fetcherStore.abortFetch({ token, reason })
  }

  // todo: test
  public clearPrimaryFetch() {
    // Reset the whole primary-fetch state. Previously only successToken was cleared, leaving a stale
    // fetchingToken/displayedToken pointing at an abandoned fetch (e.g. navigating to a cwa-disabled
    // page while a CWA fetch was in flight), which could keep the CWA view stuck. See #256.
    this.fetcherStore.primaryFetch.successToken = undefined
    this.fetcherStore.primaryFetch.fetchingToken = undefined
    this.fetcherStore.primaryFetch.displayedToken = undefined
  }

  public get primaryFetchPath(): string | undefined {
    return this.fetcherStore.primaryFetchPath
  }

  public get isCurrentSuccessResourcesResolved(): boolean {
    const successFetchStatus = this.fetcherStore.resolvedSuccessFetchStatus
    if (!successFetchStatus) {
      return false
    }
    return this.resourcesStore.isFetchStatusResourcesResolved(successFetchStatus)
  }

  private get fetcherStore(): CwaFetcherStoreInterface {
    return this._fetcherStore
  }

  private get resourcesStore(): CwaResourcesStoreInterface {
    return this._resourcesStore
  }
}
