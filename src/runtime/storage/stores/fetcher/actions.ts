import { v4 as uuidv4 } from 'uuid'
import { reactive } from 'vue'
import { consola as logger } from 'consola'
import type { CwaResourceError } from '../../../errors/cwa-resource-error'
import type { CwaFetcherStateInterface, FetchStatus } from './state'
import type { CwaFetcherGettersInterface } from './getters'

export interface StartFetchEvent {
  token?: string
  path: string
  manifestPath?: string
  isPrimary?: boolean
  isCurrentSuccessResourcesResolved: boolean
}

export interface FinishFetchEvent {
  token: string
}

export interface AddFetchResourceEvent {
  token: string
  resource: string
  path: string
}

export interface StartFetchResponse {
  continue: boolean
  resources: string[]
  token: string
}

export enum FinishFetchManifestType {
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export interface ManifestSuccessFetchEvent {
  type: FinishFetchManifestType.SUCCESS
  token: string
  resources: string[]
}

export interface ManifestErrorFetchEvent {
  type: FinishFetchManifestType.ERROR
  token: string
  error: CwaResourceError
}

interface AbortFetchEvent {
  token: string
}

export interface CwaFetcherActionsInterface {
  abortFetch(event: AbortFetchEvent): void
  finishManifestFetch (event: ManifestSuccessFetchEvent | ManifestErrorFetchEvent): void
  startFetch(event: StartFetchEvent): StartFetchResponse
  finishFetch (event: FinishFetchEvent): void
  addFetchResource (event: AddFetchResourceEvent): boolean
  clearFetches (): void
}

export default function (fetcherState: CwaFetcherStateInterface, fetcherGetters: CwaFetcherGettersInterface): CwaFetcherActionsInterface {
  function getFetchStatusFromToken(token: string) {
    const fetchStatus = fetcherState.fetches[token]
    if (!fetchStatus) {
      throw new Error(`The fetch chain token '${token}' does not exist`)
    }
    return fetchStatus
  }

  return {
    abortFetch(event: AbortFetchEvent) {
      const fetchStatus = getFetchStatusFromToken(event.token)
      fetchStatus.abort = true
    },
    finishManifestFetch(event: ManifestSuccessFetchEvent | ManifestErrorFetchEvent) {
      let fetchStatus
      try {
        fetchStatus = getFetchStatusFromToken(event.token)
      }
      catch (error: any) {
        logger.trace(error.message)
        return
      }
      if (!fetchStatus.manifest) {
        throw new Error(`Cannot set manifest status for '${event.token}'. The manifest was never started.`)
      }
      if (event.type === FinishFetchManifestType.SUCCESS) {
        fetchStatus.manifest.resources = event.resources
      }
      if (event.type === FinishFetchManifestType.ERROR) {
        fetchStatus.manifest.error = event.error.asObject
      }
    },
    startFetch(event: StartFetchEvent): StartFetchResponse {
      const timestamp = (new Date()).getTime()

      if (event.token) {
        try {
          const existingFetchStatus = getFetchStatusFromToken(event.token)
          return {
            continue: !existingFetchStatus.abort,
            resources: existingFetchStatus.resources,
            token: event.token,
          }
        }
        catch (error) {
          // if the request has been aborted finished and cleared already, but then manifest was returned and tries to continue
          return {
            continue: false,
            resources: [],
            token: event.token,
          }
        }
      }

      // if we are doing a primary fetch and there is a success token already, let's check if that one is valid
      if (event.isPrimary && fetcherState.primaryFetch.successToken) {
        const lastSuccessState = fetcherState.fetches[fetcherState.primaryFetch.successToken]
        // check if this new path is the same as the last successful primary fetch and that the chain of fetch is complete
        // todo: when working on the redirect after finalising, we could check here if the fetched path is a route resource, and if the redirect path matches the new event path, then it is also the same fetch
        // todo: what if only some of the resource paths are different.. do we really need to fetch everything again or can we skip everything that has the correct headers and continue fetching the chain for anything that's changed...
        if (lastSuccessState?.path === event.path && event.isCurrentSuccessResourcesResolved) {
          // we may have been in progress with a new primary fetch, but we do not need that anymore
          fetcherState.primaryFetch.fetchingToken = undefined

          for (const existingToken of Object.keys(fetcherState.fetches)) {
            if (existingToken !== fetcherState.primaryFetch.successToken) {
              const secondsDifference = (timestamp - fetcherState.fetches[existingToken].timestamp) / 1000
              // abort old requests or previous primary fetches
              const abortRequest = fetcherState.fetches[existingToken].isPrimary || secondsDifference >= 1
              if (abortRequest) {
                fetcherState.fetches[existingToken].abort = true
              }
            }
          }

          // we do not need to continue fetching, the previous result can be returned
          // e.g. client-side load after server-side or we return to the original page before the new one has finished loading
          return {
            continue: false,
            resources: lastSuccessState.resources,
            token: fetcherState.primaryFetch.successToken,
          }
        }
      }

      // initialise
      const token = uuidv4()
      const initialState: FetchStatus = reactive({
        path: event.path,
        resources: [],
        isPrimary: !!event.isPrimary,
        timestamp,
      })
      if (event.manifestPath) {
        initialState.manifest = {
          path: event.manifestPath,
        }
      }

      if (event.isPrimary) {
        fetcherState.primaryFetch.fetchingToken = token
      }

      fetcherState.fetches[token] = initialState
      return { token, continue: true, resources: [] }
    },
    finishFetch(event: FinishFetchEvent) {
      const fetchStatus = getFetchStatusFromToken(event.token)

      if (
        !fetchStatus.isPrimary
      ) {
        // chain not needed anymore, will not be referenced anywhere
        delete fetcherState.fetches[event.token]
        return
      }

      const initialFetchingToken = fetcherState.primaryFetch.fetchingToken
      const initialSuccessToken = fetcherState.primaryFetch.successToken

      // update the token references
      if (event.token === initialFetchingToken) {
        fetcherState.primaryFetch.fetchingToken = undefined
        fetcherState.primaryFetch.successToken = event.token
      }

      // we should delete an old success token if a new one is being set
      // we should not delete if it is the old success token that we are setting it back to
      if (
        initialSuccessToken && fetcherState.primaryFetch.successToken !== initialSuccessToken
      ) {
        delete fetcherState.fetches[initialSuccessToken]
      }

      if (event.token !== fetcherState.primaryFetch.successToken) {
        delete fetcherState.fetches[event.token]
      }
    },
    addFetchResource(event: AddFetchResourceEvent) {
      const fetchStatus = getFetchStatusFromToken(event.token)

      // isFetchStatusCurrent return true if not primary or if primary and current
      if (fetchStatus.resources.includes(event.resource) || !fetcherGetters.isCurrentFetchingToken.value(event.token)) {
        return false
      }

      fetchStatus.resources.push(event.resource)
      return true
    },
    clearFetches() {
      console.log('!!!!clearFetches')
      fetcherState.primaryFetch.fetchingToken = undefined
      fetcherState.primaryFetch.successToken = undefined
      for (const token of Object.keys(fetcherState.fetches)) {
        delete fetcherState.fetches[token]
      }
    },
  }
}
