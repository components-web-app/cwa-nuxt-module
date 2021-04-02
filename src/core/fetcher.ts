import * as bluebird from 'bluebird'
import consola from 'consola'
import { NuxtAxiosInstance } from '@nuxtjs/axios'
import AxiosErrorParser from '../utils/AxiosErrorParser'
import DebugTimer from '../utils/DebugTimer'
import ApiRequestError from '../inc/api-error'
import Storage, { resourcesState, StoreCategories } from './storage'

declare interface MercureMessage {
  event: MessageEvent
  data: any
}

export class Fetcher {
  // Holds the EventSource connection with mercure
  private eventSource?: EventSource
  private lastEventId?: string
  private ctx: {
    $axios: NuxtAxiosInstance
    error: any
    apiUrl: string
    storage: Storage
  }

  private options: {
    fetchConcurrency: number
  }

  public static readonly loadingRouteKey = 'loadingRoute'
  private timer: DebugTimer
  private initMercureTimeout?: any = null
  private mercureMessages: Array<MercureMessage> = []

  constructor({ $axios, error, apiUrl, storage }, { fetchConcurrency }) {
    this.ctx = {
      $axios,
      error,
      apiUrl,
      storage
    }
    this.options = {
      fetchConcurrency
    }
    this.timer = new DebugTimer()
  }

  private get currentResources() {
    return this.ctx.storage.state.resources.current
  }

  public get apiUrl() {
    return this.ctx.apiUrl
  }

  private async fetcher({
    path: url,
    preload
  }: {
    path: string
    preload?: string[]
  }) {
    consola.trace(`Fetching ${url}`)
    this.timer.start(`Fetching ${url}`)

    // For dynamic components the API must know what route/path the request was originally for
    // so we set a custom "Path" header
    const requestHeaders = {
      Path: this.ctx.storage.getState(Fetcher.loadingRouteKey)
    } as { Path: string; Preload?: string }

    // preload headers for Vulcain
    if (preload) {
      requestHeaders.Preload = preload.join(',')
    }

    try {
      const { headers, data } = await this.ctx.$axios.get(url, {
        headers: requestHeaders
      })
      this.setDocsUrlFromHeaders(headers)
      this.setMercureHubFromHeaders(headers)
      return data
    } catch (error) {
      const sanitisedError = AxiosErrorParser(error)

      // for publishable components - when getting a collection the position and component id will exist.
      // SSR is not authorized to view so it will return a 404. We know it exists as an ID is there
      // By not throwing an error we can re-fetch client-side
      // However, when fetching a route that does not exist, we need an error...
      // Changed this functionality here to throw an exception so it can be handled by the calling function
      throw new ApiRequestError(
        sanitisedError.message,
        sanitisedError.statusCode,
        sanitisedError.endpoint
      )
    } finally {
      this.timer.end(`Fetching ${url}`)
      consola.debug(`Fetched ${url}`)
    }
  }

  public async fetchItem({
    path,
    preload
  }: {
    path: string
    preload?: string[]
    category?: string
  }) {
    const resource = await this.fetcher({ path, preload })
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
      this.initMercure(this.currentResources)
    }
    return resource
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

  public async fetchPage(pageIri) {
    this.timer.reset()
    this.timer.start(`Fetch page ${pageIri}`)
    this.ctx.storage.resetCurrentResources()
    this.ctx.storage.setState(Fetcher.loadingRouteKey, pageIri)
    this.closeMercure()
    try {
      const pageResponse = await this.fetchItem({
        path: pageIri,
        preload: [
          '/layout/componentCollections/*/componentPositions/*/component',
          '/componentCollections/*/componentPositions/*/component'
        ]
      })

      const layoutResponse = await this.fetchItem({ path: pageResponse.layout })
      this.ctx.storage.setState('layout', layoutResponse['@id'])

      await this.fetchComponentCollections([
        ...pageResponse.componentCollections,
        ...layoutResponse.componentCollections
      ])
      this.ctx.storage.setState(Fetcher.loadingRouteKey, false)
    } catch (error) {
      // Display error page
      this.ctx.error(error)
    } finally {
      this.initMercure(this.currentResources)
      this.timer.end(`Fetch page ${pageIri}`)
      this.timer.print()
    }
  }

