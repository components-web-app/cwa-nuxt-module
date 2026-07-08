import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import type { CwaFetcherStateInterface, FetchStatus } from './state'
import { FetcherGetterUtils } from './getter-utils'

export interface CwaFetcherGettersInterface {
  resolvedSuccessFetchStatus: ComputedRef<FetchStatus | undefined>
  resolvedDisplayFetchStatus: ComputedRef<FetchStatus | undefined>
  primaryFetchPath: ComputedRef<string | undefined>
  fetchesResolved: ComputedRef<boolean>
  isFetchResolving: ComputedRef<(token: string) => { fetchStatus: FetchStatus | undefined, resolving: boolean }>
  isCurrentFetchingToken: ComputedRef<(token: string) => boolean | undefined>
}

export default function (fetcherState: CwaFetcherStateInterface): CwaFetcherGettersInterface {
  const utils = new FetcherGetterUtils(fetcherState)

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
    resolvedSuccessFetchStatus: computed(() => {
      if (!fetcherState.primaryFetch.successToken) {
        return
      }

      const fetchStatus = utils.getFetchStatusByToken(fetcherState.primaryFetch.successToken)
      if (!fetchStatus || utils.isFetchResolving(fetcherState.primaryFetch.successToken)) {
        return
      }

      return fetchStatus
    }),
    // The page to keep rendering while a new one loads. Prefers `displayedToken` (the page actually
    // on screen — possibly a superseded, partially-loaded one we deliberately hold) and only falls
    // back to the resolved success when nothing has been displayed yet. Reading the success fallback
    // keeps the previous behaviour (isFetchResolving-gated) for first loads. See #256.
    resolvedDisplayFetchStatus: computed(() => {
      const { displayedToken, successToken } = fetcherState.primaryFetch
      if (displayedToken) {
        const displayedStatus = utils.getFetchStatusByToken(displayedToken)
        if (displayedStatus) {
          return displayedStatus
        }
      }
      if (!successToken) {
        return
      }
      const successStatus = utils.getFetchStatusByToken(successToken)
      if (!successStatus || utils.isFetchResolving(successToken)) {
        return
      }
      return successStatus
    }),
    fetchesResolved: computed(() => {
      for (const token of Object.keys(fetcherState.fetches)) {
        if (utils.isFetchResolving(token)) {
          return false
        }
      }
      return true
    }),
    isFetchResolving: computed(() => {
      return (token: string) => ({
        fetchStatus: utils.getFetchStatusByToken(token),
        resolving: utils.isFetchResolving(token),
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
    }),
  }
}
