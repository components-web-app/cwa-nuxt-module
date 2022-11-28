import bluebird from 'bluebird'
import consola from 'consola'
import type { NuxtAxiosInstance } from '@nuxtjs/axios'
import VueRouter from 'vue-router'
import { CancelTokenSource } from 'axios'
import AxiosErrorParser from '../utils/AxiosErrorParser'
import DebugTimer from '../utils/DebugTimer'
import ApiError from '../inc/api-error'
import Storage, { resourcesState } from './storage'
import { stateVars } from './storage/CwaVuexModule'

declare interface MercureMessage {
  event: MessageEvent
  data: any
}

export class Fetcher {
  // Holds the EventSource connection with Mercure
  private eventSource?: EventSource
  private lastEventId?: string
  private ctx: {
    $axios: NuxtAxiosInstance
    error: any
    apiUrl: string
    storage: Storage
    router: VueRouter
    redirect: Function
  }

  private options: {
    fetchConcurrency: number
  }

  public static readonly loadingEndpoint = 'loadingRoute'
  public static readonly loadedRoutePathKey = 'loadedRoute'
  public static readonly loadedPageKey = 'loadedPage'
  public static readonly isSSRKey = 'isSsrLoad'
  private timer: DebugTimer
  private mercureMessages: Array<MercureMessage> = []
  private fetchingCounter: number = 0
  private resourcesFetched: {
    [key: string]: Promise<any>
  } = {}

  private resourcesCacheEnabled: boolean = false

  constructor(
    { $axios, error, apiUrl, storage, router, redirect },
    { fetchConcurrency }
  ) {
    this.ctx = {
      $axios,
      error,
      apiUrl,
      storage,
      router,
      redirect
    }
    this.options = {
      fetchConcurrency
    }
    this.timer = new DebugTimer()
  }

  get loadedRoute() {
    return this.ctx.storage.getState(Fetcher.loadedRoutePathKey)
  }

  get loadedPage() {
    return this.ctx.storage.getState(Fetcher.loadedPageKey)
  }

  private get currentResources(): { [any: string]: resourcesState } {
    return this.ctx.storage.state.resources.current
  }

  public get apiUrl() {
    return this.ctx.apiUrl
  }

  public get currentRoutePath() {
    return (
      this.ctx.storage.getState(Fetcher.loadingEndpoint) ||
      this.ctx.storage.getState(Fetcher.loadedRoutePathKey)
    )
  }

  private async fetcher({
    path,
    preload,
    cancelTokenSource
  }: {
    path: string
    preload?: string[]
    cancelTokenSource?: CancelTokenSource
  }) {
    this.fetchingCounter++
    let url = path
    const queryObj = this.ctx.router.currentRoute.query
    let queryKeys
    if (queryObj && (queryKeys = Object.keys(queryObj)).length > 0) {
      const queryString = queryKeys
        .map((key) => key + '=' + queryObj[key])
        .join('&')
      const delimiter = url.includes('?') ? '&' : '?'
      url += `${delimiter}${queryString}`
    }
    consola.trace(`Fetching ${url}`)
    this.timer.start(`Fetching ${url}`)

    // For dynamic components the API must know what route/path the request was originally for
    // so we set a custom "Path" header
    const requestHeaders = {
      path: this.currentRoutePath
    } as { path: string; preload?: string }

    // preload headers for Vulcain
    if (preload) {
      requestHeaders.preload = preload.join(',')
    }

    try {
      const { headers, data } = await this.ctx.$axios.get(url, {
        headers: requestHeaders,
        cancelToken: cancelTokenSource ? cancelTokenSource.token : null
      })
      this.setDocsUrlFromHeaders(headers)
      this.setMercureHubFromHeaders(headers)
      return data
    } catch (error) {
      throw this.axiosToApiError(error)
    } finally {
      this.fetchingCounter--
      this.timer.end(`Fetching ${url}`)
      consola.debug(`Fetched ${url}`)
    }
  }

  public axiosToApiError(error) {
    const isCancel = this.ctx.$axios.isCancel(error)
    const sanitisedError = AxiosErrorParser(error)
    // for publishable components - when getting a collection the position and component id will exist.
    // SSR is not authorized to view, so it will return a 404. We know it exists as an ID is there
    // By not throwing an error we can re-fetch client-side
    // However, when fetching a route that does not exist, we need an error...
    // Changed this functionality here to throw an exception, so it can be handled by the calling function
    return new ApiError(
      sanitisedError.message,
      sanitisedError.statusCode,
      sanitisedError.endpoint,
      sanitisedError.violations || null,
      isCancel
    )
  }

