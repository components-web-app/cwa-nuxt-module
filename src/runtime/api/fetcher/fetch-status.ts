import { CwaFetcherStoreInterface, FetcherStore } from '../../storage/stores/fetcher/fetcher-store'
import { fetcherInitTypes, FinishFetchEvent, StartFetchEvent } from '../../storage/stores/fetcher/actions'
import { CwaFetcherAsyncResponse } from './fetcher'

export default class FetchStatus {
  private fetcherStoreDefinition: FetcherStore
  private paths: { [key: string]: CwaFetcherAsyncResponse|undefined } = {}

  constructor (fetcherStore: FetcherStore) {
    this.fetcherStoreDefinition = fetcherStore
  }

  /**
   * Data getters
   */
  public get path (): string|undefined {
    return this.status.fetch.path || this.status.fetched.path
  }

  public getFetchingPathPromise (path: string): CwaFetcherAsyncResponse | null {
    return this.paths[path] || null
  }

  /**
   * Interface for updating/managing the fetch state
   */
  public startFetch (event: StartFetchEvent): CwaFetcherAsyncResponse|boolean {
    if (this.fetcherStore.inProgress) {
      const existingFetchPromise = this.getFetchingPathPromise(event.path)
      if (existingFetchPromise) {
        return existingFetchPromise
      }
    }

    return this.fetcherStore.initFetchStatus({ ...event, type: fetcherInitTypes.START })
  }

  public addEndpoint (endpoint: string, promise: CwaFetcherAsyncResponse) {
    if (!this.fetcherStore.inProgress) {
      return
    }
    this.paths[endpoint] = promise
  }

  public finishFetch (event: FinishFetchEvent) {
    const finishSuccess = this.fetcherStore.initFetchStatus({ ...event, type: fetcherInitTypes.FINISH })
    if (finishSuccess) {
      this.paths = {}
    }
    return finishSuccess
  }

  /**
   * Internal
   */
  private get status () {
    return this.fetcherStore.status
  }

  private get fetcherStore (): CwaFetcherStoreInterface {
    return this.fetcherStoreDefinition.useStore()
  }
}
