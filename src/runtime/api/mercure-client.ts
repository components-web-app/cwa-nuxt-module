import { consola as logger } from 'consola'
import { storeToRefs } from 'pinia'
import { computed, watch } from 'vue'
import type { ComputedRef } from 'vue'
import type { NuxtApp } from 'nuxt/app'
import type { CwaMercureStoreInterface, MercureStore } from '../storage/stores/mercure/mercure-store'
import type { CwaResourcesStoreInterface, ResourcesStore } from '../storage/stores/resources/resources-store'
import type { CwaResource } from '../resources/resource-utils'
import { CwaResourceTypes, getPublishedResourceIri, getResourceTypeFromIri } from '../resources/resource-utils'
import type { CwaFetcherStoreInterface, FetcherStore } from '../storage/stores/fetcher/fetcher-store'
import type Fetcher from './fetcher/fetcher'
import type { RemoteChanges } from '#cwa/admin/remote-changes'
import type Cwa from '#cwa/cwa'
import { useProcess } from '#cwa/composables/process'

const REALTIME_EVENT_TYPE = 'CwaRealtimeEvent'

function serverTime(value: unknown) {
  return typeof value === 'string' ? Date.parse(value.replace(/(\.\d{3})\d+/, '$1')) : Number.NaN
}

interface MercureMessageInterface {
  event: MessageEvent
  data: CwaResource & { '@type'?: string }
}

export default class MercureClient {
  private eventSource?: EventSource
  private lastEventId?: string
  private onlineListenerAttached = false
  private mercureMessageQueue: MercureMessageInterface[] = []
  private fetcher?: Fetcher
  private requestCount?: ComputedRef<number>
  private readonly _mercureStore: CwaMercureStoreInterface
  private readonly _resourcesStore: CwaResourcesStoreInterface
  private readonly _fetcherStore: CwaFetcherStoreInterface
  private realtime?: RemoteChanges
  private realtimeWatch?: () => void

  constructor(
    mercureStoreDefinition: MercureStore,
    resourcesStoreDefinition: ResourcesStore,
    fetcherStoreDefinition: FetcherStore,
    private readonly nuxtApp?: NuxtApp,
  ) {
    this._mercureStore = mercureStoreDefinition.useStore()
    this._resourcesStore = resourcesStoreDefinition.useStore()
    this._fetcherStore = fetcherStoreDefinition.useStore()
  }

  public setFetcher(fetcher: Fetcher) {
    this.fetcher = fetcher
  }

  public setRequestCount(requestCount: ComputedRef<number>) {
    this.requestCount = requestCount
  }

  public init(forceRestart?: boolean): void {
    const { isServer } = useProcess()
    if (isServer) {
      logger.debug('Mercure can only initialise on the client side')
      return
    }

    if (!this.hubUrl) {
      logger.warn('Cannot initialize Mercure. Hub URL is not set.')
      this.closeMercure()
      return
    }

    this.realtimeWatch ??= watch(() => this.realtimeAllowed(), () => this.syncRealtime(), { immediate: true })

    // Event is already setup and in a ready state to the correct URL
    if (!forceRestart && this.eventSource && this.eventSource.readyState === 1 && this.eventSource.url === this.hubUrl) {
      logger.debug(`Mercure already initialized '${this.hubUrl}'`)
      return
    }

    // It may be setup but not in the correct state or with the correct URL
    this.closeMercure()

    logger.info(`Initializing Mercure '${this.hubUrl}'`)
    this.eventSource = new EventSource(this.hubUrl, { withCredentials: true })
    this.eventSource.onmessage = (event: MessageEvent) => this.handleMercureMessage(event)
    this.eventSource.onerror = () => this.handleConnectionLost()
    this.eventSource.onopen = () => this.handleConnectionOpen()
    this.listenForOnline()
  }

  private get cwa() {
    return this.nuxtApp?.$cwa as Cwa | undefined
  }

  private realtimeAllowed() {
    const $cwa = this.cwa
    return !!$cwa && $cwa['options'].realtime?.enabled !== false && $cwa.auth.isAdmin.value
  }