  public async fetchResource(fetcherObj: {
    path: string
    preload?: string[]
    cancelTokenSource?: CancelTokenSource
  }) {
    this.timer.reset()

    const doFetch = async () => {
      const resource = await this.fetcher(fetcherObj)
      if (!resource) {
        return resource
      }

      // we could be returned a draft instead with a different IRI.
      // although a fix in the API means we shouldn't - component position
      // will return what we are authorized to see
      const iri = resource['@id']
      const category = this.ctx.storage.getCategoryFromIri(iri)
      this.ctx.storage.setResource({ resource, category })

      const currentResource = this.currentResources?.[category]?.byId?.[iri]
      if (!currentResource) {
        this.initMercure()
      }

      return resource
    }

    try {
      // we are fetching with full available auth
      if (!this.resourcesCacheEnabled) {
        return await doFetch()
      }
      if (!this.resourcesFetched[fetcherObj.path]) {
        this.resourcesFetched[fetcherObj.path] = doFetch()
      }
      return await this.resourcesFetched[fetcherObj.path]
    } catch (error) {
      // may be a draft component without a published version - only accessible to admin, therefore only available client-side
      // error instanceof ApiError &&  -- causes issue when deployed, does not detect as this type of error ... on server-side load
      // !process.client &&
      // manifest will serve draft resource iris currently as well... interesting, needs investigating
      if (error?.statusCode === 404) {
        return
      }
      throw error
    }
  }

  private fetchCollection(
    {
      paths,
      preload,
      category
    }: { paths: string[]; preload?: string[]; category?: string },
    callback
  ) {
    return bluebird
      .map(
        paths,
        (path) => {
          return this.fetcher({ path, preload }).then((resource) => ({
            resource,
            path
          }))
        },
        { concurrency: this.options.fetchConcurrency || null }
      )
      .each(({ resource }) => {
        resource &&
          this.ctx.storage.setResource({ category, isNew: false, resource })
        return callback(resource)
      })
  }

  private startFetch(endpoint) {
    // prevent reload on querystring change or if we are already loading
    this.resourcesFetched = {}
    this.resourcesCacheEnabled = true
    const currentLoading = this.ctx.storage.getState(Fetcher.loadingEndpoint)
    const currentlyLoaded = this.ctx.storage.getState(
      Fetcher.loadedRoutePathKey
    )
    if (currentlyLoaded === endpoint || currentLoading === endpoint) {
      return false
    }

    this.timer.reset()
    this.timer.start(`Start fetch ${endpoint}`)
    this.ctx.storage.resetCurrentResources()
    this.ctx.storage.setState(Fetcher.loadingEndpoint, endpoint)
    // this.closeMercure()

    return true
  }

  private async fetchNestedResources(
    layoutResponse,
    pageResponse,
    loadedRoutePath,
    routeResponse = null
  ) {
    this.ctx.storage.setState('layout', layoutResponse?.['@id'] || null)

    await this.fetchComponentGroups([
      ...pageResponse.componentGroups,
      ...layoutResponse.componentGroups
    ])
    this.ctx.storage.setState(Fetcher.loadedRoutePathKey, loadedRoutePath)
    this.ctx.storage.setState(Fetcher.loadingEndpoint, false)

    if (!routeResponse) {
      this.ctx.storage.setCurrentRoute(null)
    } else {
      this.ctx.storage.setCurrentRoute(routeResponse['@id'])
      // does not work server-side
      if (routeResponse.redirectPath) {
        this.ctx.redirect(308, { path: routeResponse.redirectPath })
      }
    }
  }

  private finallyFetch(endpoint) {
    this.resourcesFetched = {}
    this.resourcesCacheEnabled = false
    this.ctx.storage.setState(Fetcher.loadingEndpoint, false)
    this.initMercure()
    this.timer.end(`Fetch route ${endpoint}`)
    this.timer.print()
  }

  public async fetchPageData(pageDataIri) {
    if (!this.startFetch(pageDataIri)) {
      return
    }

    try {
      const pageDataResponse = await this.fetchResource({
        path: pageDataIri,
        preload: [
          '/page/layout/componentGroups/*/componentPositions/*/component',
          '/page/componentGroups/*/componentPositions/*/component'
        ]
      })
      this.ctx.storage.setState(Fetcher.loadedPageKey, pageDataIri)

      if (!pageDataResponse.page) {
        this.ctx.error('The page data resource does not have a page configured')
      }

      const pageResponse = await this.fetchResource({
        path: pageDataResponse.page,
        preload: [
          '/layout/componentGroups/*/componentPositions/*/component',
          '/componentGroups/*/componentPositions/*/component'
        ]
      })

      const layoutResponse = await this.fetchLayout(pageResponse.layout)

      await this.fetchNestedResources(layoutResponse, pageResponse, pageDataIri)
    } catch (error) {
      // Display error page
      this.ctx.error(error)
    } finally {
      this.finallyFetch(pageDataIri)
    }
  }

