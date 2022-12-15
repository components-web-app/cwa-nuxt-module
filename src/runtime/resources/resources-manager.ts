import { ResourcesStore } from '../storage/stores/resources/resources-store'
import { CwaCurrentResourceInterface } from '@cwa/nuxt-module/runtime/storage/stores/resources/state'

export class ResourcesManager {
  private resourcesStoreDefinition: ResourcesStore

  constructor (resourcesStoreDefinition: ResourcesStore) {
    this.resourcesStoreDefinition = resourcesStoreDefinition
  }

  /**
   * TEMPORARY FUNCTIONS FOR DEVELOPMENT
   */
  public get currentIds () {
    return this.resourcesStore.current.currentIds
  }

  public get currentResources () {
    return this.resourcesStore.current.currentIds.reduce((obj, id: string) => {
      obj[id] = this.resourcesStore.current.byId[id]
      return obj
    }, {} as {
      [key: string]: CwaCurrentResourceInterface
    })
  }

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
  /**
   * END OF TEMPORARY FUNCTIONS FOR DEVELOPMENT
   */

  private get resourcesStore () {
    return this.resourcesStoreDefinition.useStore()
  }
}
