import { ResourcesStore } from '../storage/stores/resources/resources-store'
import { CwaCurrentResourceInterface } from '../storage/stores/resources/state'

export class ResourcesManager {
  private resourcesStoreDefinition: ResourcesStore

  constructor (resourcesStoreDefinition: ResourcesStore) {
    this.resourcesStoreDefinition = resourcesStoreDefinition
  }

  public get currentIds () {
    return this.resourcesStore.current.currentIds
  }

  // todo: this may be temporary, but if proves useful, functionality to be moved to a resources store getter and this as a proxy
  public get currentResources () {
    return this.resourcesStore.current.currentIds.reduce((obj, id: string) => {
      obj[id] = this.resourcesStore.current.byId[id]
      return obj
    }, {} as {
      [key: string]: CwaCurrentResourceInterface
    })
  }

  public get resourceLoadStatus () {
    return this.resourcesStore.resourceLoadStatus
  }

  private get resourcesStore () {
    return this.resourcesStoreDefinition.useStore()
  }
}
