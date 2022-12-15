import bluebird from 'bluebird'
import { RouteLocationNormalizedLoaded } from 'vue-router'
import { FetchResponse } from 'ohmyfetch'
import { CwaResource, CwaResourceTypes, getResourceTypeFromIri } from '../../resources/resource-utils'
import { FinishFetchManifestType } from '../../storage/stores/fetcher/actions'
import { createCwaResourceError } from '../../errors/cwa-resource-error'
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

export interface CwaFetchResponse extends FetchResponse<CwaResource|undefined> {}

type TypeToNestedPropertiesMap = {
  [T in CwaResourceTypes]: Array<string>;
}

const resourceTypeToNestedResourceProperties: TypeToNestedPropertiesMap = {
  [CwaResourceTypes.ROUTE]: ['pageData', 'page'],
  [CwaResourceTypes.PAGE]: ['layout', 'componentGroups'],
  [CwaResourceTypes.PAGE_DATA]: ['page'],
  [CwaResourceTypes.LAYOUT]: ['componentGroups'],
  [CwaResourceTypes.COMPONENT_GROUP]: ['componentPositions'],
  [CwaResourceTypes.COMPONENT_POSITION]: ['component'],
  [CwaResourceTypes.COMPONENT]: ['componentGroups']
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

    const continueToFetchResource = this.fetchStatusManager.startFetchResource({
      resource: path,
      token: startFetchResult.token
    })
    if (!continueToFetchResource) {
      return
    }

    const finishFetchResourceEvent = {
      resource: path,
      token: startFetchResult.token
    }
    let fetchResponse: CwaFetchResponse
    let resource: CwaResource|undefined
    try {
      fetchResponse = await this.fetch({
        path,
        preload
      })
      resource = this.fetchStatusManager.finishFetchResource({
        ...finishFetchResourceEvent,
        success: true,
        fetchResponse
      })
    } catch (error: any) {
      this.fetchStatusManager.finishFetchResource({
        ...finishFetchResourceEvent,
        success: false,
        error: createCwaResourceError(error)
      })
    }

    if (resource) {
      await this.fetchNestedResources(resource, startFetchResult.token)
    }

    if (!token) {
      await this.fetchStatusManager.finishFetch({
        token: startFetchResult.token
      })
    }

    return resource
  }

  private async fetchManifest (event: FetchManifestEvent): Promise<void> {
    let resources: string[] = []
    try {
      const response = await this.fetch({
        path: event.manifestPath
      })
      resources = response._data?.resource_iris || []
      if (resources.length) {
        // todo: test
        // we are fetching this batch and can await it so that we do not set the finish fetch manifest to successful early
        await this.fetchBatch(resources, event.token)
      }
      this.fetchStatusManager.finishManifestFetch({
        type: FinishFetchManifestType.SUCCESS,
        token: event.token,
        resources
      })
    } catch (error: any) {
      this.fetchStatusManager.finishManifestFetch({
        type: FinishFetchManifestType.ERROR,
        token: event.token,
        error: createCwaResourceError(error)
      })
    }
  }

  // todo: test this function
  private fetchNestedResources (resource: CwaResource, token: string): undefined|bluebird<(CwaResource|undefined)[]> {
    const iri = resource['@id']
    const type = getResourceTypeFromIri(iri)
    if (!type) {
      return
    }
    const nestedIris = []
    const nestedPropertiesToFetch = resourceTypeToNestedResourceProperties[type]
    for (const prop of nestedPropertiesToFetch) {
      const propIris = resource[prop]
      if (!propIris) {
        continue
      }
      if (Array.isArray(propIris)) {
        nestedIris.push(...propIris)
      } else {
        nestedIris.push(propIris)
      }
    }
    return this.fetchBatch(nestedIris, token)
  }

  // todo: test this function
  private fetchBatch (paths: string[], token?: string): bluebird<(CwaResource|undefined)[]> {
    return bluebird
      .map(
        paths,
        (path: string) => {
          return this.fetchResource({ path, token })
        },
        {
          concurrency: 10000
        }
      )
  }

  private fetch (event: FetchEvent): Promise<CwaFetchResponse> {
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
