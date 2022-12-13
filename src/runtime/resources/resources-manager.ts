import { ResourcesStore } from '../storage/stores/resources/resources-store'

export class ResourcesManager {
  private resourcesStoreDefinition: ResourcesStore

  constructor (resourcesStoreDefinition: ResourcesStore) {
    this.resourcesStoreDefinition = resourcesStoreDefinition
  }

  public get currentIds () {
    return this.resourcesStore.current.currentIds
  }

  private get resourcesStore () {
    return this.resourcesStoreDefinition.useStore()
  }
}
