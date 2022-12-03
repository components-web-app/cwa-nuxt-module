import consola from 'consola'
import { CwaMercureStoreWithStateInterface, MercureStore } from '../storage/stores/mercure/mercure-store'

export default class Mercure {
  private eventSource?: EventSource
  private lastEventId?: string
  private storeDefinition: MercureStore

  constructor (store: MercureStore) {
    this.storeDefinition = store
    this.store.$subscribe((mutation) => {
      if (mutation.type === 'patch object' && mutation.payload.hub) {
        this.init()
      }
    })
  }

  private get hub () {
    return this.store.$state.hub
  }

  private get store (): CwaMercureStoreWithStateInterface {
    return this.storeDefinition.useStore()
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

    this.store.$patch({
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
}