  private async syncRealtime() {
    const $cwa = this.cwa
    if (!$cwa || !this.realtimeAllowed()) {
      this.realtime?.disconnect()
      this.realtime = undefined
      return
    }
    const { RemoteChanges } = await import('#cwa/admin/remote-changes')
    if (!this.realtimeAllowed()) {
      return
    }
    this.realtime ??= new RemoteChanges($cwa, this.resourcesStore)
    this.realtime.connect()
  }

  private save(resource: CwaResource, path: string | undefined) {
    if (this.realtime) {
      this.realtime.receive(resource, path)
      return
    }
    this.resourcesStore.saveResource({
      resource,
      path,
      isNew: true,
    })
  }

  private isOlderThanStored(resource: CwaResource) {
    const stored = serverTime(this.resourcesStore.current.byId[resource['@id']]?.data?._metadata?.lastWrite?.at)
    return serverTime(resource._metadata?.lastWrite?.at) < stored
  }

  private listenForOnline() {
    if (this.onlineListenerAttached || typeof window === 'undefined') {
      return
    }
    this.onlineListenerAttached = true
    window.addEventListener('online', () => {
      if (this.mercureStore.connected === false) {
        this.revalidateCurrentResources()
      }
    })
  }

  private handleConnectionLost() {
    if (this.mercureStore.connected === false) {
      return
    }
    this.mercureStore.connected = false
    logger.warn('Mercure connection lost. Resources will be revalidated when it returns.')
  }

  private handleConnectionOpen() {
    const isReconnect = this.mercureStore.connected === false
    this.mercureStore.connected = true
    if (!isReconnect) {
      return
    }
    logger.info('Mercure reconnected. Revalidating current resources.')
    this.revalidateCurrentResources()
  }

  private revalidateCurrentResources() {
    const run = async () => {
      const currentIds = [...this.resourcesStore.current.currentIds]
      if (!currentIds.length || !this.fetcher) {
        return
      }
      const path = this._fetcherStore.primaryFetchPath
      const resources = await this.fetch(currentIds)
      for (const resource of resources) {
        this.save(resource, path)
      }
    }

    if (!this.requestsInProgress.value) {
      return run()
    }
    const unwatch = watch(this.requestsInProgress, (inProgress) => {
      if (!inProgress) {
        run()
        unwatch()
      }
    })
  }

  public closeMercure() {
    if (this.eventSource) {
      this.eventSource.close()
      logger.info('Mercure Event Source Closed')
    }
    else {
      logger.warn('No Mercure Event Source exists to close')
    }
  }

  private get requestsInProgress() {
    const { currentResourcesApiStateIsPending } = storeToRefs(this.resourcesStore)
    return computed(() => {
      return (this.requestCount && this.requestCount?.value > 0) || currentResourcesApiStateIsPending.value
    })
  }

  private handleMercureMessage(event: MessageEvent) {
    const mercureMessage: MercureMessageInterface = {
      event,
      data: JSON.parse(event.data),
    }

    if (mercureMessage.data?.['@type'] === REALTIME_EVENT_TYPE || (mercureMessage.data && this.realtime?.isOwnEcho(mercureMessage.data))) {
      return
    }

    if (!this.isMessageForCurrentResource(mercureMessage)) {
      return
    }

    this.addMercureMessageToQueue(mercureMessage)

    if (!this.requestsInProgress.value) {
      this.processMessageQueue()
    }
    else {
      const unwatch = watch(this.requestsInProgress, (inProgress) => {
        if (!inProgress) {
          this.processMessageQueue()
          unwatch()
        }
      })
    }
  }

  private isMessageForCurrentResource(mercureMessage: MercureMessageInterface): boolean {
    const currentResources = this.resourcesStore.current.currentIds
    const mercureMessageResource = mercureMessage.data
    if (!mercureMessageResource || !('@id' in mercureMessageResource)) {
      return false
    }
    if (!currentResources.includes(mercureMessageResource['@id'])) {
      const publishedIri = getPublishedResourceIri(mercureMessageResource)
      if (!publishedIri || !currentResources.includes(publishedIri)) {
        return false
      }
    }
    return true
  }

  private addMercureMessageToQueue(mercureMessage: MercureMessageInterface) {
    this.mercureMessageQueue = [
      ...this.mercureMessageQueue.filter((existingMessage: MercureMessageInterface) => {
        return existingMessage.data['@id'] !== mercureMessage.data['@id']
      }),
      mercureMessage,
    ]
  }

