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
import { getResourceTypeFromIri, CwaResource, CwaResourceTypes, isCwaResource } from '../../resources/resource-utils'
import InvalidResourceResponse from '../../errors/invalid-resource-response'
import FetchStatus, { FinishFetchEvent, StartFetchEvent, StartFetchResponse } from './fetch-status'
import preloadHeaders from './preload-headers'

interface FetchEventInterface {
  path: string
  preload?: Array<string>
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

export interface CwaFetcherAsyncResponse extends Promise<FetchResponse<CwaResource|any>> {}

type StartResourceFetchEvent = StartFetchEvent & { manifestPath?: string }
type FinishResourceFetchEvent = FinishFetchEvent & { fetchError?: FetchError, path: string }

// Todo: How to handle fetching a new page when the previous is still being loaded
// Todo: how to handle errors produced when fetching. The first primary request should have first class status. All should be put into store

export default class Fetcher {
  private readonly apiUrl: string
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
    this.resourcesStoreDefinition = resourcesStore
    this.currentRoute = currentRoute
    this.mercure = mercure
    this.apiDocumentation = apiDocumentation
    this.fetchStatus = new FetchStatus(fetcherStore)
  }

  /**
   * PRIMARY FETCHER INTERFACE
   */
  public async fetchAndSaveResource (fetchEvent: FetchEventInterface): Promise<CwaResource|undefined> {
    const startFetchStatusResponse = this.startResourceFetch({ path: fetchEvent.path })
    if (!startFetchStatusResponse.continueFetching) {
      const currentPromise = startFetchStatusResponse.startFetchToken.existingFetchPromise
      if (currentPromise) {
        return this.fetchAndValidateCwaResource(currentPromise)
      }
    }

    let resource: CwaResource|undefined
    try {
      const fetchPromise = this.doFetch(fetchEvent)
      resource = await this.fetchAndValidateCwaResource(fetchPromise)
    } catch (error) {
    }

    if (resource) {
      this.resourcesStore.saveResource({
        resource
      })
      try {
        await this.fetchNestedResources(resource)
      } catch (fetchNestedResourcesError) {}
    }

    const finishFetchEvent: FinishResourceFetchEvent = {
      token: startFetchStatusResponse.startFetchToken.token,
      path: startFetchStatusResponse.startFetchToken.startEvent.path,
      fetchSuccess: !!resource
    }
    await this.finishResourceFetch(finishFetchEvent)
    return resource
  }

  /**
   * Public interfaces for fetching for route middleware
   */
  public async fetchRoute (path: string): Promise<CwaFetcherAsyncResponse|undefined> {
    const iri = `/_/routes/${path}`
    const startFetchStatusResponse = this.startResourceFetch({ path: iri, resetCurrentResources: true, manifestPath: `/_/routes_manifest/${path}` })
    if (!startFetchStatusResponse.continueFetching) {
      return startFetchStatusResponse.startFetchToken.existingFetchPromise
    }

    let routeResource: CwaResource|undefined
    try {
      const fetchAndSaveResponse: CwaResource|undefined = await this.fetchAndSaveResource({ path: iri })
      if (fetchAndSaveResponse) {
        routeResource = fetchAndSaveResponse
      }
    } catch (err) {}

    // todo: do we need to handle if it was a red irect from prop data?.redirectPath
    await this.finishResourceFetch({
      token: startFetchStatusResponse.startFetchToken.token,
      path: startFetchStatusResponse.startFetchToken.startEvent.path,
      fetchSuccess: routeResource !== undefined,
      pageIri: routeResource?.pageData || routeResource?.page
    })
  }

  // public async fetchPage (pageIri: string): Promise<CwaFetcherAsyncResponse|undefined> {
  //   const startFetch = this.startFetch({ path: pageIri, resetCurrentResources: true })
  //   if (!startFetch) {
  //     return startFetch
  //   }
  //
  //   let data: CwaResource|undefined
  //   try {
  //     const response = await this.fetchAndSaveResource({
  //       path: pageIri
  //     })
  //     if (!response) {
  //       return
  //     }
  //     data = response._data
  //     return response
  //   } finally {
  //     this.finishFetch({
  //       path: pageIri,
  //       fetchSuccess: data !== undefined,
  //       pageIri
  //     })
  //   }
  // }

  /**
   * Internal
   */

  private async fetchAndValidateCwaResource (fetchPromise: CwaFetcherAsyncResponse): Promise<CwaResource|undefined> {
    const response = await fetchPromise
    const responseData = response._data
    const isValidResponse = isCwaResource(responseData)
    if (!isValidResponse) {
      throw new InvalidResourceResponse('The response provided by the API was not a valid CWA Resource', responseData)
    }
    return responseData
  }

  private startResourceFetch (event: StartResourceFetchEvent): StartFetchResponse {
    const startFetchEvent: StartFetchEvent = {
      path: event.path,
      resetCurrentResources: event.resetCurrentResources
    }
    const startFetchStatusResponse = this.fetchStatus.startFetch(startFetchEvent)

    if (!startFetchStatusResponse.continueFetching) {
      this.mercure.init()
      return startFetchStatusResponse
    }

    this.resourcesStore.setResourceFetchStatus({ iri: event.path, status: 0 })
    if (event.manifestPath) {
      const doManifestFetch = this.fetchStatus.setFetchManifestStatus({
        path: event.manifestPath,
        inProgress: true
      })
      if (doManifestFetch) {
        this.fetchManifest(event.manifestPath).then(this.outputManifestResultsToConsole)
      }
    }
    return startFetchStatusResponse
  }

