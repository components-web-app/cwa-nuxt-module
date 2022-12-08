import { CwaFetcherAsyncResponse } from '../../../api/fetcher/fetcher'
import { ResourcesStore } from '../resources/resources-store'
import { CwaFetcherStateInterface } from './state'
import { CwaFetcherGettersInterface } from '@cwa/nuxt-module/runtime/storage/stores/fetcher/getters'

export enum fetcherInitTypes {
  START = 'start',
  FINISH = 'finish'
}

interface BaseFetchEvent {
  path: string
}

export interface StartFetchEvent extends BaseFetchEvent {
  resetCurrentResources?: boolean // should only be allowed if fetchSuccess is not defined
}

export interface FinishFetchEvent extends BaseFetchEvent {
  pageIri?: string
  fetchSuccess: boolean
}

interface _FinishFetchEvent extends FinishFetchEvent {
  type: fetcherInitTypes.FINISH
}

interface _StartFetchEvent extends StartFetchEvent {
  type: fetcherInitTypes.START
}

declare type InitFetchEvent = _FinishFetchEvent | _StartFetchEvent

export interface CwaFetcherActionsInterface {
  initFetchStatus (event: InitFetchEvent): boolean
}

export default function (fetcherState: CwaFetcherStateInterface, fetcherGetters: CwaFetcherGettersInterface, resourcesStore: ResourcesStore): CwaFetcherActionsInterface {
  return {
    initFetchStatus (event: InitFetchEvent): boolean {
      const startFetch = event.type === 'start'
      // do not action if the primary started endpoint is different, or do not start if already in progress
      const fetchInProgress = fetcherGetters.inProgress.value
      const isExistingFetchPathSame = event.path === fetcherState.status.fetch.path

      function callerToContinue (): boolean|undefined {
        if (startFetch) {
          const previousFetchSame = event.path === fetcherState.status.fetched.path || event.path === fetcherState.status.fetch.path
          if (previousFetchSame) {
            // we should not initialise, it is the same as previous
            return false
          }
          return fetchInProgress ? true : undefined
        }
        return isExistingFetchPathSame ? undefined : false
      }

      const prematureResult = callerToContinue()
      if (prematureResult !== undefined) {
        return prematureResult
      }

      if (startFetch) {
        if (event.resetCurrentResources) {
          resourcesStore.useStore().resetCurrentResources()
        }
        fetcherState.status.fetch.path = event.path
        return true
      }

      fetcherState.status.fetch.success = event.fetchSuccess
      if (!event.fetchSuccess) {
        return true
      }

      fetcherState.status.fetched.path = event.path
      fetcherState.status.fetch.path = undefined

      // if we specify the page then we want to know what endpoint was used to load this page in
      // otherwise the last endpoint can be whatever fetch was made, i.e. a component/position etc.
      if (event.pageIri) {
        fetcherState.fetchedPage = {
          path: event.path,
          iri: event.pageIri
        }
      }
      return true
    }
  }
}
