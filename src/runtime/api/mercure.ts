import { consola as logger } from 'consola'
import { storeToRefs } from 'pinia'
import type { ComputedRef } from 'vue'
import type { NuxtApp } from 'nuxt/app'
import type { CwaMercureStoreInterface, MercureStore } from '../storage/stores/mercure/mercure-store'
import type { ResourcesStore } from '../storage/stores/resources/resources-store'
import type { FetcherStore } from '../storage/stores/fetcher/fetcher-store'
import { lazyImport } from '../lazy-import'
import type Fetcher from './fetcher/fetcher'
import { useProcess } from '#cwa/composables/process'

export default class Mercure {
  private fetcher?: Fetcher
  private requestCount?: ComputedRef<number>
  private readonly mercureStore: CwaMercureStoreInterface
  private readonly client = lazyImport(() => import('./mercure-client').then(({ default: MercureClient }) => {
    const client = new MercureClient(this.mercureStoreDefinition, this.resourcesStoreDefinition, this.fetcherStoreDefinition, this.nuxtApp)
    this.fetcher && client.setFetcher(this.fetcher)
    this.requestCount && client.setRequestCount(this.requestCount)
    return client
  }))

  constructor(
    private readonly mercureStoreDefinition: MercureStore,
    private readonly resourcesStoreDefinition: ResourcesStore,
    private readonly fetcherStoreDefinition: FetcherStore,
    private readonly nuxtApp: NuxtApp,
  ) {
    this.mercureStore = mercureStoreDefinition.useStore()
  }

  public setFetcher(fetcher: Fetcher) {
    this.fetcher = fetcher
    this.client.loaded?.setFetcher(fetcher)
  }

  public setRequestCount(requestCount: ComputedRef<number>) {
    this.requestCount = requestCount
    this.client.loaded?.setRequestCount(requestCount)
  }

  public setMercureHubFromLinkHeader(linkHeader: string) {
    if (this.mercureStore.hub) {
      return
    }

    const matches = linkHeader.match(/<([^>]+)>;\s+rel="mercure".*/)
    if (!matches?.[1]) {
      logger.debug('No Mercure rel in link header.')
      return
    }

    const { hub } = storeToRefs(this.mercureStore)
    hub.value = matches[1]
    logger.debug('Mercure hub set', this.mercureStore.hub)
  }

  public init(forceRestart?: boolean): void {
    const { isServer } = useProcess()
    if (isServer) {
      logger.debug('Mercure can only initialise on the client side')
      return
    }

    const start = () => {
      this.client.load()
        .then(client => client.init(forceRestart))
        .catch(error => logger.error('Could not load the Mercure client', error))
    }

    if (this.nuxtApp.isHydrating) {
      this.nuxtApp.hooks.hookOnce('app:suspense:resolve', start)
      return
    }
    start()
  }
}