  public async fetchRoute(path) {
    this.timer.reset()
    this.timer.start(`Fetch route ${path}`)
    this.ctx.storage.resetCurrentResources()
    this.ctx.storage.setState(Fetcher.loadingRouteKey, path)
    this.eventSource && this.eventSource.close()
    try {
      const routeResponse = await this.fetchItem({
        path: `/_/routes/${path}`,
        preload: [
          '/page/layout/componentCollections/*/componentPositions/*/component',
          '/page/componentCollections/*/componentPositions/*/component',
          '/pageData/page/layout/componentCollections/*/componentPositions/*/component',
          '/pageData/page/componentCollections/*/componentPositions/*/component'
        ]
      })

      const pageResponse = await this.fetchPageByRouteResponse(routeResponse)
      if (!pageResponse) {
        return
      }
      const layoutResponse = await this.fetchItem({ path: pageResponse.layout })
      this.ctx.storage.setState('layout', layoutResponse['@id'])

      await this.fetchComponentCollections([
        ...pageResponse.componentCollections,
        ...layoutResponse.componentCollections
      ])
      this.ctx.storage.setCurrentRoute(routeResponse['@id'])
      this.ctx.storage.setState(Fetcher.loadingRouteKey, false)
    } catch (error) {
      // Display error page
      this.ctx.error(error)
    } finally {
      this.initMercure(this.currentResources)
      this.timer.end(`Fetch route ${path}`)
      this.timer.print()
    }
  }

  private fetchComponentCollections(paths) {
    return this.fetchCollection(
      { paths, preload: ['/componentPositions/*/component'] },
      (componentCollection) => {
        return this.fetchCollection(
          { paths: componentCollection.componentPositions },
          (componentPosition) => {
            return this.fetchComponent(componentPosition.component)
          }
        )
      }
    )
  }

  public async fetchComponent(path) {
    this.timer.reset()
    try {
      return await this.fetchItem({ path, category: StoreCategories.Component })
    } catch (error) {
      // may be a draft component without a published version - only accessible to admin, therefore only available client-side
      if (error instanceof ApiRequestError && error.statusCode === 404) {
        return
      }
      throw error
    }
  }

  private async fetchPageByRouteResponse(routeResponse) {
    let page = routeResponse.page
    if (routeResponse.pageData) {
      const pageDataResponse = await this.fetchItem({
        path: routeResponse.pageData,
        category: StoreCategories.PageData
      })
      if (!pageDataResponse) {
        return null
      }
      page = pageDataResponse.page
    }
    if (!page) {
      return null
    }
    return this.fetchItem({ path: page })
  }

