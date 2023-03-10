import { ResourcesStore } from '../storage/stores/resources/resources-store'
import { FetcherStore } from '../storage/stores/fetcher/fetcher-store'

export class ResourcesManager {
  private resourcesStoreDefinition: ResourcesStore
  private fetcherStoreDefinition: FetcherStore

  constructor (resourcesStoreDefinition: ResourcesStore, fetcherStoreDefinition: FetcherStore) {
    this.resourcesStoreDefinition = resourcesStoreDefinition
    this.fetcherStoreDefinition = fetcherStoreDefinition
  }

  private get fetcherStore () {
    return this.fetcherStoreDefinition.useStore()
  }

  private get resourcesStore () {
    return this.resourcesStoreDefinition.useStore()
  }
}
