import consola from 'consola'
import { storeToRefs } from 'pinia'
import { Ref, watch } from 'vue'
import { CwaMercureStoreInterface, MercureStore } from '../storage/stores/mercure/mercure-store'
import { ResourcesStore } from '../storage/stores/resources/resources-store'
import { getPublishedResourceIri, CwaResource } from '../resources/resource-utils'
import { FetcherStore } from '@cwa/nuxt-module/runtime/storage/stores/fetcher/fetcher-store'
import { computed, ref } from '#imports'

interface MercureMessageInterface {
  event: MessageEvent,
  data: CwaResource & { '@type'?: string }
}

export default class Mercure {
  private eventSource?: EventSource
  private lastEventId?: string
  private storeDefinition: MercureStore
  private resourcesStore: ResourcesStore
  private mercureMessageQueue: MercureMessageInterface[] = []
  private fetcherInProgress: Ref<boolean> = ref(false)
  private readonly resourcesApiStateIsPending: Ref<boolean>

  constructor (mercureStore: MercureStore, resourcesStore: ResourcesStore, fetcherStore: FetcherStore) {
    this.storeDefinition = mercureStore
    this.resourcesStore = resourcesStore

    this.mercureStore.$subscribe((mutation) => {
      if (mutation.type === 'patch object' && mutation.payload.hub) {
        this.init()
      }
    })

    const { resourcesApiStateIsPending } = storeToRefs(this.resourcesStore.useStore())
    this.resourcesApiStateIsPending = resourcesApiStateIsPending

    fetcherStore.useStore().$subscribe((_, state) => {
      this.fetcherInProgress.value = state.status.fetch.inProgress
    }, {
      immediate: true
    })
  }

  private get mercureMessageQueueActive () {
    return computed(() => {
      return !this.fetcherInProgress.value && !this.resourcesApiStateIsPending
    })
  }

  private get hub () {
    return this.mercureStore.$state.hub
  }

  private get mercureStore (): CwaMercureStoreInterface {
    return this.storeDefinition.useStore()
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

  public setMercureHubFromLinkHeader (linkHeader: string) {
    if (this.hub) {
      return
    }
    const matches = linkHeader.match(/<([^>]+)>;\s+rel="mercure".*/)
    if (!matches || !matches[1]) {
      consola.debug('No Mercure rel in link header.')
      return
    }

    this.mercureStore.$patch({
      hub: matches[1]
    })
    consola.debug('Mercure hub set', this.hub)
  }

  public init (): void {
    if (!process.client) {
      consola.debug('Mercure can only initialise on the client side')
      return
    }

    if (!this.hubUrl) {
      consola.warn('Cannot initialize Mercure. Hub URL is not set.')
      return
    }

    // Event is already setup and in a ready state
    if (this.eventSource && this.eventSource.readyState === 2 && this.eventSource.url === this.hubUrl) {
      consola.debug(`Mercure already initialized '${this.hubUrl}'`)
      return
    }

    // It may be setup but not in the correct state or with the correct URL
    if (this.eventSource) {
      this.closeMercure()
    }

    consola.log(`Initializing Mercure '${this.hubUrl}'`)
    this.eventSource = new EventSource(this.hubUrl, { withCredentials: true })
    this.eventSource.onmessage = async (messageEvent: MessageEvent) => {
      await this.handleMercureMessage(messageEvent)
    }
  }

  public closeMercure () {
    if (this.eventSource) {
      this.eventSource.close()
      consola.info('Mercure eventSource closed')
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

    if (this.mercureMessageQueueActive) {
      this.processMessageQueue()
    } else {
      const unwatch = watch(this.mercureMessageQueueActive, () => {
        this.processMessageQueue()
        unwatch()
      })
    }
  }

  private isMessageForCurrentResource (mercureMessage: MercureMessageInterface): boolean {
    const currentResources = this.resourcesStore.useStore().current.currentIds
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
    consola.log('PROCESS MERCURE MESSAGE QUEUE NOW', this.mercureMessageQueue)
  }
}