  private setDocsUrlFromHeaders(headers) {
    if (this.ctx.storage.state.docsUrl) {
      return
    }

    const link = headers.link
    if (!link) {
      consola.warn('No Link header found while saving documentation url.')
      return
    }

    const matches = /<(.+)>; rel="http:\/\/www.w3.org\/ns\/hydra\/core#apiDocumentation"/.exec(
      link
    )
    if (matches === null) {
      consola.error(
        'The "Link" HTTP header is not of the type "http://www.w3.org/ns/hydra/core#apiDocumentation".'
      )
    }

    const docsUrl = matches[1]

    consola.debug('docs url set', docsUrl)
    this.ctx.storage.setState('docsUrl', docsUrl)
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

  public initMercure(currentResources: { any: resourcesState }) {
    if (this.initMercureTimeout) {
      clearTimeout(this.initMercureTimeout)
    }
    this.initMercureTimeout = setTimeout(() => {
      const currentResourcesCategories = Object.values(currentResources)
      if (!process.client) {
        return
      }

      let hubUrl = null
      try {
        hubUrl = this.getMercureHubURL(currentResourcesCategories)
      } catch (err) {
        consola.error('Could not get Mercure hub url.', err.message)
        return
      }
      consola.debug(`Mercure hub eventsource URL ${hubUrl}`)

      // Refresh the topics
      if (this.eventSource && this.eventSource.readyState !== 2) {
        if (this.eventSource.url === hubUrl) {
          return
        }
        consola.info(
          'Closing Mercure event source to re-open with latest topics'
        )
        this.eventSource.close()
      }

      consola.info(`Created Mercure EventSource for "${hubUrl}"`)
      this.eventSource = new EventSource(hubUrl)
      // will be in context of EventSource if not using call
      // eslint-disable-next-line no-useless-call
      this.eventSource.onmessage = (messageEvent: MessageEvent) => {
        this.handleMercureMessage(messageEvent)
      }
    }, 100)
  }

  private handleMercureMessage(event: MessageEvent) {
    // clear off any pending unprocessed messages if new message is for same entity
    const newMessage = {
      event,
      data: JSON.parse(event.data)
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
      'mercurePendingProcesses'
    )

    return new Promise((resolve) => {
      if (mercurePendingProcesses === 0) {
        consola.debug(
          'Invoking Mercure message handler. No request in progress.'
        )
        this.processMessageQueue()
        resolve()
        return
      }
      consola.debug(
        `Mercure message handler waiting for ${mercurePendingProcesses} processes to complete...`
      )
      const unwatchFn = this.ctx.storage.watchState(
        'mercurePendingProcesses',
        (newValue) => {
          if (newValue === 0) {
            consola.debug('Request complete. Invoking Mercure message handler')
            this.processMessageQueue()
            unwatchFn()
            resolve()
            return
          }
          consola.trace(
            `Mercure message handler waiting for ${newValue} processes to complete...`
          )
        }
      )
    })
  }

  private processMessageQueue() {
    const messages = this.mercureMessages
    consola.debug(`Processing Mercure message queue: ${messages.length}`)
    this.mercureMessages = []
    for (const message of messages) {
      consola.debug('Mercure message received', message)
      const data = message.data
      if (Object.keys(data).length === 1 && data['@id']) {
        this.ctx.storage.deleteResource(data['@id'])
        return
      }
      this.lastEventId = message.event.lastEventId

      // we listen to all of these in case we are adding to an existing component collection
      const force = this.forceComponentPositionPersist(data)

      // force option will add the resource into new even if there is not an existing resource
      // with the same ID to merge it into
      this.ctx.storage.setResource({
        isNew: true,
        resource: data,
        force
      })
    }
  }

  private forceComponentPositionPersist(data) {
    if (data['@type'] !== 'ComponentPosition') {
      return false
    }

    if (
      !this.currentResources.ComponentCollection.currentIds.includes(
        data.componentCollection
      )
    ) {
      consola.info(
        'New ComponentPosition received by Mercure is not included in any current ComponentCollection resources. Skipped.'
      )
      return false
    }

    // We do not need to adapt behaviour if the ComponentPosition already exists
    if (
      this.currentResources.ComponentPosition.currentIds.includes(data['@id'])
    ) {
      return false
    }

    const collectionIri = data.componentCollection
    // Check if this ComponentCollection resource is current
    const componentCollectionResource = this.currentResources
      .ComponentCollection.byId[collectionIri]
    if (!componentCollectionResource) {
      return false
    }

    // Update the ComponentCollection resource to include new position
    // Mercure will not publish this, the resource is not updated in the database
    this.ctx.storage.setResource({
      resource: {
        ...componentCollectionResource,
        componentPositions: [
          ...componentCollectionResource.componentPositions,
          data['@id']
        ]
      },
      isNew: true
    })
    return true
  }

  private getMercureHubURL(currentResources: resourcesState[]) {
    const hub = new URL(this.ctx.storage.state.mercureHub)

    hub.searchParams.append(
      'topic',
      `${this.ctx.apiUrl}/_/component_positions/{id}`
    )
    for (const resourcesObject of currentResources) {
      if (resourcesObject.currentIds === undefined) {
        continue
      }
      resourcesObject.currentIds.forEach((id) => {
        hub.searchParams.append('topic', this.ctx.apiUrl + id)
      })
    }
    if (hub.searchParams.get('topic') === null) {
      throw new Error('No current resources/topics.')
    }

    if (this.lastEventId) {
      hub.searchParams.append('Last-Event-ID', this.lastEventId)
    }

    return hub.toString()
  }
}

export default Fetcher
