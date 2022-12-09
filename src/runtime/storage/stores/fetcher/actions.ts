import { reactive } from 'vue'
import { ResourcesStore } from '../resources/resources-store'
import { FinishFetchEvent, StartFetchEvent } from '../../../api/fetcher/fetch-status'
import { CwaFetcherStateInterface } from './state'
import { CwaFetcherGettersInterface } from '@cwa/nuxt-module/runtime/storage/stores/fetcher/getters'

export enum fetcherInitTypes {
  START = 'start',
  FINISH = 'finish'
}

interface _FinishFetchEvent extends FinishFetchEvent {
  type: fetcherInitTypes.FINISH
}

interface _StartFetchEvent extends StartFetchEvent {
  token: string
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
      const fetchObj = fetcherState.status.fetch
      const isExistingFetchSame = event.token === fetchObj?.token

      // premature result to caller
      if (startFetch) {
        const previousFetchSame = event.path === fetcherState.status.fetch?.path || event.path === fetcherState.status.fetched?.path
        if (previousFetchSame) {
          // we should not initialise, it is the same as previous
          return false
        }
        if (fetchInProgress) {
          return true
        }

        if (event.resetCurrentResources) {
          resourcesStore.useStore().resetCurrentResources()
        }
        fetcherState.status.fetch = reactive({
          path: event.path,
          token: event.token
        })
        return true
      }

      if (!isExistingFetchSame) {
        return false
      }

      fetchObj.success = event.fetchSuccess
      if (!event.fetchSuccess) {
        return true
      }

      fetcherState.status.fetched = reactive({ path: fetchObj.path })

      // if we specify the page then we want to know what endpoint was used to load this page in
      // otherwise the last endpoint can be whatever fetch was made, i.e. a component/position etc.
      if (event.pageIri) {
        fetcherState.fetchedPage = reactive({
          path: fetchObj.path,
          iri: event.pageIri
        })
      }
      return true
    }
  }
}
