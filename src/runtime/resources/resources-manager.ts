import { ResourcesStore } from '../storage/stores/resources/resources-store'
import { CwaCurrentResourceInterface } from '@cwa/nuxt-module/runtime/storage/stores/resources/state'

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

  // todo: move to resources getters and make this a proxy
  public get resourceLoadStatus () {
    const pending = this.resourcesStore.totalResourcesPending
    const total = this.resourcesStore.current.currentIds.length
    const complete = total - pending
    let percent
    if (complete === 0) {
      percent = total === 0 ? 100 : 0
    } else {
      percent = Math.round((complete / total) * 100)
    }
    return {
      pending,
      complete,
      total,
      percent
    }
  }

  private get resourcesStore () {
    return this.resourcesStoreDefinition.useStore()
  }
}
