import consola from 'consola'
import { storeToRefs } from 'pinia'
import { watch } from 'vue'
import { CwaMercureStoreInterface, MercureStore } from '../storage/stores/mercure/mercure-store'
import { CwaResourcesStoreInterface, ResourcesStore } from '../storage/stores/resources/resources-store'
import { getPublishedResourceIri, CwaResource, CwaResourceTypes } from '../resources/resource-utils'
import Fetcher from './fetcher/fetcher'

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
  private fetcher?: Fetcher

  constructor (mercureStoreDefinition: MercureStore, resourcesStoreDefinition: ResourcesStore) {
    this.mercureStoreDefinition = mercureStoreDefinition
    this.resourcesStoreDefinition = resourcesStoreDefinition
  }

  public setFetcher (fetcher: Fetcher) {
    this.fetcher = fetcher
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

  private async processMessageQueue () {
    const messages = this.mercureMessageQueue
    this.mercureMessageQueue = []
    const resourceActions = this.collectResourceActions(messages)
    const fetchedResources = await this.fetch(resourceActions.toFetch)
    const toSave = [...resourceActions.toSave, ...fetchedResources]
    for (const resource of toSave) {
      this.resourcesStore.saveResource({
        resource,
        isNew: true
      })
    }
  }

  private collectResourceActions (messages: MercureMessageInterface[]) {
    const toSave = []
    const toFetch = []
    for (const message of messages) {
      this.lastEventId = message.event.lastEventId

      // re-check to make sure message is still current
      if (!this.isMessageForCurrentResource(message)) {
        continue
      }

      const isDelete = Object.keys(message.data).length === 1 && message.data['@id']
      if (!isDelete && message.data['@type'] === CwaResourceTypes.COMPONENT_POSITION) {
        toFetch.push(message.data['@id'])
        continue
      }

      toSave.push(message.data)
    }
    return {
      toSave,
      toFetch
    }
  }

  private async fetch (paths: string[]) {
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
          shallowFetch: true
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
