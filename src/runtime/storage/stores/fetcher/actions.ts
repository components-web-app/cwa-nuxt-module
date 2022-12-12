import { reactive, watch } from 'vue'
import { FetchError } from 'ohmyfetch'
import consola from 'consola'
import { ResourcesStore } from '../resources/resources-store'
import { FinishFetchEvent, StartFetchEvent } from '../../../api/fetcher/fetch-status'
import { CwaFetcherStateInterface } from './state'
import { CwaFetcherGettersInterface } from '@cwa/nuxt-module/runtime/storage/stores/fetcher/getters'

interface _StartFetchEvent extends StartFetchEvent {
  token: string
}

export interface SetFetchManifestEvent {
  path: string
  inProgress: boolean
  fetchError?: FetchError
}

export interface CwaFetcherActionsInterface {
  setFetchManifestStatus (event: SetFetchManifestEvent): boolean
  startFetchStatus (event: _StartFetchEvent): boolean
  finishFetchStatus (event: FinishFetchEvent): Promise<boolean>
}

export default function (fetcherState: CwaFetcherStateInterface, fetcherGetters: CwaFetcherGettersInterface, resourcesStore: ResourcesStore): CwaFetcherActionsInterface {
  // This function is internal and should not be accessible as a store action
  async function waitForManifestResolve (eventToken: string) {
    // Create a resolver what we can call elsewhere
    let watchManifestResolve: (value: void | PromiseLike<void>) => void
    const watchManifestPromise = new Promise((resolve) => {
      watchManifestResolve = resolve
    })

    // start watching immediately for the manifest fetch to complete
    const stopWatchingFn = watch(fetcherGetters.manifestsInProgress, (newInProgressValue) => {
      if (!newInProgressValue) {
        consola.trace('Manifests status OK', eventToken)
        watchManifestResolve()
      }
    }, {
      immediate: true
    })

    // wait for the custom resolver to be called inside the watch function
    await watchManifestPromise

    // has to be called outside the watch method itself, or it is called sometimes before initialised
    stopWatchingFn()
  }

  return {
    setFetchManifestStatus (event: SetFetchManifestEvent): boolean {
      if (event.inProgress && fetcherGetters.manifestInProgress.value(event.path)) {
        return false
      }
      fetcherState.manifests[event.path] = reactive({
        inProgress: event.inProgress,
        fetchError: event.fetchError
      })
      return true
    },
    startFetchStatus (event: _StartFetchEvent): boolean {
      // there are other fetches ongoing, so we have not re-initialised the primary state
      // even if it is the same fetch path, it is not this status responsibility to return an existing promise
      // it may not exist yet so we can continue to create it
      if (fetcherGetters.inProgress.value) {
        return true
      }

      const previousSuccessfulFetchSame = event.path === fetcherState.status.fetched?.path
      // we should not re-initialise if the previous fetch is the same or there is any other fetch ongoing
      if (previousSuccessfulFetchSame) {
        // we should not initialise, it is the same as previous
        return false
      }

      if (event.resetCurrentResources) {
        resourcesStore.useStore().resetCurrentResources()
      }
      fetcherState.status.fetch = reactive({
        path: event.path,
        token: event.token
      })
      consola.debug('Primary fetch status initialised', event)

      return true
    },
    async finishFetchStatus (event: FinishFetchEvent): Promise<boolean> {
      const fetchObj = fetcherState.status.fetch
      const isExistingFetchSame = event.token === fetchObj?.token

      if (!isExistingFetchSame) {
        return false
      }

      await waitForManifestResolve(event.token)

      consola.debug('Primary fetch status finished', event)

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
