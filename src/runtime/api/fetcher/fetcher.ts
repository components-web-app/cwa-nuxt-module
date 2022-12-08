import bluebird from 'bluebird'
import { $fetch, createFetchError, FetchContext, FetchError, FetchResponse } from 'ohmyfetch'
import { RouteLocationNormalizedLoaded } from 'vue-router'
import consola from 'consola'
import {
  CwaResourcesStoreInterface,
  ResourcesStore
} from '../../storage/stores/resources/resources-store'
import Mercure from '../mercure'
import ApiDocumentation from '../api-documentation'
import { FetcherStore } from '../../storage/stores/fetcher/fetcher-store'
import { FinishFetchEvent } from '../../storage/stores/fetcher/actions'
import { getResourceTypeFromIri, CwaResource, CwaResourceTypes } from '../../resources/resource-utils'
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

export interface CwaFetcherAsyncResponse extends Promise<FetchResponse<CwaResource|any>> {}

export default class Fetcher {
  private readonly apiUrl: string
  private readonly fetcherStoreDefinition: FetcherStore
  private readonly resourcesStoreDefinition: ResourcesStore
  private readonly currentRoute: RouteLocationNormalizedLoaded
  public readonly mercure: Mercure
  public readonly apiDocumentation: ApiDocumentation
  private readonly fetchStatus: FetchStatus

  constructor (
    apiUrl: string,
    fetcherStore: FetcherStore,
    resourcesStore: ResourcesStore,
    currentRoute: RouteLocationNormalizedLoaded,
    mercure: Mercure,
    apiDocumentation: ApiDocumentation
  ) {
    this.apiUrl = apiUrl
    this.fetcherStoreDefinition = fetcherStore
    this.resourcesStoreDefinition = resourcesStore
    this.currentRoute = currentRoute
    this.mercure = mercure
    this.apiDocumentation = apiDocumentation
    this.fetchStatus = new FetchStatus(this.fetcherStoreDefinition)
  }

  /**
   * PRIMARY FETCHER INTERFACE
   */
  public async fetchAndSaveResource ({ path, preload }: FetchEventInterface): Promise<CwaFetcherAsyncResponse|undefined> {
    const startFetch = this.startFetch(path)
    if (startFetch !== true) {
      return startFetch
    }

    if (!preload) {
      preload = this.getPreloadHeadersForPath(path)
    }

    let response: FetchResponse<any>|undefined
    try {
      this.resourcesStore.setResourceFetchStatus({ iri: path, status: 0 })
      response = await this.doFetch({ path, preload })
      this.resourcesStore.setResourceFetchStatus({ iri: path, status: 1 })
    } catch (error) {
      if (error instanceof FetchError) {
        this.handleFetchError(path, error)
        return
      } else {
        this.resourcesStore.setResourceFetchStatus({ iri: path, status: -1 })
      }
      throw error
    }

    if (response?._data) {
      this.resourcesStore.saveResource({
        resource: response._data
      })
      await this.fetchNestedResources(response._data)
    }

    this.finishFetch({ path, fetchSuccess: !!response?._data })
    return response
  }

  private handleFetchError (path: string, error: FetchError) {
    this.resourcesStore.setResourceFetchError({ iri: path, fetchError: error })
    // 404 can be expected, components which are draft some users may not have access to, we can ignore 404s
    if (error.statusCode === 404) {
      return
    }
    // network request error
    if (!error.response) {
      consola.error('[NETWORK ERROR]')
    }
    consola.error(error.message, JSON.stringify(error))
  }

  /**
   * Public interfaces for fetching for route middleware
   */
  public async fetchRoute (path: string): Promise<CwaFetcherAsyncResponse|undefined> {
    const startFetch = this.startFetch(path)
    if (startFetch !== true) {
      return startFetch
    }

    // we do not need to wait for this, it will fetch everything from the manifest while we traverse the fetches
    // thereby not relying on this manifest to resolve everything, but an enhancement to fetch everything we can in a batch
    this.fetchRoutesManifest(path).then((endpoints) => {
      if (endpoints) {
        consola.success('Route manifest fetch complete')
        consola.trace(endpoints)
      } else {
        consola.warn('Route manifest fetch did not resolve any endpoints')
      }
    })

    let data: CwaResource|undefined
    try {
      const response = await this.fetchAndSaveResource({
        path: `/_/routes/${path}`
      })
      if (!response) {
        return
      }
      data = response._data
      return response
    } finally {
      // todo: do we need to handle if it was a redirect from prop data?.redirectPath
      this.finishFetch({
        path,
        fetchSuccess: data !== undefined,
        pageIri: data?.pageData || data?.page
      })
    }
  }

  public async fetchPage (pageIri: string): Promise<CwaFetcherAsyncResponse|undefined> {
    const startFetch = this.startFetch(pageIri)
    if (startFetch !== true) {
      return startFetch
    }

    let data: CwaResource|undefined
    try {
      const response = await this.fetchAndSaveResource({
        path: pageIri
      })
      if (!response) {
        return
      }
      data = response._data
      return response
    } finally {
      this.finishFetch({
        path: pageIri,
        fetchSuccess: data !== undefined,
        pageIri
      })
    }

    this.finishFetch({ path: pageIri, fetchSuccess: false, pageIri })
  }

  /**
   * Internal: fetching
   */
  private startFetch (path: string) {
    const startFetch = this.fetchStatus.startFetch(path)
    if (startFetch !== true) {
      // return the promise for this endpoint
      if (startFetch !== false) {
        return startFetch
      }
      // no promise to return, start fetch determined we should stop now
      this.mercure.init()
      return
    }
    return true
  }

  private finishFetch (event: FinishFetchEvent & { success: boolean }) {
    if (this.fetchStatus.finishFetch(event) && process.client) {
      // event source may have died, re-initialise
      this.mercure.init()
    }
  }

  private async fetchRoutesManifest (path: string): Promise<Array<string>|undefined> {
    let response: FetchResponse<any>|undefined
    try {
      response = await this.doFetch({ path: `/_/routes_manifest/${path}` })
      if (!response) {
        return
      }
      const manifestResources = response._data.resource_iris
      await this.fetchBatch({ paths: manifestResources })
      return manifestResources
    } catch (error) {
      // noop
    }
  }

  private fetchBatch ({ paths }: { paths: Array<string> }): bluebird<(CwaFetcherAsyncResponse|undefined)[]> {
    return bluebird
      .map(
        paths,
        (path: string) => {
          return this.fetchAndSaveResource({ path })
        },
        { concurrency: 500 }
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
    const existingFetch = this.fetchStatus.getFetchingPathPromise(finalUrl)
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
      },
      onRequestError (ctx: FetchContext & { error: Error }): Promise<void> | void {
        throw createFetchError<undefined>(ctx.request, ctx.error)
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
  private get resourcesStore (): CwaResourcesStoreInterface {
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
