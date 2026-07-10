import { v4 as uuidv4 } from 'uuid'
import { reactive } from 'vue'
import { consola as logger } from 'consola'
import type { CwaResourceError } from '../../../errors/cwa-resource-error'
import type { CwaFetcherStateInterface, FetchAbortReason, FetchStatus, NestedJsonStructure } from './state'
import type { CwaFetcherGettersInterface } from './getters'
import { flattenManifestNode } from './manifest-utils'
import type { CwaFetchRequestHeaders } from '#cwa/api/fetcher/fetcher'

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
  headers?: CwaFetchRequestHeaders
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
}

export interface SetManifestIrisByDepthEvent {
  token: string
  resourceIris: NestedJsonStructure[]
}

export interface ManifestErrorFetchEvent {
  type: FinishFetchManifestType.ERROR
  token: string
  error: CwaResourceError
}

interface AbortFetchEvent {
  token: string
  reason?: FetchAbortReason
}

export interface CwaFetcherActionsInterface {
  abortFetch(event: AbortFetchEvent): void
  setDisplayedToken(token: string): void
  setManifestIrisByDepth(event: SetManifestIrisByDepthEvent): void
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

  // Delete a fetch from the chain unless it is still referenced by one of the primary tokens.
  // Protects `displayedToken` (the page currently on screen) from being cleaned up while a
  // superseded fetch is being held on screen. See #256.
  function cleanupFetch(token?: string) {
    if (!token) {
      return
    }
    const { fetchingToken, successToken, displayedToken } = fetcherState.primaryFetch
    if (token === fetchingToken || token === successToken || token === displayedToken) {
      return
    }
    delete fetcherState.fetches[token]
  }

  // Retain a successfully-fetched route's manifest structure (IRIs only) so a later revisit can lay
  // out + locate the page instantly, without waiting for a fresh manifest round-trip. See #257.
  function cacheRoute(fetchStatus: FetchStatus) {
    const manifest = fetchStatus.manifest
    if (!manifest?.resourceTree || !manifest.irisByDepth) {
      // no manifest (e.g. a direct single-resource fetch) — nothing structural to retain
      return
    }
    fetcherState.routeCache.set(fetchStatus.path, {
      resourceTree: manifest.resourceTree,
      irisByDepth: manifest.irisByDepth,
      resourceIris: [...new Set(manifest.irisByDepth.flat())],
      cachedAt: (new Date()).getTime(),
      lastAccessed: (new Date()).getTime(),
    })
  }

  return {
    abortFetch(event: AbortFetchEvent) {
      const fetchStatus = getFetchStatusFromToken(event.token)
      fetchStatus.abort = true
      if (event.reason) {
        fetchStatus.abortReason = event.reason
      }
    },
    setDisplayedToken(token: string) {
      const previous = fetcherState.primaryFetch.displayedToken
      fetcherState.primaryFetch.displayedToken = token
      // the previously-displayed fetch is no longer on screen — clean it up if nothing else needs it
      if (previous && previous !== token) {
        cleanupFetch(previous)
      }
    },
    setManifestIrisByDepth(event: SetManifestIrisByDepthEvent) {
      const fetchStatus = getFetchStatusFromToken(event.token)
      if (!fetchStatus.manifest) {
        throw new Error(`Cannot set manifest IRIs by depth for '${event.token}'. The manifest was never started.`)
      }
      // Retain the raw tree for future placeholder rendering; derive the flat per-depth IRI lists
      // that existing consumers (pageIriAtDepth, early-switch, fetch batch) read.
      fetchStatus.manifest.resourceTree = event.resourceIris
      fetchStatus.manifest.irisByDepth = event.resourceIris.map(flattenManifestNode)
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
        fetchStatus.manifest.fetchComplete = true
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
          // We are returning to the already-resolved success page, so it is what is on screen now.
          // Re-point the displayed token to it — otherwise a `displayedToken` left pointing at a
          // different page (e.g. by a prior instant-revisit prime, #257) wedges the view there. See #256/#257.
          fetcherState.primaryFetch.displayedToken = fetcherState.primaryFetch.successToken

          for (const [existingToken, existingValue] of Object.entries(fetcherState.fetches)) {
            if (existingToken !== fetcherState.primaryFetch.successToken) {
              const secondsDifference = (timestamp - existingValue.timestamp) / 1000
              // abort old requests or previous primary fetches
              const abortRequest = existingValue.isPrimary || secondsDifference >= 1
              if (abortRequest) {
                existingValue.abort = true
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
        cleanupFetch(event.token)
        return
      }

      // A primary fetch aborted as a redirect (see fetcher `doRedirect`) resolved to a page-less
      // route. Promoting it to the displayed success state would blank the current page until the
      // redirect target loads. Keep the previous success page on screen: clear the fetching token
      // and drop this redirect fetch, leaving the previous success token and its resources
      // untouched. The redirect target fetch (request "C") becomes the new primary fetch and takes
      // over when it resolves — or, if it fails (404/401/500), it is NOT aborted so it falls
      // through to normal promotion and surfaces the error page via showError.
      if (fetchStatus.abortReason === 'redirect' && event.token === fetcherState.primaryFetch.fetchingToken) {
        fetcherState.primaryFetch.fetchingToken = undefined
        cleanupFetch(event.token)
        return
      }

      const initialFetchingToken = fetcherState.primaryFetch.fetchingToken
      const initialSuccessToken = fetcherState.primaryFetch.successToken
      const initialDisplayedToken = fetcherState.primaryFetch.displayedToken

      // update the token references
      if (event.token === initialFetchingToken) {
        fetcherState.primaryFetch.fetchingToken = undefined
        fetcherState.primaryFetch.successToken = event.token
        // a fully-resolved page is now what is on screen — advance the displayed reference to it
        fetcherState.primaryFetch.displayedToken = event.token
        // retain this route's manifest structure so a later revisit can render instantly (#257)
        cacheRoute(fetchStatus)
      }

      // the previously-displayed (superseded) page is no longer needed once a new page is displayed
      if (initialDisplayedToken && fetcherState.primaryFetch.displayedToken !== initialDisplayedToken) {
        cleanupFetch(initialDisplayedToken)
      }

      // we should delete an old success token if a new one is being set
      // we should not delete if it is the old success token that we are setting it back to
      if (
        initialSuccessToken && fetcherState.primaryFetch.successToken !== initialSuccessToken
      ) {
        cleanupFetch(initialSuccessToken)
      }

      if (event.token !== fetcherState.primaryFetch.successToken) {
        cleanupFetch(event.token)
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
      fetcherState.primaryFetch.fetchingToken = undefined
      fetcherState.primaryFetch.successToken = undefined
      fetcherState.primaryFetch.displayedToken = undefined
      for (const token of Object.keys(fetcherState.fetches)) {
        delete fetcherState.fetches[token]
      }
    },
  }
}
