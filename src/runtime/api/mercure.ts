import consola from 'consola'
import { storeToRefs } from 'pinia'
import { watch } from 'vue'
import { CwaMercureStoreInterface, MercureStore } from '../storage/stores/mercure/mercure-store'
import { CwaResourcesStoreInterface, ResourcesStore } from '../storage/stores/resources/resources-store'
import { getPublishedResourceIri, CwaResource } from '../resources/resource-utils'

interface MercureMessageInterface {
  event: MessageEvent,
  data: CwaResource & { '@type'?: string }
}

export default class Mercure {
  private eventSource?: EventSource
  private lastEventId?: string
  private mercureStoreDefinition: MercureStore
  private resourcesStoreDefinition: ResourcesStore
  private mercureMessageQueue: MercureMessageInterface[] = []

  constructor (mercureStoreDefinition: MercureStore, resourcesStoreDefinition: ResourcesStore) {
    this.mercureStoreDefinition = mercureStoreDefinition
    this.resourcesStoreDefinition = resourcesStoreDefinition
  }

  public setMercureHubFromLinkHeader (linkHeader: string) {
    if (this.hub) {
      return
    }

    const matches = linkHeader.match(/<([^>]+)>;\s+rel="mercure".*/)
    if (!matches || !matches[1]) {
      consola.error('No Mercure rel in link header.')
      return
    }

    const { hub } = storeToRefs(this.mercureStore)
    hub.value = matches[1]
    consola.debug('Mercure hub set', this.hub)
  }

  public init (): void {
    if (process.server) {
      consola.debug('Mercure can only initialise on the client side')
      return
    }

    if (!this.hubUrl) {
      consola.warn('Cannot initialize Mercure. Hub URL is not set.')
      this.closeMercure()
      return
    }

    // Event is already setup and in a ready state
    if (this.eventSource && this.eventSource.readyState === 2 && this.eventSource.url === this.hubUrl) {
      consola.debug(`Mercure already initialized '${this.hubUrl}'`)
      return
    }

    // It may be setup but not in the correct state or with the correct URL
    this.closeMercure()

    consola.info(`Initializing Mercure '${this.hubUrl}'`)
    this.eventSource = new EventSource(this.hubUrl, { withCredentials: true })
    this.eventSource.onmessage = this.handleMercureMessage
  }

  public closeMercure () {
    if (this.eventSource) {
      this.eventSource.close()
      consola.info('Mercure Event Source Closed')
    } else {
      consola.warn('No Mercure Event Source exists to close')
    }
  }

  private handleMercureMessage (event: MessageEvent) {
    const mercureMessage: MercureMessageInterface = {
      event,
      data: JSON.parse(event.data)
    }

    if (!this.isMessageForCurrentResource(mercureMessage)) {
      return
    }

    this.addMercureMessageToQueue(mercureMessage)

    const { resourcesApiStateIsPending } = storeToRefs(this.resourcesStore)
    if (!resourcesApiStateIsPending.value) {
      this.processMessageQueue()
    } else {
      const unwatch = watch(resourcesApiStateIsPending, (isPending) => {
        if (!isPending) {
          this.processMessageQueue()
          unwatch()
        }
      })
    }
  }

  private isMessageForCurrentResource (mercureMessage: MercureMessageInterface): boolean {
    const currentResources = this.resourcesStore.current.currentIds
    const mercureMessageResource = mercureMessage.data
    if (!currentResources.includes(mercureMessageResource['@id'])) {
      const publishedIri = getPublishedResourceIri(mercureMessageResource)
      if (!publishedIri || !currentResources.includes(publishedIri)) {
        return false
      }
    }
    return true
  }

  private addMercureMessageToQueue (mercureMessage: MercureMessageInterface) {
    this.mercureMessageQueue = [
      ...this.mercureMessageQueue.filter((existingMessage: MercureMessageInterface) => {
        return existingMessage.data['@id'] !== mercureMessage.data['@id']
      }),
      mercureMessage
    ]
  }

  private processMessageQueue () {
    for (const message of this.mercureMessageQueue) {
      this.resourcesStore.saveResource({
        resource: message.data,
        isNew: true
      })
    }
  }

  private get hubUrl (): string|undefined {
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

  private get hub () {
    return this.mercureStore.hub
  }

  private get mercureStore (): CwaMercureStoreInterface {
    return this.mercureStoreDefinition.useStore()
  }

  private get resourcesStore (): CwaResourcesStoreInterface {
    return this.resourcesStoreDefinition.useStore()
  }
}