  private fetchLayout(layoutIri) {
    if (!layoutIri) {
      return {
        componentGroups: []
      }
    }
    return this.fetchResource({ path: layoutIri })
  }

  public async fetchPage(pageIri) {
    if (!this.startFetch(pageIri)) {
      return
    }

    try {
      const pageResponse = await this.fetchResource({
        path: pageIri,
        preload: [
          '/layout/componentGroups/*/componentPositions/*/component',
          '/componentGroups/*/componentPositions/*/component'
        ]
      })
      this.ctx.storage.setState(Fetcher.loadedPageKey, pageIri)

      const layoutResponse = await this.fetchLayout(pageResponse.layout)

      await this.fetchNestedResources(layoutResponse, pageResponse, pageIri)
    } catch (error) {
      // Display error page
      this.ctx.error(error)
    } finally {
      this.finallyFetch(pageIri)
    }
  }

  public async fetchRoute(path) {
    if (!this.startFetch(path)) {
      return
    }

    try {
      const routeManifestResponse = await this.fetcher({
        path: `/_/routes_manifest/${path}`
      })
      const manifestResources = routeManifestResponse.resource_iris
      manifestResources.forEach((manifestResource) => {
        this.fetchResource({ path: manifestResource })
      })
    } catch (error) {
      this.ctx.error(error)
    }

    try {
      const routeResponse = await this.fetchResource({
        path: `/_/routes/${path}`,
        preload: [
          '/page/layout/componentGroups/*/componentPositions/*/component',
          '/page/componentGroups/*/componentPositions/*/component',
          '/pageData/page/layout/componentGroups/*/componentPositions/*/component',
          '/pageData/page/componentGroups/*/componentPositions/*/component'
        ]
      })

      const pageResponse = await this.fetchPageByRouteResponse(routeResponse)
      if (!pageResponse) {
        return
      }
      this.ctx.storage.setState(
        Fetcher.loadedPageKey,
        routeResponse.pageData || pageResponse['@id']
      )

      const layoutResponse = await this.fetchLayout(pageResponse.layout)

      await this.fetchNestedResources(
        layoutResponse,
        pageResponse,
        routeResponse.redirectPath || path,
        routeResponse
      )
    } catch (error) {
      // Display error page
      this.ctx.error(error)
    } finally {
      this.finallyFetch(path)
    }
  }

  private fetchComponentGroups(paths) {
    return this.fetchCollection(
      { paths, preload: ['/componentPositions/*/component'] },
      (componentGroup) => {
        return this.fetchCollection(
          { paths: componentGroup.componentPositions },
          (componentPosition) => {
            return this.fetchComponent(componentPosition.component)
          }
        )
      }
    )
  }

  private async fetchComponent(componentIri: string) {
    const componentResource = await this.fetchResource({
      path: componentIri,
      preload: ['/componentGroups/componentPositions/*/component']
    })
    if (componentResource?.componentGroups) {
      await this.fetchComponentGroups(componentResource.componentGroups)
    }
  }

  private async fetchPageByRouteResponse(routeResponse) {
    if (!routeResponse) {
      return null
    }
    let page = routeResponse.page
    if (routeResponse.pageData) {
      const pageDataResponse = await this.fetchResource({
        path: routeResponse.pageData
      })
      if (!pageDataResponse) {
        return null
      }
      page = pageDataResponse.page
    }
    if (!page) {
      return null
    }
    return this.fetchResource({ path: page })
  }

  private setDocsUrlFromHeaders(headers) {
    if (this.ctx.storage.state[stateVars.docsUrl]) {
      return
    }

    const link = headers.link
    if (!link) {
      consola.warn('No Link header found while saving documentation url.')
      return
    }

    const matches =
      /<(.+)>; rel="http:\/\/www.w3.org\/ns\/hydra\/core#apiDocumentation"/.exec(
        link
      )
    if (matches === null) {
      consola.error(
        'The "Link" HTTP header is not of the type "http://www.w3.org/ns/hydra/core#apiDocumentation".'
      )
    }

    const docsUrl = matches[1]

    consola.debug('docs url set', docsUrl)
    this.ctx.storage.setState(stateVars.docsUrl, docsUrl)
  }

  /**
   * Mercure
   */
  private setMercureHubFromHeaders(headers) {
    if (this.ctx.storage.state.mercureHub) {
      return
    }

    const link = headers.link
    if (!link) {
      consola.warn('No Link header found while saving Mercure hub.')
      return
    }

    const matches = link.match(/<([^>]+)>;\s+rel="mercure".*/)
    if (!matches || !matches[1]) {
      consola.log('No Mercure rel in link header.')
      return
    }

    consola.debug('Mercure hub set', matches[1])
    this.ctx.storage.setState('mercureHub', matches[1])
  }

  public closeMercure() {
    if (this.eventSource) {
      this.eventSource.close()
      consola.info('Mercure eventSource closed')
    }
  }

