import Mercure from '../mercure'
import ApiDocumentation from '../api-documentation'
import { FetcherStore } from '../../storage/stores/fetcher/fetcher-store'
import { AddFetchResourceEvent, FinishFetchEvent, StartFetchEvent } from '../../storage/stores/fetcher/actions'
import { ResourcesStore } from '@cwa/nuxt-module/runtime/storage/stores/resources/resources-store'

export interface FinishFetchResourceEvent {
  resource: string,
  status: 0|1,
  token: string
}

export default class FetchStatusManager {
  private fetcherStoreDefinition: FetcherStore
  private readonly mercure: Mercure
  private readonly apiDocumentation: ApiDocumentation
  private resourcesStoreDefinition: ResourcesStore

  constructor (
    fetcherStoreDefinition: FetcherStore,
    mercure: Mercure,
    apiDocumentation: ApiDocumentation,
    resourcesStoreDefinition: ResourcesStore
  ) {
    this.fetcherStoreDefinition = fetcherStoreDefinition
    this.mercure = mercure
    this.apiDocumentation = apiDocumentation
    this.resourcesStoreDefinition = resourcesStoreDefinition
  }

  public startFetch (event: StartFetchEvent) {
    const token = this.fetcherStore.startFetch(event)
    if (!token) {
      this.mercure.init()
    } else if (event.isPrimary) {
      this.resourcesStore.resetCurrentResources()
    }
    return token
  }

  public startFetchResource (event: AddFetchResourceEvent) {
    const addedToFetcherResources = this.fetcherStore.addFetchResource(event)
    if (addedToFetcherResources) {
      this.resourcesStore.setResourceFetchStatus({ iri: event.resource, status: 0 })
    }
    return addedToFetcherResources
  }

  public finishFetchResource (event: FinishFetchResourceEvent) {
    this.resourcesStore.setResourceFetchStatus({ iri: event.resource, status: event.status })
    if (this.fetcherStore.isFetchStatusCurrent(event.token)) {
      // save the resource here? Only save if the fetcher state is still current and valid
      // or should we save and just not add to current IDs? Probably not, we shouldn't really need that resource anymore..
      // but then if that's the case.. should we be clearing resources on page changes instead of just the current page resources?
    }
    // if a finish that is a success we should check for link headers here for initialising mercure and pi docs headers??
  }

  public finishFetch (event: FinishFetchEvent) {
    return this.fetcherStore.finishFetch(event)
  }

  private get fetcherStore () {
    return this.fetcherStoreDefinition.useStore()
  }

  private get resourcesStore () {
    return this.resourcesStoreDefinition.useStore()
  }
}
