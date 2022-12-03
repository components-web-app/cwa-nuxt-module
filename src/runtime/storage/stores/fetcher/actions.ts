import { CwaFetcherAsyncResponse } from '../../../api/fetcher/fetcher'
import { ResourcesStore } from '../resources/resources-store'
import { CwaFetcherStateInterface } from './state'

export interface FinishFetchEvent {
  path: string
  pageIri?: string
  success?: boolean
}

export interface CwaFetcherActionsInterface {
  addPath (endpoint: string, promise: CwaFetcherAsyncResponse): void
  initFetchStatus (event: FinishFetchEvent): boolean
}

export default function (fetcherState: CwaFetcherStateInterface, resourcesStore: ResourcesStore): CwaFetcherActionsInterface {
  return {
    addPath (path: string, promise: CwaFetcherAsyncResponse) {
      if (undefined === fetcherState.status.fetch?.path) {
        return
      }
      fetcherState.status.fetch.paths[path] = promise
    },
    initFetchStatus ({ path, pageIri, success }: FinishFetchEvent): boolean {
      const startFetch = success === undefined
      // do not action if the primary started endpoint is different, or do not start if already in progress
      const fetchInProgress = fetcherState.status.fetch.inProgress
      const isExistingFetchPathSame = path === fetcherState.status.fetch.path

      if (startFetch) {
        const previousFetchSame = path === fetcherState.status.fetched.path
        if (previousFetchSame) {
          // we should not initialise, it is the same as previous
          return false
        }
        if (fetchInProgress) {
          // we are already init and in progress
          return true
        }
      } else if (!isExistingFetchPathSame) {
        // we should not finish up the init, it is a sub request happening and does not match the main endpoint in progress
        return false
      }

      if (startFetch) {
        resourcesStore.useStore().resetCurrentResources()
      }

      if (success === true && fetcherState.status.fetch.path) {
        // if we specify the page then we want to know what endpoint was used to load this page in
        // otherwise the last endpoint can be whatever fetch was made, i.e. a component/position etc.
        if (pageIri) {
          fetcherState.fetchedPage = {
            path: fetcherState.status.fetch.path,
            iri: pageIri
          }
        }
        fetcherState.status.fetched.path = fetcherState.status.fetch.path
      }

      fetcherState.status.fetch.path = startFetch ? path : undefined
      fetcherState.status.fetch.inProgress = startFetch
      if (!startFetch) {
        fetcherState.status.fetch.success = success
      }
      // clear previous endpoints on new request, or we have successfully finished the request stack
      if (startFetch || success) {
        fetcherState.status.fetch.paths = {}
      }
      return true
    }
  }
}
