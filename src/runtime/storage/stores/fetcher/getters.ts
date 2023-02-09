import { computed, ComputedRef } from 'vue'
import { CwaFetcherStateInterface, FetchStatus } from './state'

export interface CwaFetcherGettersInterface {
  resolvedSuccessFetchStatus: ComputedRef<FetchStatus|undefined>
  primaryFetchPath: ComputedRef<string|undefined>
  fetchesResolved: ComputedRef<boolean>,
  isFetchResolving: ComputedRef<(token: string) => { fetchStatus: FetchStatus|undefined, resolving: boolean }>,
  isCurrentFetchingToken: ComputedRef<(token: string) => boolean|undefined>
}

export default function (fetcherState: CwaFetcherStateInterface): CwaFetcherGettersInterface {
  function getFetchStatusByToken (token: string): FetchStatus|undefined {
    const fetchStatus = fetcherState.fetches[token]
    if (!fetchStatus) {
      return
    }
    return fetchStatus
  }

  function isFetchResolving (token: string): boolean {
    const fetchStatus = getFetchStatusByToken(token)

    if (!fetchStatus) {
      return false
    }

    if (fetchStatus.abort) {
      return false
    }

    // validate we have resources
    const resources = fetchStatus.resources
    const isManifestResolving = !!(fetchStatus.manifest && fetchStatus.manifest.resources === undefined && fetchStatus.manifest.error === undefined)
    return !resources.length || isManifestResolving
  }

  const primaryFetchPath = computed(() => {
    const primaryFetchToken = fetcherState.primaryFetch.fetchingToken || fetcherState.primaryFetch.successToken
    if (!primaryFetchToken) {
      return
    }
    const fetchStatus = fetcherState.fetches[primaryFetchToken]
    return fetchStatus?.path
  })
  return {
    primaryFetchPath,
    // todo: test
    resolvedSuccessFetchStatus: computed(() => {
      if (!fetcherState.primaryFetch.successToken) {
        return
      }

      const fetchStatus = getFetchStatusByToken(fetcherState.primaryFetch.successToken)
      if (!fetchStatus || isFetchResolving(fetcherState.primaryFetch.successToken)) {
        return
      }

      return fetchStatus
    }),
    // todo: test
    fetchesResolved: computed(() => {
      for (const token of Object.keys(fetcherState.fetches)) {
        if (isFetchResolving(token)) {
          return false
        }
      }
      return true
    }),
    // todo: test
    isFetchResolving: computed(() => {
      return (token: string) => ({
        fetchStatus: getFetchStatusByToken(token),
        resolving: isFetchResolving(token)
      })
    }),
    isCurrentFetchingToken: computed(() => {
      return (token: string) => {
        const fetchStatus = fetcherState.fetches[token]
        if (!fetchStatus) {
          throw new Error(`Failed to check if the token '${token}' is current. It does not exist.`)
        }
        if (fetchStatus.abort) {
          return false
        }
        return !fetchStatus.isPrimary || token === fetcherState.primaryFetch.fetchingToken
      }
    })
  }
}
