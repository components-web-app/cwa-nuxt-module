import { v4 as uuidv4 } from 'uuid'
import { CwaFetcherStoreInterface, FetcherStore } from '../../storage/stores/fetcher/fetcher-store'
import { fetcherInitTypes } from '../../storage/stores/fetcher/actions'
import { CwaFetcherAsyncResponse } from './fetcher'

export interface StartFetchEvent {
  path: string
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

interface StartFetchResponse {
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
    const continueFetching = this.fetcherStore.initFetchStatus({ ...event, token: startFetchToken.token, type: fetcherInitTypes.START })
    return {
      startFetchToken,
      continueFetching
    }
  }

  private createStartFetchToken (event: CreateTokenEvent): StartFetchToken {
    const token = uuidv4()
    return {
      ...event,
      token
    }
  }

  public finishFetch (event: FinishFetchEvent) {
    const finishSuccess = this.fetcherStore.initFetchStatus({ ...event, type: fetcherInitTypes.FINISH })
    if (finishSuccess) {
      this.paths = {}
    }
    return finishSuccess
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
  private get status () {
    return this.fetcherStore.status
  }

  private get fetcherStore (): CwaFetcherStoreInterface {
    return this.fetcherStoreDefinition.useStore()
  }
}
