import { CwaResourceApiStatuses, CwaResourcesStateInterface } from './state'

export class ResourcesGetterUtils {
  private readonly resourcesState: CwaResourcesStateInterface

  public constructor (resourcesState: CwaResourcesStateInterface) {
    this.resourcesState = resourcesState
  }

  public resourcesApiStateIsPending (resources: string[]): boolean {
    if (!this.resourcesState) {
      // todo: work out why on server-side this would not be defined and can be called before the constructor
      // eslint-disable-next-line no-console
      console.warn('resourcesState not defined')
      return false
    }
    for (const resource of resources) {
      const resourceData = this.resourcesState.current.byId[resource]
      if (!resourceData) {
        // resources should all be initialised with an api state even if no data
        throw new Error(`The resource '${resource}' does not exist.`)
      }

      if (resourceData.apiState.status === CwaResourceApiStatuses.IN_PROGRESS) {
        return true
      }
    }
    return false
  }

  public get totalResourcesPending (): number {
    return this.resourcesState.current.currentIds.reduce((count, id) => {
      if (this.resourcesState.current.byId[id].apiState.status === CwaResourceApiStatuses.IN_PROGRESS) {
        return ++count
      }
      return count
    }, 0)
  }
}
