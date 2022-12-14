import { RouteLocationNormalizedLoaded } from 'vue-router'
import { CwaResource, getResourceTypeFromIri } from '../../resources/resource-utils'
import { FinishFetchManifestType } from '../../storage/stores/fetcher/actions'
import CwaFetch from './cwa-fetch'
import FetchStatusManager from './fetch-status-manager'
import preloadHeaders from './preload-headers'
import { FetchError } from 'ohmyfetch'

interface FetchResourceEvent {
  path: string
  token?: string
  manifestPath?: string
  preload?: string[]
}

export interface FetchManifestEvent {
  manifestPath: string
  token: string
}

interface FetchEvent {
  path: string
  preload?: string[]
}

export default class Fetcher {
  private readonly cwaFetch: CwaFetch
  private fetchStatusManager: FetchStatusManager
  private currentRoute: RouteLocationNormalizedLoaded

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
    // todo: handle if the returned route is a redirect and we should change the path loaded for the user or a redirect etc.
    const iri = `/_/routes/${path}`
    const manifestPath = `/_/routes_manifest/${path}`
    const startFetchResult = this.fetchStatusManager.startFetch({
      path: iri,
      isPrimary: true,
      manifestPath
    })
    if (!startFetchResult.continue) {
      return
    }
    const resource = await this.fetchResource({ path: iri, token: startFetchResult.token, manifestPath })
    await this.fetchStatusManager.finishFetch({
      token: startFetchResult.token
    })
    return resource
  }

  public async fetchResource ({ path, token, manifestPath, preload }: FetchResourceEvent): Promise<CwaResource|undefined> {
    const startFetchResult = this.fetchStatusManager.startFetch({
      path,
      token
    })
    if (!startFetchResult.continue) {
      return
    }

    if (manifestPath) {
      this.fetchManifest({ token: startFetchResult.token, manifestPath }).then(() => {})
    }

    this.fetchStatusManager.startFetchResource({
      resource: path,
      token: startFetchResult.token
    })

    try {
      await this.fetch({
        path,
        preload
      })
      this.fetchStatusManager.finishFetchResource({
        resource: path,
        success: true,
        token: startFetchResult.token
      })
    } catch (error: any) {
      this.fetchStatusManager.finishFetchResource({
        resource: path,
        success: false,
        token: startFetchResult.token,
        error: {
          statusCode: error?.statusCode,
          message: error?.message || 'An unknown error occurred'
        }
      })
    }

    // if an existing token was not provided, we can finish it
    if (!token) {
      await this.fetchStatusManager.finishFetch({
        token: startFetchResult.token
      })
    }
  }

  private async fetchManifest (event: FetchManifestEvent): Promise<void> {
    // update fetcher store when the manifest resources have been fetched once we have called to fetch resources, because then they will be populated as being fetched
    // do the fetching here
    await new Promise((resolve) => {
      setTimeout(() => {
        resolve(true)
      }, (Math.random() * 10) + 20)
    })

    const resources: string[] = ['/some-resource']
    // todo: fetch batch here...

    this.fetchStatusManager.finishManifestFetch({
      type: FinishFetchManifestType.SUCCESS,
      token: event.token,
      resources
    })

    // this.fetchStatusManager.finishManifestFetch({
    //   type: FinishFetchManifestType.ERROR,
    //   token: event.token,
    //   error: {
    //     message: 'manifest error message'
    //   }
    // })
  }

  private fetch (event: FetchEvent) {
    const url = this.appendQueryToPath(event.path)
    const headers = this.createRequestHeaders(event)
    return this.cwaFetch.fetch.raw<any>(url, {
      headers
      // onResponse: context => (this.handleFetchResponse(context)),
      // onRequestError: this.handleFetchError
    })
  }

  private appendQueryToPath (path: string): string {
    const queryObj = this.currentRoute.query
    if (!queryObj) {
      return path
    }
    const queryKeys = Object.keys(queryObj)
    if (!queryKeys.length) {
      return path
    }

    const queryString = queryKeys
      .map((key: string) => key + '=' + queryObj[key])
      .join('&')
    const delimiter = path.includes('?') ? '&' : '?'
    return `${path}${delimiter}${queryString}`
  }

  private createRequestHeaders (event: FetchEvent): { path?: string; preload?: string } {
    let preload = event.preload
    if (!preload) {
      const resourceType = getResourceTypeFromIri(event.path)
      if (resourceType) {
        preload = preloadHeaders[resourceType]
      }
    }
    return {
      path: this.fetchStatusManager.primaryFetchPath,
      preload: preload ? preload.join(',') : undefined
    }
  }
}
