import bluebird from 'bluebird'
import { FetchContext, FetchError, FetchResponse } from 'ohmyfetch'
import { AsyncData, useFetch, useRoute } from '#app'
import { Ref } from 'vue'
import { CwaResourcesInterface, ResourcesStore } from '../storage/stores/resources/resources-store'
import { CwaResourceTypes, resourceTypeToIriPrefix } from '../resource-types'
import Mercure from './mercure'
import FetchStatus from './fetch-status'
import ApiDocumentation from './api-documentation'
import preloadHeaders from '@cwa/nuxt-module/runtime/api/preload-headers'

interface FetchEventInterface {
  path: string
  preload?: Array<string>
}

type TypeToNestedPropertiesMap = {
  [T in CwaResourceTypes]: Array<string>;
}

export const resourceTypeToNestedResourceProperties: TypeToNestedPropertiesMap = {
  [CwaResourceTypes.ROUTE]: ['pageData', 'page'],
  [CwaResourceTypes.PAGE]: ['layout'],
  [CwaResourceTypes.PAGE_DATA]: ['page'],
  [CwaResourceTypes.LAYOUT]: ['componentGroups'],
  [CwaResourceTypes.COMPONENT_GROUP]: ['componentPositions'],
  [CwaResourceTypes.COMPONENT_POSITION]: ['component'],
  [CwaResourceTypes.COMPONENT]: ['componentGroups']
}

export interface CwaFetcherAsyncResponse extends AsyncData<any, FetchError<any> | null> {}

export class Fetcher {
  private readonly apiUrl: string
  private readonly mercure: Mercure
  private apiDocumentation: ApiDocumentation
  private readonly resourcesStoreDefinition: ResourcesStore
  private fetchStatus: FetchStatus

  constructor (apiUrl: string, resourcesStore: ResourcesStore) {
    this.apiUrl = apiUrl
    this.mercure = new Mercure()
    this.apiDocumentation = new ApiDocumentation()
    this.resourcesStoreDefinition = resourcesStore
    this.fetchStatus = new FetchStatus(this.resourcesStoreDefinition)
  }

  public async fetchRoute (path: string) {
    const currentFetchPromise = this.fetchStatus.startFetch(path)
    if (currentFetchPromise) {
      return
    }

    let routeResponse: Ref|undefined
    let pageResponse: Ref|undefined

    try {
      ({ data: routeResponse } = await this.fetchAndSaveResource({
        path: `/_/routes/${path}`
      }))

      if (!routeResponse.value) {
        return
      }
    } finally {
      this.fetchStatus.finishFetch({
        endpoint: routeResponse?.value.redirectPath || path,
        success: false,
        pageIri: routeResponse?.value.pageData || pageResponse?.value['@id']
      })
    }
  }

  /**
   * Public interfaces for fetching
   */
  public fetchPage (pageIri: string) {
    const currentFetchPromise = this.fetchStatus.startFetch(pageIri)
    if (currentFetchPromise) {
      return
    }

    // do load

    this.fetchStatus.finishFetch({ endpoint: pageIri, success: false, pageIri })
  }

  public fetchPageData (pageDataIri: string) {
    const currentFetchPromise = this.fetchStatus.startFetch(pageDataIri)
    if (currentFetchPromise) {
      return
    }

    // do load

    this.fetchStatus.finishFetch({ endpoint: pageDataIri, success: false, pageIri: pageDataIri })
  }

  public async fetchAndSaveResource ({ path, preload }: FetchEventInterface): Promise<CwaFetcherAsyncResponse> {
    const currentFetchPromise = this.fetchStatus.startFetch(path)
    if (currentFetchPromise) {
      return currentFetchPromise
    }
    if (!preload) {
      preload = this.getPreloadHeadersForPath(path)
    }

    const response = await this.doFetch({ path, preload })

    console.log('SAVE RESOURCE', response.data.value)

    this.fetchNestedResources(response.data.value)

    this.fetchStatus.finishFetch({ endpoint: path, success: false })
    return response
  }

  /**
   * Internal: fetching
   */
  private fetchBatch ({ paths }: { paths: Array<string> }): void {
    return bluebird
      .map(
        paths,
        (path: string) => {
          return this.fetchAndSaveResource({ path })
        },
        { concurrency: 10 || null }
      )
  }

  private fetchNestedResources (resource: any) {
    // check resource type
    const type = this.getResourceTypeFromIri(resource['@id'])
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
    this.fetchBatch({ paths: nestedIris })
  }

  private doFetch ({ path, preload }: FetchEventInterface): CwaFetcherAsyncResponse {
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
    try {
      const fetchPromise: CwaFetcherAsyncResponse = useFetch<any>(finalUrl, {
        baseURL: this.apiUrl,
        onResponse: (context: FetchContext & { response: FetchResponse<any> }): Promise<void> | void => {
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
    } catch (error) {
      if (error instanceof FetchError) {
        console.error(error.statusCode, error.statusMessage, error.statusText)
      }
      throw error
    }
  }

  private appendQueryToPath (path: string): string {
    const route = useRoute()
    const queryObj = route.query
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
    const resourceType = this.getResourceTypeFromIri(path)
    if (!resourceType) {
      return
    }
    return preloadHeaders[resourceType]
  }

  private getResourceTypeFromIri (iri: string): CwaResourceTypes|undefined {
    for (const type of Object.values(CwaResourceTypes)) {
      const prefix: string = resourceTypeToIriPrefix[type]
      if (iri.startsWith(prefix)) {
        return type
      }
    }
  }
}
