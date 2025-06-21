import type { RouteLocationNormalizedLoaded, Router } from 'vue-router'
import type { FetchResponse } from 'ofetch'
import {
  CwaResourceTypes,
  getResourceTypeFromIri, ResourceTypeFromIri,
  resourceTypeToNestedResourceProperties,
} from '../../resources/resource-utils'
import type {
  CwaResource,
} from '../../resources/resource-utils'
import { FinishFetchManifestType } from '../../storage/stores/fetcher/actions'
import { createCwaResourceError } from '../../errors/cwa-resource-error'
import type { ResourcesStore } from '../../storage/stores/resources/resources-store'
import type CwaFetch from './cwa-fetch'
import type FetchStatusManager from './fetch-status-manager'
import preloadHeaders from './preload-headers'

export interface FetchResourceEvent {
  path: string
  token?: string
  manifestPath?: string
  preload?: string[]
  shallowFetch?: boolean | 'noexist'
  noSave?: boolean
  isPrimary?: boolean
  iri?: string
}

export interface FetchManifestEvent {
  manifestPath: string
  token: string
}

export interface FetchEvent {
  path: string
  noQuery?: boolean
  preload?: string[]
}

export interface CwaFetchRequestHeaders {
  path?: string
  preload?: string
}

export type CwaFetchResponse = FetchResponse<CwaResource | undefined>

export interface CwaFetchResponseRaw {
  response: Promise<CwaFetchResponse>
  headers: CwaFetchRequestHeaders
}

interface FetchBatchEvent {
  paths: string[]
  token?: string
  noSave?: boolean
  shallowFetch?: boolean | 'noexist'
}

interface FetchNestedResourcesEvent {
  resource: CwaResource
  token: string
  noSave: boolean
  onlyIfNoExist?: boolean
}

export default class Fetcher {
  constructor(
    private readonly cwaFetch: CwaFetch,
    private fetchStatusManager: FetchStatusManager,
    private router: Router,
    private resourcesStoreDefinition: ResourcesStore,
  ) {
  }

  public async fetchRoute(route: RouteLocationNormalizedLoaded): Promise<CwaResource | undefined> {
    if (route.meta.cwa?.disabled === true) {
      this.fetchStatusManager.clearPrimaryFetch()
      return
    }
    let iri: string
    let manifestPath: string | undefined
    const routeParam = route.params.cwaPage0
    // todo: test that we can get the iri from the route
    iri = Array.isArray(routeParam) ? '/' + routeParam.join('/') : routeParam

    const resourceType = iri ? getResourceTypeFromIri(iri) : undefined

    if (!resourceType || ![CwaResourceTypes.PAGE, CwaResourceTypes.PAGE_DATA].includes(resourceType)) {
      const prefix = ResourceTypeFromIri.getPathPrefix() || ''
      iri = `${prefix}/_/routes/${route.path}`
      manifestPath = `${prefix}/_/routes_manifest/${route.path}`
    }

    return await this.fetchResource({
      path: iri,
      isPrimary: true,
      manifestPath,
    })
  }

  public async fetchResource({ path, token, manifestPath, preload, shallowFetch, noSave, isPrimary, iri: userProvidedIri }: FetchResourceEvent): Promise<CwaResource | undefined> {
    const iri = userProvidedIri || path.split('?')[0]
    const startFetchResult = this.fetchStatusManager.startFetch({
      path,
      token,
      isPrimary,
      manifestPath,
    })

    if (!startFetchResult.continue) {
      return this.fetchStatusManager.getFetchedCurrentResource(path)
    }

    if (manifestPath) {
      this.fetchManifest({ token: startFetchResult.token, manifestPath }).then(() => {})
    }

    const fetchEvent = {
      path,
      preload,
    }

    const continueToFetchResource = this.fetchStatusManager.startFetchResource({
      resource: iri,
      token: startFetchResult.token,
      path: path,
      headers: this.createRequestHeaders(fetchEvent),
    })

    if (!continueToFetchResource) {
      return this.fetchStatusManager.getFetchedCurrentResource(path)
    }

    const finishFetchResourceEvent = {
      resource: iri,
      userProvidedIri,
      token: startFetchResult.token,
    }
    let cwaFetchRaw: CwaFetchResponseRaw
    let resource: CwaResource | undefined
    try {
      cwaFetchRaw = this.fetch(fetchEvent)
      const fetchResponse = await cwaFetchRaw.response
      resource = this.fetchStatusManager.finishFetchResource({
        ...finishFetchResourceEvent,
        success: true,
        fetchResponse,
        headers: cwaFetchRaw.headers,
        noSave,
        path: path,
      })
    }
    catch (error: any) {
      this.fetchStatusManager.finishFetchResource({
        ...finishFetchResourceEvent,
        success: false,
        error: createCwaResourceError(error),
        path: path,
      })
    }

    const doRedirect = this.fetchStatusManager.primaryFetchPath === path
      && getResourceTypeFromIri(iri) === CwaResourceTypes.ROUTE
      && resource?.redirectPath

    if (doRedirect) {
      this.fetchStatusManager.abortFetch(startFetchResult.token)
    }
    else if (resource && shallowFetch !== true) {
      await this.fetchNestedResources({ resource, token: startFetchResult.token, noSave: !!noSave, onlyIfNoExist: shallowFetch === 'noexist' })
    }

    if (!token) {
      await this.fetchStatusManager.finishFetch({
        token: startFetchResult.token,
      })
    }
    return resource
  }

