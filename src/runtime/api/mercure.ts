import { consola as logger } from 'consola'
import { storeToRefs } from 'pinia'
import { computed, watch } from 'vue'
import type { ComputedRef } from 'vue'
import type { CwaMercureStoreInterface, MercureStore } from '../storage/stores/mercure/mercure-store'
import type { CwaResourcesStoreInterface, ResourcesStore } from '../storage/stores/resources/resources-store'
import type { CwaResource } from '../resources/resource-utils'
import { getPublishedResourceIri } from '../resources/resource-utils'
import type { CwaFetcherStoreInterface, FetcherStore } from '../storage/stores/fetcher/fetcher-store'
import type Fetcher from './fetcher/fetcher'
import { useProcess } from '#cwa/composables/process'

interface MercureMessageInterface {
  event: MessageEvent
  data: CwaResource & { '@type'?: string }
}

export default class Mercure {
  private eventSource?: EventSource
  private lastEventId?: string
  private onlineListenerAttached = false
  private mercureMessageQueue: MercureMessageInterface[] = []
  private fetcher?: Fetcher
  private requestCount?: ComputedRef<number>
  private readonly _mercureStore: CwaMercureStoreInterface
  private readonly _resourcesStore: CwaResourcesStoreInterface
  private readonly _fetcherStore: CwaFetcherStoreInterface

  constructor(
    mercureStoreDefinition: MercureStore,
    resourcesStoreDefinition: ResourcesStore,
    fetcherStoreDefinition: FetcherStore,
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

  public setMercureHubFromLinkHeader(linkHeader: string) {
    if (this.hub) {
      return
    }

    const matches = linkHeader.match(/<([^>]+)>;\s+rel="mercure".*/)
    if (!matches?.[1]) {
      logger.error('No Mercure rel in link header.')
      return
    }

    const { hub } = storeToRefs(this.mercureStore)
    hub.value = matches[1]
    logger.debug('Mercure hub set', this.hub)
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

  // The browser fires `online` on the network INTERFACE coming back, which is not proof the hub is
  // reachable - so it is only a hint, and we act on it exactly as we would a reconnect: revalidate.
  // Harmless if the hub is still down, because the refetch simply fails and nothing is staged.
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
    // `connected` is undefined until the first open: an initial connection has missed nothing, so
    // revalidating then would be a pointless refetch of everything we just loaded.
    const isReconnect = this.mercureStore.connected === false
    this.mercureStore.connected = true
    if (!isReconnect) {
      return
    }
    logger.info('Mercure reconnected. Revalidating current resources.')
    this.revalidateCurrentResources()
  }

  /**
   * Refetch everything currently on screen and stage it exactly as a Mercure message would.
   *
   * We do NOT trust the hub to replay what we missed: `Last-Event-ID` only backfills if the hub runs
   * an event store, and the default template deployment does not configure one - so anything that
   * happened while we were disconnected would otherwise be lost silently.
   *
   * Staging with `isNew: true` is what makes this safe to run unconditionally: the resources store
   * discards an unchanged resource (`isCwaResourceSame`), so an uneventful reconnect shows the user
   * nothing, and a genuine change surfaces the existing "content is outdated" notice instead of
   * rewriting the page underneath them.
   */
  private revalidateCurrentResources() {
    const run = async () => {
      const currentIds = [...this.resourcesStore.current.currentIds]
      if (!currentIds.length || !this.fetcher) {
        return
      }
      const path = this._fetcherStore.primaryFetchPath
      const resources = await this.fetch(currentIds)
      for (const resource of resources) {
        this.resourcesStore.saveResource({
          resource,
          path,
          isNew: true,
        })
      }
    }

    // Same deferral the message queue uses - revalidating mid-fetch would stage resources against a
    // set of current IDs that is already changing.
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
    const toSave = [...resourceActions.toSave, ...fetchedResources]
    for (const resource of toSave) {
      this.resourcesStore.saveResource({
        resource,
        path,
        isNew: true,
      })
    }
  }

  private collectResourceActions(messages: MercureMessageInterface[]) {
    const toSave = []
    const toFetch = []
    for (const message of messages) {
      this.lastEventId = message.event.lastEventId

      // re-check to make sure message is still current
      if (!this.isMessageForCurrentResource(message)) {
        continue
      }

      const isDelete = Object.keys(message.data).length === 1 && message.data['@id']
      if (!isDelete && message.data['@type'] === 'ComponentPosition') {
        toFetch.push(message.data['@id'])
        continue
      }

      toSave.push(message.data)
    }
    return {
      toSave,
      toFetch,
    }
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
    hub.searchParams.append('topic', '*')
    if (this.lastEventId) {
      hub.searchParams.append('Last-Event-ID', this.lastEventId)
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
