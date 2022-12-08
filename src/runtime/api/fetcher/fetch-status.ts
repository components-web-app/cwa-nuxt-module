import { CwaFetcherStoreInterface, FetcherStore } from '../../storage/stores/fetcher/fetcher-store'
import { FinishFetchEvent } from '../../storage/stores/fetcher/actions'
import { CwaFetcherAsyncResponse } from './fetcher'

export default class FetchStatus {
  private fetcherStoreDefinition: FetcherStore

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
    return this.status.fetch.paths[path] || null
  }

  /**
   * Interface for updating/managing the fetch state
   */
  public startFetch (path: string): CwaFetcherAsyncResponse|boolean {
    if (this.fetcherStore.inProgress) {
      const existingFetchPromise = this.getFetchingPathPromise(path)
      if (existingFetchPromise) {
        return existingFetchPromise
      }
    }

    return this.fetcherStore.initFetchStatus({ path })
  }

  public addEndpoint (endpoint: string, promise: CwaFetcherAsyncResponse) {
    this.fetcherStore.addPath(endpoint, promise)
  }

  public finishFetch ({ path, pageIri, fetchSuccess }: FinishFetchEvent & { fetchSuccess: boolean }) {
    return this.fetcherStore.initFetchStatus({
      path,
      pageIri,
      fetchSuccess
    })
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