  private async processMessageQueue() {
    const messages = this.mercureMessageQueue
    this.mercureMessageQueue = []
    const path = this._fetcherStore.primaryFetchPath
    const resourceActions = this.collectResourceActions(messages)
    const fetchedResources = await this.fetch(resourceActions.toFetch)
    const fetchedComponents = await this.fetch(this.unheldPositionComponents(fetchedResources))
    const toSave = [...resourceActions.toSave, ...fetchedResources, ...fetchedComponents]
    for (const resource of toSave) {
      this.save(resource, path)
    }
  }

  private collectResourceActions(messages: MercureMessageInterface[]) {
    const toSave = []
    const toFetch: string[] = []
    for (const message of messages) {
      this.lastEventId = message.event.lastEventId

      // re-check to make sure message is still current
      if (!this.isMessageForCurrentResource(message) || this.isOlderThanStored(message.data)) {
        continue
      }

      const isDelete = Object.keys(message.data).length === 1 && message.data['@id']
      if (!isDelete && message.data['@type'] === 'ComponentPosition') {
        toFetch.push(message.data['@id'])
        continue
      }

      if (!isDelete && getResourceTypeFromIri(message.data['@id']) === CwaResourceTypes.PAGE_DATA) {
        toFetch.push(...this.positionsBoundToChangedPageData(message.data))
      }

      toSave.push(message.data)
    }
    return {
      toSave,
      toFetch: [...new Set(toFetch)],
    }
  }

  private unheldPositionComponents(resources: CwaResource[]) {
    const components = resources
      .filter(resource => getResourceTypeFromIri(resource['@id']) === CwaResourceTypes.COMPONENT_POSITION)
      .map(position => position.component)
      .filter((iri): iri is string => typeof iri === 'string' && !this.resourcesStore.current.byId[iri]?.data)
    return [...new Set(components)]
  }

  private positionsBoundToChangedPageData(pageData: CwaResource) {
    const stored = this.resourcesStore.current.byId[pageData['@id']]?.data
    const changed = (property: string) => property in pageData && pageData[property] !== stored?.[property]
    const isComponentIri = (value: unknown) => typeof value === 'string' && getResourceTypeFromIri(value) === CwaResourceTypes.COMPONENT
    const anyComponentChanged = Object.keys(pageData).some(property => changed(property) && (isComponentIri(pageData[property]) || isComponentIri(stored?.[property])))
    return this.resourcesStore.current.currentIds.filter((iri) => {
      const position = this.resourcesStore.current.byId[iri]?.data
      if (position?.pageDataProperty) {
        return changed(position.pageDataProperty)
      }
      return !!position?._metadata?.isDynamicPosition && anyComponentChanged
    })
  }

  private async fetch(paths: string[]) {
    const resources: CwaResource[] = []
    // this is all so that we can set all the new resources in 1 batch and do not have a chance of the user getting further new resources for the same batch of new resources
    if (paths.length) {
      if (!this.fetcher) {
        throw new Error('Mercure cannot fetch resources. Fetcher is not set.')
      }

      // create all promises
      const fetchPromises = []
      for (const path of paths) {
        const fetchPromise = this.fetcher.fetchResource({
          path,
          noSave: true,
          shallowFetch: true,
        })
        fetchPromises.push(fetchPromise)
      }

      // wait for all promises
      await Promise.all(fetchPromises).then((responses) => {
        for (const resource of responses) {
          if (!resource) {
            continue
          }
          resources.push(resource)
        }
      })
    }

    return resources
  }

  private get hubUrl(): string | undefined {
    if (!this.hub) {
      return
    }
    const hub = new URL(this.hub)
    hub.searchParams.append('match', '*')
    if (this.lastEventId) {
      hub.searchParams.append('last_event_id', this.lastEventId)
    }
    return hub.toString()
  }

  private get hub() {
    return this.mercureStore.hub
  }

  private get mercureStore(): CwaMercureStoreInterface {
    return this._mercureStore
  }

  private get resourcesStore(): CwaResourcesStoreInterface {
    return this._resourcesStore
  }
}
