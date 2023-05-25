import { RouteLocationNormalizedLoaded } from 'vue-router'
import { FetchResponse } from 'ofetch'
import { CwaResource, CwaResourceTypes, getResourceTypeFromIri } from '../../resources/resource-utils'
import { FinishFetchManifestType } from '../../storage/stores/fetcher/actions'
import { createCwaResourceError } from '../../errors/cwa-resource-error'
import { ResourcesStore } from '../../storage/stores/resources/resources-store'
import CwaFetch from './cwa-fetch'
import FetchStatusManager from './fetch-status-manager'
import preloadHeaders from './preload-headers'

export interface FetchResourceEvent {
  path: string
  token?: string
  manifestPath?: string
  preload?: string[]
  shallowFetch?: boolean
  noSave?: boolean
  isPrimary?: boolean
}

export interface FetchManifestEvent {
  manifestPath: string
  token: string
}

interface FetchEvent {
  path: string
  preload?: string[]
}

export interface CwaFetchRequestHeaders {
  path?: string
  preload?: string
}

export interface CwaFetchResponse extends FetchResponse<CwaResource|undefined> {}

interface CwaFetchResponseRaw {
  response: Promise<CwaFetchResponse>
  headers: CwaFetchRequestHeaders
}

interface FetchBatchEvent {
  paths: string[]
  token?: string
  noSave?: boolean
}

interface FetchNestedResourcesEvent {
  resource: CwaResource
  token: string
  noSave: boolean
}

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
  private resourcesStoreDefinition: ResourcesStore

  constructor (
    cwaFetch: CwaFetch,
    fetchStatusManager: FetchStatusManager,
    currentRoute: RouteLocationNormalizedLoaded,
    resourcesStoreDefinition: ResourcesStore
  ) {
    this.cwaFetch = cwaFetch
    this.fetchStatusManager = fetchStatusManager
    this.currentRoute = currentRoute
    this.resourcesStoreDefinition = resourcesStoreDefinition
  }

  public async fetchRoute (route: RouteLocationNormalizedLoaded): Promise<CwaResource|undefined> {
    // todo: test
    if (route.meta.cwa === false) {
      return
    }
    let iri: string
    let manifestPath: string|undefined
    const routeParam = route.params.cwaPage0
    iri = Array.isArray(routeParam) ? routeParam[0] : routeParam
    const resourceType = iri ? getResourceTypeFromIri(iri) : undefined
    if (!resourceType || ![CwaResourceTypes.PAGE, CwaResourceTypes.PAGE_DATA].includes(resourceType)) {
      iri = `/_/routes/${route.path}`
      manifestPath = `/_/routes_manifest/${route.path}`
    }
    return await this.fetchResource({
      path: iri,
      isPrimary: true,
      manifestPath
    })
  }

  public async fetchResource ({ path, token, manifestPath, preload, shallowFetch, noSave, isPrimary }: FetchResourceEvent): Promise<CwaResource|undefined> {
    const startFetchResult = this.fetchStatusManager.startFetch({
      path,
      token,
      isPrimary,
      manifestPath
    })
    if (!startFetchResult.continue) {
      return this.fetchStatusManager.getFetchedCurrentResource(path)
    }

    if (manifestPath) {
      this.fetchManifest({ token: startFetchResult.token, manifestPath }).then(() => {})
    }

    const continueToFetchResource = this.fetchStatusManager.startFetchResource({
      resource: path,
      token: startFetchResult.token
    })
    if (!continueToFetchResource) {
      return this.fetchStatusManager.getFetchedCurrentResource(path)
    }

    const finishFetchResourceEvent = {
      resource: path,
      token: startFetchResult.token
    }
    let cwaFetchRaw: CwaFetchResponseRaw
    let resource: CwaResource|undefined
    try {
      cwaFetchRaw = this.fetch({
        path,
        preload
      })
      const fetchResponse = await cwaFetchRaw.response
      resource = this.fetchStatusManager.finishFetchResource({
        ...finishFetchResourceEvent,
        success: true,
        fetchResponse,
        headers: cwaFetchRaw.headers,
        noSave
      })
    } catch (error: any) {
      this.fetchStatusManager.finishFetchResource({
        ...finishFetchResourceEvent,
        success: false,
        error: createCwaResourceError(error)
      })
    }

    const doRedirect = this.fetchStatusManager.primaryFetchPath === path &&
      getResourceTypeFromIri(path) === CwaResourceTypes.ROUTE &&
      resource?.redirectPath

    if (doRedirect) {
      this.fetchStatusManager.abortFetch(startFetchResult.token)
    } else if (!shallowFetch && resource) {
      await this.fetchNestedResources({ resource, token: startFetchResult.token, noSave: !!noSave })
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
      const result = this.fetch({
        path: event.manifestPath
      })
      const response = await result.response
      resources = response._data?.resource_iris || []
      if (resources.length && this.fetchStatusManager.isCurrentFetchingToken(event.token)) {
        // need to await otherwise we were getting resource responses from the API in different orders on fast page changes and then the original old request could finish after the new one and result in an error message, not saved as token is no longer current
        await this.fetchBatch({ paths: resources, token: event.token })
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

  private fetchNestedResources ({ resource, token, noSave }: FetchNestedResourcesEvent): undefined|Promise<(CwaResource|undefined)[]> {
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
    return this.fetchBatch({ paths: nestedIris, token, noSave })
  }

  private fetchBatch ({ paths, token, noSave }: FetchBatchEvent): Promise<(CwaResource|undefined)[]> {
    const promises = []
    for (const path of paths) {
      const pathPromise: Promise<(CwaResource|undefined)> = new Promise((resolve) => {
        this.fetchResource({ path, token, noSave })
          .then((resource: CwaResource|undefined) => {
            resolve(resource)
          })
          .catch(() => {
            resolve(undefined)
          })
      })
      promises.push(pathPromise)
    }
    return Promise.all(promises)
  }

  private fetch (event: FetchEvent): CwaFetchResponseRaw {
    const url = this.appendQueryToPath(event.path)
    const headers = this.createRequestHeaders(event)
    const response = this.cwaFetch.fetch.raw<any>(url, {
      headers
    })
    return {
      response,
      headers
    }
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

  private createRequestHeaders (event: FetchEvent): Record<string, string> {
    let preload = event.preload
    if (!preload) {
      const resourceType = getResourceTypeFromIri(event.path)
      if (resourceType) {
        preload = preloadHeaders[resourceType]
      }
    }
    const requestHeaders: Record<string, string> = {}
    if (this.fetchStatusManager.primaryFetchPath) {
      requestHeaders.path = this.fetchStatusManager.primaryFetchPath
    }
    if (preload) {
      requestHeaders.preload = preload.join(',')
    }
    return requestHeaders
  }

  private get resourcesStore () {
    return this.resourcesStoreDefinition.useStore()
  }
}
