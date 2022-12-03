import { CwaFetcherInterface, FetcherStore } from '../../storage/stores/fetcher/fetcher-store'
import { CwaFetcherAsyncResponse } from './fetcher'
import { FinishFetchEvent } from '@cwa/nuxt-module/runtime/storage/stores/fetcher/actions'

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

  /**
   * A promise or true boolean should cancel the request being started
   */
  public startFetch (path: string): CwaFetcherAsyncResponse|boolean {
    if (this.status.fetch.inProgress) {
      const existingFetchPromise = this.status.fetch.paths?.[path]
      if (existingFetchPromise) {
        return existingFetchPromise
      }
    }
    if (this.status.fetched.path === path) {
      // we already did this request last, and it's finished and successful
      // prevents loading again from route middleware that'll run server and client side
      // this is also why we use a store for fetcher data to persist state between the two
      return false
    }

    return this.fetcherStore.initFetchStatus({ path })
  }

  public addEndpoint (endpoint: string, promise: CwaFetcherAsyncResponse) {
    this.fetcherStore.addPath(endpoint, promise)
  }

  public finishFetch ({ path, pageIri, success }: FinishFetchEvent & { success: boolean }) {
    this.fetcherStore.initFetchStatus({
      path,
      pageIri,
      success
    })
  }

  /**
   * Internal
   */
  private get status () {
    return this.fetcherStore.status
  }

  private get fetcherStore (): CwaFetcherInterface {
    return this.fetcherStoreDefinition.useStore()
  }
}
