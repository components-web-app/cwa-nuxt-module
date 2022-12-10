import { v4 as uuidv4 } from 'uuid'
import { CwaFetcherStoreInterface, FetcherStore } from '../../storage/stores/fetcher/fetcher-store'
import { fetcherInitTypes, SetFetchManifestEvent } from '../../storage/stores/fetcher/actions'
import { CwaFetcherAsyncResponse } from './fetcher'
import { storeToRefs } from 'pinia'
import { watch } from 'vue'

declare function manifestFunction<T = any>(): Promise<T>;

export interface StartFetchEvent {
  path: string,
  resetCurrentResources?: boolean // should only be allowed if fetchSuccess is not defined
}

export interface FinishFetchEvent {
  token: string
  pageIri?: string
  fetchSuccess: boolean
}

interface CreateTokenEvent {
  existingFetchPromise?: CwaFetcherAsyncResponse
  startEvent: StartFetchEvent
}

interface StartFetchToken extends CreateTokenEvent {
  token: string
}

export interface StartFetchResponse {
  startFetchToken: StartFetchToken,
  continueFetching: boolean
}

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
    return this.status.fetch?.path || this.status.fetched?.path
  }

  public getFetchingPathPromise (path: string): CwaFetcherAsyncResponse | null {
    return this.paths[path] || null
  }

  /**
   * Interface for updating/managing the fetch state
   */
  public setFetchManifestStatus (event: SetFetchManifestEvent): boolean {
    return this.fetcherStore.setFetchManifestStatus(event)
  }

  public startFetch (event: StartFetchEvent): StartFetchResponse {
    if (this.fetcherStore.inProgress) {
      const existingFetchPromise = this.getFetchingPathPromise(event.path)
      if (existingFetchPromise) {
        return {
          startFetchToken: this.createStartFetchToken({ existingFetchPromise, startEvent: event }),
          continueFetching: false
        }
      }
    }

    const startFetchToken = this.createStartFetchToken({ startEvent: event })
    const continueFetching = this.fetcherStore.startFetchStatus({ ...event, token: startFetchToken.token })
    return {
      startFetchToken,
      continueFetching
    }
  }

  public async finishFetch (event: FinishFetchEvent): Promise<boolean> {
    const allFetchesFinished = await this.fetcherStore.finishFetchStatus(event)
    if (allFetchesFinished) {
      this.paths = {}
    }
    return await allFetchesFinished
  }

  public addPath (endpoint: string, promise: CwaFetcherAsyncResponse) {
    if (!this.fetcherStore.inProgress) {
      return
    }
    this.paths[endpoint] = promise
  }

  /**
   * Internal
   */
  private createStartFetchToken (event: CreateTokenEvent): StartFetchToken {
    const token = uuidv4()
    return {
      ...event,
      token
    }
  }

  private get status () {
    return this.fetcherStore.$state.status
  }

  private get manifests () {
    return this.fetcherStore.$state.manifests
  }

  private get fetcherStore (): CwaFetcherStoreInterface {
    return this.fetcherStoreDefinition.useStore()
  }
}
