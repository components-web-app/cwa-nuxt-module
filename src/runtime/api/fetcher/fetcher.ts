import { RouteLocationNormalizedLoaded } from 'vue-router'
import CwaFetch from './cwa-fetch'
import FetchStatusManager from './fetch-status-manager'
import { CwaResource } from '@cwa/nuxt-module/runtime/resources/resource-utils'

interface FetchResourceEvent {
  path: string
  token?: string
}

export default class Fetcher {
  private readonly cwaFetch: CwaFetch
  private fetchStatusManager: FetchStatusManager

  constructor (
    cwaFetch: CwaFetch,
    fetchStatusManager: FetchStatusManager,
    currentRoute: RouteLocationNormalizedLoaded
  ) {
    this.cwaFetch = cwaFetch
    this.fetchStatusManager = fetchStatusManager
    this.currentRoute = currentRoute
  }

  public async fetchRoute (path: string): Promise<CwaResource|undefined> {
    const iri = `/_/routes/${path}`
    const startFetchResult = this.fetchStatusManager.startFetch({
      path: iri,
      isPrimary: true,
      manifestPath: `/_/routes_manifest/${path}`
    })
    if (!startFetchResult.continue) {
      return
    }
    const resource = await this.fetchResource({ path: iri, token: startFetchResult.token })
    this.fetchStatusManager.finishFetch({
      token: startFetchResult.token
    })
    return resource
  }

  public async fetchResource ({ path, token }: FetchResourceEvent): Promise<CwaResource|undefined> {
    const startFetchResult = this.fetchStatusManager.startFetch({
      path,
      token
    })
    if (!startFetchResult.continue) {
      return
    }

    this.fetchStatusManager.startFetchResource({
      resource: path,
      token: startFetchResult.token
    })

    // do the fetching here
    await new Promise((resolve) => {
      setTimeout(() => {
        resolve(true)
      }, (Math.random() * 10) + 10)
    })

    // do fetching of nested resources here too

    this.fetchStatusManager.finishFetchResource({
      resource: path,
      success: true,
      token: startFetchResult.token
    })

    // if an existing token was not provided, we can finish it
    if (!token) {
      this.fetchStatusManager.finishFetch({
        token: startFetchResult.token
      })
    }
  }

  private fetchManifest () {
    // update fetcher store when the manifest resources have been fetched once we have called to fetch resources, because then they will be populated as being fetched
  }
}
