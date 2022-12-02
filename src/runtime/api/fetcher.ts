import { FetchContext, FetchError, FetchResponse } from 'ohmyfetch'
import { AsyncData, useFetch, useRoute } from '#app'
import { CwaResourcesInterface, ResourcesStore } from '../storage/stores/resources/resources-store'
import Mercure from './mercure'
import FetchStatus from './fetch-status'
import ApiDocumentation from './api-documentation'

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
    if (!this.fetchStatus.startFetch(path)) {
      return
    }
    const { data } = await this.doFetch(`/_/routes/${path}`, [
      '/page/layout/componentGroups/*/componentPositions/*/component',
      '/page/componentGroups/*/componentPositions/*/component',
      '/pageData/page/layout/componentGroups/*/componentPositions/*/component',
      '/pageData/page/componentGroups/*/componentPositions/*/component'
    ])

    this.fetchStatus.loadedPageIri = null
    this.fetchStatus.finishFetch({ endpoint: data.value.redirectPath || path, success: false })
  }

  /**
   * Public interfaces for fetching
   */
  public fetchPage (pageIri: string) {
    if (!this.fetchStatus.startFetch(pageIri)) {
      return
    }
    this.fetchStatus.loadedPageIri = pageIri
    this.fetchStatus.finishFetch({ endpoint: pageIri, success: false })
  }

  public fetchPageData (pageDataIri: string) {
    if (!this.fetchStatus.startFetch(pageDataIri)) {
      return
    }
    this.fetchStatus.loadedPageIri = pageDataIri
    this.fetchStatus.finishFetch({ endpoint: pageDataIri, success: false })
  }

  public fetchResource (endpoint: string) {
    if (!this.fetchStatus.startFetch(endpoint)) {
      return
    }
    this.fetchStatus.finishFetch({ endpoint, success: false })
  }

  /**
   * Internal: fetching
   */
  private fetchBatch ({ endpoints }: { endpoints: Array<string> }): void {}

  private fetchComponent (endpoint: string) {}

  private doFetch (endpoint: string, preload?: Array<string>): AsyncData<any, FetchError<any> | null> {
    // pass front-end query parameters to back-end as well
    const finalUrl = this.appendQueryToPath(endpoint)

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
      const fetchPromise = useFetch<any>(finalUrl, {
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
}
