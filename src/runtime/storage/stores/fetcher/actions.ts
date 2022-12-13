import { v4 as uuidv4 } from 'uuid'
import { reactive } from 'vue'
import { ResourcesStore } from '../resources/resources-store'
import { CwaFetcherStateInterface, TopLevelFetchPathInterface } from './state'
import { CwaFetcherGettersInterface } from './getters'

export interface StartFetchEvent {
  token?: string
  path: string,
  manifestPath?: string
  isPrimary?: boolean
}

export interface FinishFetchEvent {
  token: string
}

export interface AddFetchResourceEvent {
  token: string,
  resource: string
}

export interface CwaFetcherActionsInterface {
  startFetch(event: StartFetchEvent): string|undefined
  finishFetch (event: FinishFetchEvent): void
  addFetchResource (event: AddFetchResourceEvent): boolean
}

export default function (fetcherState: CwaFetcherStateInterface, fetcherGetters: CwaFetcherGettersInterface): CwaFetcherActionsInterface {
  return {
    startFetch (event: StartFetchEvent): string|undefined {
      if (event.token) {
        if (!fetcherState.fetches[event.token]) {
          throw new Error(`Cannot start the fetch: The token '${event.token}' does not exist`)
        }
        return event.token
      }

      // if path was requested before, it the chain status is complete, and now we are client-side, and it was server-side we should abort.
      // Basically, if the middleware has already been called to start this primary fetch server-side and now we are client-side, let's not repeat
      if (fetcherState.primaryFetch.successToken) {
        const lastSuccessState = fetcherState.fetches[fetcherState.primaryFetch.successToken]
        if (lastSuccessState.path === event.path && lastSuccessState.isServerFetch && process.client && fetcherGetters.isFetchChainComplete.value(fetcherState.primaryFetch.successToken) === true) {
          lastSuccessState.isServerFetch = false
          return
        }
      }

      const token = uuidv4()
      const initialState: TopLevelFetchPathInterface = reactive({
        path: event.path,
        resources: [],
        isPrimary: !!event.isPrimary,
        isServerFetch: !process.client
      })
      if (event.manifestPath) {
        initialState.manifest = {
          path: event.manifestPath
        }
      }

      if (event.isPrimary) {
        fetcherState.primaryFetch.fetchingToken = token
      }

      fetcherState.fetches[token] = initialState
      return token
    },
    finishFetch (event: FinishFetchEvent) {
      const fetchStatus = fetcherState.fetches[event.token]
      if (!fetchStatus) {
        throw new Error(`Cannot finish the fetch: The token '${event.token}' does not exist`)
      }
      if (fetchStatus.isPrimary) {
        fetcherState.primaryFetch.successToken = event.token
        if (fetcherState.primaryFetch.fetchingToken === event.token) {
          fetcherState.primaryFetch.fetchingToken = undefined
        }
      }
    },
    addFetchResource (event: AddFetchResourceEvent) {
      const fetchStatus = fetcherState.fetches[event.token]
      if (!fetchStatus) {
        throw new Error(`Cannot finish the fetch: The token '${event.token}' does not exist`)
      }
      if (fetchStatus.resources.includes(event.resource) || !fetcherGetters.isFetchStatusCurrent.value(event.token)) {
        return false
      }
      fetchStatus.resources.push(event.resource)
      return true
    }
  }
}