  private async finishResourceFetch (event: FinishResourceFetchEvent) {
    // finish the status in resources storage
    if (event.fetchSuccess) {
      this.resourcesStore.setResourceFetchStatus({ iri: event.path, status: 1 })
    } else {
      this.resourcesStore.setResourceFetchError({ iri: event.path, fetchError: event.fetchError })
    }

    const finishedAllFetches = await this.fetchStatus.finishFetch({
      token: event.token,
      pageIri: event.pageIri,
      fetchSuccess: event.fetchSuccess
    })

    // finish status in the fetcher
    if (finishedAllFetches) {
      // event source may have died, re-initialise - true if it is a final fetch
      this.mercure.init()
    }

    // handle fetch errors whether we are getting a resource or manifest
    if (event.fetchError) {
      this.handleFetchError(event.fetchError)
    }
  }

  private outputManifestResultsToConsole (manifestResources: string[]|undefined) {
    if (!manifestResources) {
      consola.warn('Unable to fetch manifest resources')
      return
    }
    if (!manifestResources.length) {
      consola.info('Manifest fetch did not return any resources')
      return
    }
    consola.success(`Manifest fetched ${manifestResources.length} resources`)
  }

  private handleFetchError (error: FetchError) {
    // 404 can be expected, components which are draft some users may not have access to, we can ignore 404s
    if (error.statusCode === 404) {
      return
    }
    // network request error
    if (!error.response) {
      consola.error('[NETWORK ERROR]')
    }
    consola.error(error.message)
  }

  private async fetchManifest (path: string): Promise<Array<string>|undefined> {
    let response: FetchResponse<any>|undefined
    let fetchError: FetchError|undefined
    let manifestResources: Array<string>|undefined
    try {
      response = await this.doFetch({ path })
      manifestResources = response?._data?.resource_iris
      if (manifestResources) {
        await this.fetchBatch({ paths: manifestResources })
      }
    } catch (error) {
      if (error instanceof FetchError) {
        fetchError = error
      }
    } finally {
      this.fetchStatus.setFetchManifestStatus({
        path,
        inProgress: false,
        fetchError
      })
    }
    return manifestResources
  }

  private fetchNestedResources (resource: CwaResource): bluebird<(CwaResource|undefined)[]>|undefined {
    // check resource type
    const iri = resource['@id']
    consola.trace(`fetchNestedResources for ${iri}`)
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
    return this.fetchBatch({ paths: nestedIris })
  }

  private fetchBatch ({ paths }: { paths: Array<string> }): bluebird<(CwaResource|undefined)[]> {
    // bluebird seems to resolve server-side earlier
    return bluebird
      .map(
        paths,
        (path: string) => {
          return this.fetchAndSaveResource({ path })
        },
        {
          concurrency: 10000
        }
      )
  }

  /**
   * API fetching functions
   */
  private doFetch (event: FetchEventInterface): CwaFetcherAsyncResponse {
    // Fetch the endpoint
    const fetchPromise = this.createFetchPromise(event)
    this.fetchStatus.addPath(event.path, fetchPromise)
    return fetchPromise
  }

  private createFetchPromise (event: FetchEventInterface): CwaFetcherAsyncResponse {
    const url = this.appendQueryToPath(event.path)
    const baseURL = this.apiUrl
    const headers = this.createRequestHeaders(event)

    const onResponse = (context: FetchContext & { response: FetchResponse<any> }): Promise<void> | void => {
      const linkHeader = context.response.headers.get('link')
      if (linkHeader) {
        this.mercure.setMercureHubFromLinkHeader(linkHeader)
        this.apiDocumentation.setDocsPathFromLinkHeader(linkHeader)
      }
      return context.response._data
    }

    const onRequestError = (ctx: FetchContext & { error: Error }): Promise<void> | void => {
      throw createFetchError<undefined>(ctx.request, ctx.error)
    }

    return $fetch.raw<any>(url, {
      baseURL,
      headers,
      onResponse,
      onRequestError
    })
  }

  private createRequestHeaders (event: FetchEventInterface): { path: string; accept: string; preload?: string } {
    if (!this.fetchStatus.path) {
      throw new Error('Cannot create a new request to the API before setting the fetch status path.')
    }
    let preload = event.preload
    if (!preload) {
      const resourceType = getResourceTypeFromIri(event.path)
      if (resourceType) {
        preload = preloadHeaders[resourceType]
      }
    }
    return {
      path: this.fetchStatus.path,
      accept: 'application/ld+json,application/json',
      preload: preload ? preload.join(',') : undefined
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

  /**
   * Internal: getters
   */
  private get resourcesStore (): CwaResourcesStoreInterface {
    return this.resourcesStoreDefinition.useStore()
  }
}
