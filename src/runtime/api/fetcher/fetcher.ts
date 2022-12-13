import { RouteLocationNormalizedLoaded } from 'vue-router'
import CwaFetch from './cwa-fetch'
import FetchStatusManager from './fetch-status-manager'
import { CwaResource } from '@cwa/nuxt-module/runtime/resources/resource-utils'

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
    const token = this.fetchStatusManager.startFetch({
      path: iri,
      isPrimary: true,
      manifestPath: `/_/routes_manifest/${path}`
    })
    if (!token) {
      return
    }
    const resource = await this.fetchResource(iri, token)
    this.fetchStatusManager.finishFetch({
      token
    })
    return resource
  }

  public async fetchResource (path: string, token?: string): Promise<CwaResource|undefined> {
    let resourceFetchToken: string|undefined
    if (!token) {
      resourceFetchToken = this.fetchStatusManager.startFetch({
        path
      })
      if (!resourceFetchToken) {
        return
      }
      token = resourceFetchToken
    }

    this.fetchStatusManager.startFetchResource({
      resource: path,
      token
    })

    // do the fetching here

    this.fetchStatusManager.finishFetchResource({
      resource: path,
      status: 1,
      token
    })

    if (resourceFetchToken) {
      this.fetchStatusManager.finishFetch({
        token: resourceFetchToken
      })
    }
  }
}
