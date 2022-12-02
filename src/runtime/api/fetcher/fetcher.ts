import bluebird from 'bluebird'
import { $fetch, FetchContext, FetchError, FetchResponse } from 'ohmyfetch'
import { Ref } from 'vue'
import { RouteLocationNormalizedLoaded } from 'vue-router'
import { CwaResourcesInterface, ResourcesStore } from '../../storage/stores/resources/resources-store'
import { CwaResource, CwaResourceTypes, getResourceTypeFromIri } from '../../resource-types'
import Mercure from '../mercure'
import ApiDocumentation from '../api-documentation'
import FetchStatus from './fetch-status'
import preloadHeaders from './preload-headers'

interface FetchEventInterface {
  path: string
  preload?: Array<string>
}

type TypeToNestedPropertiesMap = {
  [T in CwaResourceTypes]: Array<string>;
}

export const resourceTypeToNestedResourceProperties: TypeToNestedPropertiesMap = {
  [CwaResourceTypes.ROUTE]: ['pageData', 'page'],
  [CwaResourceTypes.PAGE]: ['layout', 'componentGroups'],
  [CwaResourceTypes.PAGE_DATA]: ['page'],
  [CwaResourceTypes.LAYOUT]: ['componentGroups'],
  [CwaResourceTypes.COMPONENT_GROUP]: ['componentPositions'],
  [CwaResourceTypes.COMPONENT_POSITION]: ['component'],
  [CwaResourceTypes.COMPONENT]: ['componentGroups']
}

export interface CwaFetcherAsyncResponse extends Promise<FetchResponse<any>> {}

export class Fetcher {
  private readonly apiUrl: string
  private readonly mercure: Mercure
  private apiDocumentation: ApiDocumentation
  private readonly resourcesStoreDefinition: ResourcesStore
  private fetchStatus: FetchStatus
  private currentRoute: RouteLocationNormalizedLoaded

  constructor (apiUrl: string, resourcesStore: ResourcesStore, currentRoute: RouteLocationNormalizedLoaded) {
    this.apiUrl = apiUrl
    this.mercure = new Mercure()
    this.apiDocumentation = new ApiDocumentation()
    this.resourcesStoreDefinition = resourcesStore
    this.fetchStatus = new FetchStatus(this.resourcesStoreDefinition)
    this.currentRoute = currentRoute
  }

  /**
   * Public interfaces for fetching
   */

  public async fetchRoute (path: string): Promise<CwaResource|undefined> {
    const currentFetchPromise = this.fetchStatus.startFetch(path)
    if (currentFetchPromise) {
      return
    }

    // we do not need to wait for this, it will fetch everything from the manifest while we traverse the fetches
    // thereby not relying on this manifest to resolve everything, but an enhancement to fetch everything we can in a batch
    this.fetchRoutesManifest(path)

    let data: CwaResource|undefined
    try {
      const response = await this.fetchAndSaveResource({
        path: `/_/routes/${path}`
      })
      if (!response) {
        return
      }
      data = response._data
      return data
    } finally {
      this.fetchStatus.finishFetch({
        endpoint: data?.redirectPath || path,
        success: false,
        pageIri: data?.pageData || data?.page
      })
    }
  }

  private async fetchRoutesManifest (path: string) {
    let response: FetchResponse<any>|undefined
    try {
      response = await this.doFetch({ path: `/_/routes_manifest/${path}` })
      if (!response) {
        return
      }
      const manifestResources = response._data.resource_iris
      await this.fetchBatch({ paths: manifestResources })
    } catch (error) {
      // noop
    }
  }

  public async fetchPage (pageIri: string): Promise<Ref|undefined> {
    const currentFetchPromise = this.fetchStatus.startFetch(pageIri)
    if (currentFetchPromise) {
      return
    }

    try {
      const response = await this.fetchAndSaveResource({
        path: pageIri
      })
      if (!response) {
        return
      }
      return response._data
    } finally {
      this.fetchStatus.finishFetch({
        endpoint: pageIri,
        success: false,
        pageIri
      })
    }

    this.fetchStatus.finishFetch({ endpoint: pageIri, success: false, pageIri })
  }

  public async fetchAndSaveResource ({ path, preload }: FetchEventInterface): Promise<CwaFetcherAsyncResponse|undefined> {
    const currentFetchPromise = this.fetchStatus.startFetch(path)
    if (currentFetchPromise) {
      return currentFetchPromise
    }
    if (!preload) {
      preload = this.getPreloadHeadersForPath(path)
    }

    let response: FetchResponse<any>|undefined
    try {
      response = await this.doFetch({ path, preload })
    } catch (error) {
      if (error instanceof FetchError) {
        // 404 can be expected, components which are draft some users may not have access to, we can ignore 404s
        if (error.statusCode === 404) {
          return
        }
        console.error(error.statusCode, error.statusMessage)
      }
      throw error
    }

    if (response?._data) {
      this.resourcesStore.saveResource({
        resource: response._data
      })
      await this.fetchNestedResources(response._data)
    }

    this.fetchStatus.finishFetch({ endpoint: path, success: false })
    return response
  }

  /**
   * Internal: fetching
   */
  private fetchBatch ({ paths }: { paths: Array<string> }): bluebird<(CwaFetcherAsyncResponse|undefined)[]> {
    return bluebird
      .map(
        paths,
        (path: string) => {
          return this.fetchAndSaveResource({ path })
        },
        { concurrency: 10 || null }
      )
  }

  private fetchNestedResources (resource: any): bluebird<(CwaFetcherAsyncResponse|undefined)[]>|undefined {
    // check resource type
    const type = getResourceTypeFromIri(resource['@id'])
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
    return this.fetchBatch({ paths: nestedIris })
  }

  private doFetch ({ path, preload }: FetchEventInterface): CwaFetcherAsyncResponse|undefined {
    // pass front-end query parameters to back-end as well
    const finalUrl = this.appendQueryToPath(path)

    // check if this endpoint is already being called in the current request batch
    const existingFetch = this.fetchStatus.getFetchingEndpointPromise(finalUrl)
    if (existingFetch) {
      return existingFetch
    }

    // Apply common required headers
    const requestHeaders = {
      path: this.fetchStatus.path,
      accept: 'application/ld+json,application/json'
    } as { path: string; accept: string; preload?: string }
    // Preload headers for Vulcain prefetching support
    if (preload) {
      requestHeaders.preload = preload.join(',')
    }

    // Fetch the endpoint
    const fetchPromise: CwaFetcherAsyncResponse = $fetch.raw<any>(finalUrl, {
      baseURL: this.apiUrl,
      onResponse: (context: FetchContext & { response: FetchResponse<CwaResource> }): Promise<void> | void => {
        const linkHeader = context.response.headers.get('link')
        if (linkHeader) {
          this.mercure.setMercureHubFromLinkHeader(linkHeader)
          this.apiDocumentation.setDocsPathFromLinkHeader(linkHeader)
        }
        return context.response._data
      }
    })
    this.fetchStatus.addEndpoint(finalUrl, fetchPromise)
    return fetchPromise
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

  /**
   * Internal: getters
   */
  private get resourcesStore (): CwaResourcesInterface {
    return this.resourcesStoreDefinition.useStore()
  }

  private getPreloadHeadersForPath (path: string): Array<string>|undefined {
    const resourceType = getResourceTypeFromIri(path)
    if (!resourceType) {
      return
    }
    return preloadHeaders[resourceType]
  }
}