  private async fetchManifest(event: FetchManifestEvent): Promise<void> {
    let resources: string[] = []
    try {
      const result = this.fetch({
        path: event.manifestPath,
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
        resources,
      })
    }
    catch (error: any) {
      this.fetchStatusManager.finishManifestFetch({
        type: FinishFetchManifestType.ERROR,
        token: event.token,
        error: createCwaResourceError(error),
      })
    }
  }

  private fetchNestedResources({ resource, token, noSave, onlyIfNoExist }: FetchNestedResourcesEvent): undefined | Promise<(CwaResource | undefined)[]> {
    const iri = resource['@id']
    const type = getResourceTypeFromIri(iri)
    if (!type) {
      return
    }
    let nestedIris = []
    const nestedPropertiesToFetch = resourceTypeToNestedResourceProperties[type]
    for (const prop of nestedPropertiesToFetch) {
      let propIris = resource[prop]
      if (!propIris) {
        continue
      }
      if (Array.isArray(propIris)) {
        nestedIris.push(...propIris)
      }
      else {
        // todo test - otherwise client-side auth will get the draft instead
        if (prop === 'publishedResource') {
          propIris += '?published=true'
        }
        nestedIris.push(propIris)
      }
    }

    if (onlyIfNoExist) {
      nestedIris = nestedIris.filter(iri => !this.resourcesStore.current.currentIds.includes(iri))
      if (!nestedIris.length) {
        return
      }
    }

    return this.fetchBatch({ paths: nestedIris, token, noSave })
  }

  public fetchBatch({ paths, token, noSave, shallowFetch }: FetchBatchEvent): Promise<(CwaResource | undefined)[]> {
    const promises = []
    for (const path of paths) {
      const pathPromise: Promise<(CwaResource | undefined)> = new Promise((resolve) => {
        this.fetchResource({ path, token, noSave, shallowFetch })
          .then((resource: CwaResource | undefined) => {
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

  public fetch(event: FetchEvent): CwaFetchResponseRaw {
    const url = event.noQuery ? event.path : this.appendQueryToPath(event.path)
    const headers = this.createRequestHeaders(event)
    const response = this.cwaFetch.fetch.raw<any>(url, {
      headers,
    })
    return {
      response,
      headers,
    }
  }

  private appendQueryToPath(path: string): string {
    const queryObj = this.router.currentRoute.value?.query
    if (!queryObj) {
      return path
    }
    const queryKeys = Object.keys(queryObj)
    if (!queryKeys.length) {
      return path
    }

    const queryString = queryKeys
      .reduce((accumulator, key) => {
        if (key.endsWith('[]') && Array.isArray(queryObj[key])) {
          for (const arrValue of queryObj[key]) {
            accumulator.push(key + '=' + arrValue)
          }
        }
        else {
          accumulator.push(key + '=' + queryObj[key])
        }
        return accumulator
      }, [] as string[])
      .join('&')
    const delimiter = path.includes('?') ? '&' : '?'
    return `${path}${delimiter}${queryString}`
  }

  private createRequestHeaders(event: FetchEvent): Record<string, string> {
    let preload = event.preload
    if (!preload) {
      const resourceType = getResourceTypeFromIri(event.path)
      if (resourceType) {
        preload = preloadHeaders[resourceType]
      }
    }
    const requestHeaders: Record<string, string> = {}
    if (this.fetchStatusManager.primaryFetchPath) {
      // todo: test we replace the /_/routes prefix
      const prefix = ResourceTypeFromIri.getPathPrefix() || ''
      const routePathPrefix = `${prefix}/_/routes/`
      const primaryFetchPath = this.fetchStatusManager.primaryFetchPath
      if (primaryFetchPath.indexOf(routePathPrefix) === 0) {
        requestHeaders.path = primaryFetchPath.substring(routePathPrefix.length)
      }
      else {
        requestHeaders.path = primaryFetchPath
      }
    }
    if (preload) {
      requestHeaders.preload = preload.join(',')
    }
    return requestHeaders
  }

  private get resourcesStore() {
    return this.resourcesStoreDefinition.useStore()
  }
}
