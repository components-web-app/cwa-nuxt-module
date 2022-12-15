import { v4 as uuidv4 } from 'uuid'
import { reactive } from 'vue'
import { CwaResourceError } from '../../../errors/cwa-resource-error'
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

export interface StartFetchResponse {
  continue: boolean
  resources: string[]
  token: string
}

export enum FinishFetchManifestType {
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
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

export interface CwaFetcherActionsInterface {
  finishManifestFetch (event: ManifestSuccessFetchEvent | ManifestErrorFetchEvent): void
  startFetch(event: StartFetchEvent): StartFetchResponse
  finishFetch (event: FinishFetchEvent): void
  addFetchResource (event: AddFetchResourceEvent): boolean
}

export default function (fetcherState: CwaFetcherStateInterface, fetcherGetters: CwaFetcherGettersInterface): CwaFetcherActionsInterface {
  function getFetchStatusFromToken (token: string) {
    const fetchStatus = fetcherState.fetches[token]
    if (!fetchStatus) {
      throw new Error(`The fetch chain token '${token}' does not exist`)
    }
    return fetchStatus
  }

  return {
    finishManifestFetch (event: ManifestSuccessFetchEvent | ManifestErrorFetchEvent) {
      const fetchStatus = getFetchStatusFromToken(event.token)
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
    startFetch (event: StartFetchEvent): StartFetchResponse {
      if (event.token) {
        const existingFetchStatus = getFetchStatusFromToken(event.token)
        return {
          continue: true,
          resources: existingFetchStatus.resources,
          token: event.token
        }
      }

      // if we are doing a primary fetch and there is a success token already, let's check if that one is valid
      if (event.isPrimary && fetcherState.primaryFetch.successToken) {
        const lastSuccessState = fetcherState.fetches[fetcherState.primaryFetch.successToken]
        // check if this new path is the same as the last successful primary fetch and that the chain of fetch is complete
        if (lastSuccessState.path === event.path && fetcherGetters.isFetchChainComplete.value(fetcherState.primaryFetch.successToken) === true) {
          // we may have been in progress with a new primary fetch, but we do not need that anymore
          fetcherState.primaryFetch.fetchingToken = undefined

          // we do not need to continue fetching, the previous result can be returned
          // e.g. client-side load after server-side or we return to the original page before the new one has finished loading
          return {
            continue: false,
            resources: lastSuccessState.resources,
            token: fetcherState.primaryFetch.successToken
          }
        }
      }

      const token = uuidv4()
      const initialState: TopLevelFetchPathInterface = reactive({
        path: event.path,
        resources: [],
        isPrimary: !!event.isPrimary
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
      return { token, continue: true, resources: [] }
    },
    finishFetch (event: FinishFetchEvent) {
      const fetchStatus = getFetchStatusFromToken(event.token)

      if (!fetchStatus.isPrimary || fetcherState.primaryFetch.fetchingToken !== event.token) {
        // chain not needed anymore, will not be referenced anywhere
        delete fetcherState.fetches[event.token]
        return
      }

      // delete existing primary fetch chain
      if (fetcherState.primaryFetch.successToken) {
        // as we are in a primary fetch, should we also return all these resources that are OK to delete?
        // or do we return a status boolean and let the fetch status manager see that it was primary so that
        // it can delete all resources that are not currentIds
        delete fetcherState.fetches[fetcherState.primaryFetch.successToken]
      }

      // set the new success token
      fetcherState.primaryFetch.fetchingToken = undefined
      fetcherState.primaryFetch.successToken = event.token
    },
    addFetchResource (event: AddFetchResourceEvent) {
      const fetchStatus = getFetchStatusFromToken(event.token)

      // isFetchStatusCurrent return true if not primary or if primary and current
      if (fetchStatus.resources.includes(event.resource) || !fetcherGetters.isCurrentFetchingToken.value(event.token)) {
        return false
      }

      fetchStatus.resources.push(event.resource)
      return true
    }
  }
}