  public initMercure() {
    const currentLoading = this.ctx.storage.getState(Fetcher.loadingEndpoint)
    if (currentLoading || this.fetchingCounter || !process.client) {
      return
    }

    let hubUrl = null
    try {
      hubUrl = this.getMercureHubURL()
    } catch (err) {
      consola.error('Could not get Mercure hub url.', err?.message)
      return
    }
    consola.debug(`Mercure hub eventsource URL ${hubUrl}`)

    // Refresh the topics
    if (this.eventSource && this.eventSource.readyState !== 2) {
      if (this.eventSource.url === hubUrl) {
        return
      }
      consola.info('Closing Mercure Event Source')
      this.closeMercure()
    }

    consola.info(`Created Mercure EventSource for "${hubUrl}"`)
    this.eventSource = new EventSource(hubUrl, { withCredentials: true })
    // will be in context of EventSource if not using call
    // eslint-disable-next-line no-useless-call
    this.eventSource.onmessage = async (messageEvent: MessageEvent) => {
      await this.handleMercureMessage(messageEvent)
    }
  }

  private getCurrentMercureResources(currentResources: {
    [any: string]: resourcesState
  }): string[] {
    const currentResourcesCategories = Object.values(currentResources)
    const resources = []
    for (const resourcesObject of currentResourcesCategories) {
      resources.push(...resourcesObject.currentIds)
    }
    return resources
  }

  private handleMercureMessage(event: MessageEvent) {
    // clear off any pending unprocessed messages if new message is for same entity
    const newMessage = {
      event,
      data: JSON.parse(event.data)
    }

    const currentResourceIris = this.getCurrentMercureResources(
      this.currentResources
    )

    if (!currentResourceIris.includes(newMessage.data['@id'])) {
      // the update may be for a new draft resource which will be related to a published resource currently loaded
      const publishedIri = newMessage.data?.publishedResource || null
      if (!publishedIri || !currentResourceIris.includes(publishedIri)) {
        return
      }
    }

    const newMessages = [
      ...this.mercureMessages.filter((msg: MercureMessage) => {
        return msg.data['@id'] !== newMessage.data['@id']
      })
    ]
    newMessages.push(newMessage)
    this.mercureMessages = newMessages

    // Must wait for existing api requests to happen and storage to update or we think something has changed when
    // it is this application changing it
    const mercurePendingProcesses = this.ctx.storage.getState(
      stateVars.mercurePendingProcesses
    )

    return new Promise((resolve) => {
      if (mercurePendingProcesses === 0) {
        consola.debug(
          'Invoking Mercure message handler. No request in progress.'
        )
        this.processMessageQueue().then(() => {
          resolve(true)
        })
        return
      }
      consola.debug(
        `Mercure message handler waiting for ${mercurePendingProcesses} processes to complete...`
      )
      const unwatchFn = this.ctx.storage.watchState(
        stateVars.mercurePendingProcesses,
        async (newValue) => {
          if (newValue === 0) {
            consola.debug('Request complete. Invoking Mercure message handler')
            await this.processMessageQueue()
            unwatchFn()
            resolve(true)
            return
          }
          consola.trace(
            `Mercure message handler waiting for ${newValue} processes to complete...`
          )
        }
      )
    })
  }

  private async processMessageQueue() {
    const messages = this.mercureMessages
    consola.debug(`Processing Mercure message queue: ${messages.length}`)
    this.mercureMessages = []
    for (const message of messages) {
      consola.debug('Mercure message received', message)
      let data = message.data

      // delete resource if deleted from API - instant...
      if (Object.keys(data).length === 1 && data['@id']) {
        this.ctx.storage.deleteResource(data['@id'])
        return
      }

      // we listen to all of these in case we are adding to an existing component collection
      if (this.shouldManualRefresh(data)) {
        data = await this.fetcher({ path: data['@id'] })
      }

      this.lastEventId = message.event.lastEventId

      // force option will add the resource into new even if there is not an existing resource
      // with the same ID to merge it into
      this.ctx.storage.setResource({
        isNew: true,
        resource: data,
        force: false
      })
    }
  }

  private shouldManualRefresh(data) {
    if (
      data['@type'] !== 'ComponentPosition' ||
      !this.currentResources.ComponentPosition.currentIds.includes(data['@id'])
    ) {
      return false
    }

    const pageDataPath = data._metadata.pageDataPath
    return !(!pageDataPath || pageDataPath === this.currentRoutePath)
  }

  private getMercureHubURL() {
    const hub = new URL(this.ctx.storage.state.mercureHub)

    hub.searchParams.append('topic', `*`)

    if (this.lastEventId) {
      hub.searchParams.append('Last-Event-ID', this.lastEventId)
    }

    return hub.toString()
  }
}

export default Fetcher
