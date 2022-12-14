import { ResourcesStore } from '../storage/stores/resources/resources-store'

export class ResourcesManager {
  private resourcesStoreDefinition: ResourcesStore

  constructor (resourcesStoreDefinition: ResourcesStore) {
    this.resourcesStoreDefinition = resourcesStoreDefinition
  }

  public get currentIds () {
    return this.resourcesStore.current.currentIds
  }

  public get currentResources () {
    return this.resourcesStore.current.currentIds.reduce((obj, id) => {
      obj[id] = this.resourcesStore.current.byId[id]
      return obj
    }, {})
  }

  private get resourcesStore () {
    return this.resourcesStoreDefinition.useStore()
  }
}
