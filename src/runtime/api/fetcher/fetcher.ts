import { RouteLocationNormalizedLoaded } from 'vue-router'
import { CwaResource, getResourceTypeFromIri } from '../../resources/resource-utils'
import { FinishFetchManifestType } from '../../storage/stores/fetcher/actions'
import CwaFetch from './cwa-fetch'
import FetchStatusManager from './fetch-status-manager'
import preloadHeaders from './preload-headers'

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
      // todo: perhaps wait for the resource status to be ok and then return the resource? hmmm..
      return
    }

    if (manifestPath) {
      this.fetchManifest({ token: startFetchResult.token, manifestPath }).then(() => {})
    }

    this.fetchStatusManager.startFetchResource({
      resource: path,
      token: startFetchResult.token
    })

    const finishFetchResourceEvent = {
      resource: path,
      token: startFetchResult.token
    }
    try {
      await this.fetch({
        path,
        preload
      })
      this.fetchStatusManager.finishFetchResource({
        ...finishFetchResourceEvent,
        success: true
      })
    } catch (error: any) {
      // todo: refactor generating the CwaError from caught error so they are uniform
      this.fetchStatusManager.finishFetchResource({
        ...finishFetchResourceEvent,
        success: false,
        error: {
          statusCode: error?.statusCode,
          message: error?.message || 'An unknown error occurred'
        }
      })
    }

    // todo: IF WE HAVE A RESPONSE FROM FETCH - move finishFetchResource to here too
    // todo: validate response is a resource - adjust success status accordingly
    // todo: if still OK, pass to save the resource with data and headers

    // if an existing token was not provided, we can finish it
    if (!token) {
      await this.fetchStatusManager.finishFetch({
        token: startFetchResult.token
      })
    }

    // todo: return the resource if valid
  }

  private async fetchManifest (event: FetchManifestEvent): Promise<void> {
    let resources: string[] = []
    try {
      const response = await this.fetch({
        path: event.manifestPath
      })
      resources = response._data.resource_iris || []
      if (resources.length) {
        // todo: fetch batch here but do not await the response, we do not care, but the resources need to be populated in the store before we finish the manifest status to prevent any possible flickering of success status on the fetch chain status
      }
      this.fetchStatusManager.finishManifestFetch({
        type: FinishFetchManifestType.SUCCESS,
        token: event.token,
        resources
      })
    } catch (error: any) {
      // todo: refactor generating the CwaError from caught error so they are uniform
      this.fetchStatusManager.finishManifestFetch({
        type: FinishFetchManifestType.ERROR,
        token: event.token,
        error: {
          statusCode: error?.statusCode,
          message: error?.message || 'An unknown error occurred'
        }
      })
    }
  }

  // todo: fetch nested resources
  // todo: fetch batch

  private fetch (event: FetchEvent) {
    const url = this.appendQueryToPath(event.path)
    const headers = this.createRequestHeaders(event)
    return this.cwaFetch.fetch.raw<any>(url, {
      headers
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
