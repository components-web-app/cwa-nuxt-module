import { CwaFetcherStateInterface, FetchStatus } from '@cwa/nuxt-module/runtime/storage/stores/fetcher/state'

// todo: test
export class FetcherGetterUtils {
  private fetcherState: CwaFetcherStateInterface

  public constructor (fetcherState: CwaFetcherStateInterface) {
    this.fetcherState = fetcherState
  }

  public getFetchStatusByToken (token: string): FetchStatus|undefined {
    const fetchStatus = this.fetcherState.fetches[token]
    if (!fetchStatus) {
      return
    }
    return fetchStatus
  }

  public isFetchResolving (token: string): boolean {
    const fetchStatus = this.getFetchStatusByToken(token)

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
}
