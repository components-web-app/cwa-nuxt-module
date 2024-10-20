import type { CwaFetcherStateInterface, FetchStatus } from './state'

export class FetcherGetterUtils {
  private fetcherState: CwaFetcherStateInterface

  public constructor(fetcherState: CwaFetcherStateInterface) {
    this.fetcherState = fetcherState
  }

  public getFetchStatusByToken(token: string): FetchStatus | undefined {
    const fetchStatus = this.fetcherState.fetches[token]
    if (!fetchStatus) {
      return
    }
    return fetchStatus
  }

  public isFetchResolving(token: string): boolean {
    const fetchStatus = this.getFetchStatusByToken(token)

    if (!fetchStatus) {
      return false
    }

    if (fetchStatus.abort) {
      return false
    }

    const resources = fetchStatus.resources
    if (!resources.length) {
      return false
    }

    return !!(fetchStatus.manifest && fetchStatus.manifest.resources === undefined && fetchStatus.manifest.error === undefined)
  }
}
