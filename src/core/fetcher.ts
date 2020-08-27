import * as bluebird from 'bluebird'
import consola from 'consola'
import { NuxtAxiosInstance } from '@nuxtjs/axios'
import AxiosErrorParser from '../utils/AxiosErrorParser'
import DebugTimer from '../utils/DebugTimer'
import Storage, { StoreCategories } from './storage'

export class Fetcher {
  // Holds the EventSource connection with mercure
  private eventSource?: EventSource
  private lastEventId?: string
  private ctx: {
    $axios: NuxtAxiosInstance,
    error: any,
    apiUrl: string,
    storage: Storage
  }

  private options: {
    fetchConcurrency: number
  }

  public static readonly loadingRouteKey = 'loadingRoute'
  private timer: DebugTimer;

  constructor ({ $axios, error, apiUrl, storage }, { fetchConcurrency }) {
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

  private async fetcher ({ path: url, preload }: { path: string, preload?: string[] }) {
    consola.debug(`Fetching ${url}`)
    this.timer.start(`Fetching ${url}`)

    // For dynamic components the API must know what route/path the request was originally for
    // so we set a custom "Path" header
    const requestHeaders = { Path: this.ctx.storage.getState(Fetcher.loadingRouteKey) } as { Path: string, Preload?: string }

    // preload headers for Vulcain
    if (preload) {
      requestHeaders.Preload = preload.join(',')
    }

    try {
      const { headers, data } = await this.ctx.$axios.get(url, { headers: requestHeaders })
      this.setDocsUrlFromHeaders(headers)
      this.setMercureHubFromHeaders(headers)
      return data
    } catch (error) {
      const sanitisedError = AxiosErrorParser(error)

      // for publishable components - when getting a collection the position and component id will exist.
      // SSR is not authorized to view so it will return a 404. We know it exists as an ID is there
      // By not throwing an error we can re-fetch client-side
      if (sanitisedError.statusCode === 404) {
        return
      }

      // Display error page
      this.ctx.error(Object.assign({}, sanitisedError, {
        endpoint: url
      }))
    } finally {
      this.timer.end(`Fetching ${url}`)
    }
    consola.debug(`Fetched ${url}`)
  }

  public async fetchItem ({ path, preload, category }: {path: string, preload?: string[], category?: string}) {
    const resource = await this.fetcher({ path, preload })
    if (!resource) {
      return resource
    }
    this.ctx.storage.setResource({ resource, category })
    return resource
  }

  private fetchCollection ({ paths, preload, category }: {paths: string[], preload?: string[], category?: string}, callback) {
    return bluebird.map(paths, (path) => {
      return this.fetcher({ path, preload })
        .then(resource => ({ resource, path }))
    }, { concurrency: this.options.fetchConcurrency || null })
      .each(({ resource }) => {
        resource && this.ctx.storage.setResource({ category, isNew: false, resource })
        return callback(resource)
      })
  }

  public async fetchRoute (path) {
    this.timer.reset()
    this.timer.start(`Fetch route ${path}`)
    this.ctx.storage.resetCurrentResources()
    this.ctx.storage.setState(Fetcher.loadingRouteKey, path)
    this.eventSource && this.eventSource.close()
    const routeResponse = await this.fetchItem(
      {
        path: `/_/routes/${path}`,
        preload: [
          '/page/layout/componentCollections/*/componentPositions/*/component',
          '/page/componentCollections/*/componentPositions/*/component',
          '/pageData/page/layout/componentCollections/*/componentPositions/*/component',
          '/pageData/page/componentCollections/*/componentPositions/*/component'
        ]
      })

    if (!routeResponse) {
      return
    }

    const pageResponse = await this.fetchPage(routeResponse)
    if (!pageResponse) {
      return
    }
    const layoutResponse = await this.fetchItem({ path: pageResponse.layout })
    this.ctx.storage.setState('layout', layoutResponse.reference)

    await this.fetchComponentCollections([...pageResponse.componentCollections, ...layoutResponse.componentCollections])
    this.ctx.storage.setCurrentRoute(routeResponse['@id'])
    this.ctx.storage.setState(Fetcher.loadingRouteKey, false)
    this.timer.end(`Fetch route ${path}`)
    this.timer.print()
  }

  private fetchComponentCollections (paths) {
    return this.fetchCollection({ paths, preload: ['/componentPositions/*/component'] }, (componentCollection) => {
      return this.fetchCollection({ paths: componentCollection.componentPositions }, (componentPosition) => {
        return this.fetchComponent(componentPosition.component)
      })
    })
  }

  public async fetchComponentCollection (path) {
    this.timer.reset()
    await this.fetchComponentCollections([path])
    this.initMercure(this.ctx.storage.state.resources.current)
  }

  public async fetchComponent (path) {
    this.timer.reset()
    await this.fetchItem({ path, category: StoreCategories.Component })
    this.initMercure(this.ctx.storage.state.resources.current)
  }

  private async fetchPage (routeResponse) {
    let page = routeResponse.page
    if (routeResponse.pageData) {
      const pageDataResponse = await this.fetchItem({ path: routeResponse.pageData, category: StoreCategories.PageData })
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

  private setDocsUrlFromHeaders (headers) {
    if (this.ctx.storage.state.docsUrl) { return }

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

    consola.log('docs url set', matches[1])
    this.ctx.storage.setState('docsUrl', matches[1])
  }

  /**
   * Mercure
   */
  private setMercureHubFromHeaders (headers) {
    if (this.ctx.storage.state.mercureHub) { return }

    const link = headers.link
    if (!link) {
      consola.warn('No Link header found while saving mercure hub.')
      return
    }

    const matches = link.match(/<([^>]+)>;\s+rel="mercure".*/)
    if (!matches || !matches[1]) {
      consola.log('No mercure rel in link header.')
      return
    }

    consola.log('mercure hub set', matches[1])
    this.ctx.storage.setState('mercureHub', matches[1])
  }

  public initMercure (currentResources) {
    if (!process.client) { return }

    let hubUrl = null

    try {
      hubUrl = this.getMercureHubURL(currentResources)
    } catch (err) {
      consola.error('Could not get mercure hub url.')
      return
    }

    // Refresh the topics
    if (this.eventSource && this.eventSource.readyState !== 2) {
      if (this.eventSource.url === hubUrl) {
        return
      }
      consola.info('Closing Mercure event source to re-open with latest topics')
      this.eventSource.close()
    }

    this.eventSource = new EventSource(hubUrl)
    this.eventSource.onmessage = (messageEvent: MessageEvent) => {
      const data = JSON.parse(messageEvent.data)
      if (Object.keys(data).length === 1 && data['@id']) {
        this.ctx.storage.deleteResource(data['@id'])
        return
      }
      this.lastEventId = messageEvent.lastEventId
      this.ctx.storage.setResource({
        isNew: true,
        resource: data
      })
    }
  }

  private getMercureHubURL (currentResources) {
    const hub = new URL(this.ctx.storage.state.mercureHub)

    const appendTopics = (obj) => {
      for (const resourceType in obj) {
        const resourcesObject = obj[resourceType]
        if (resourcesObject.currentIds === undefined) {
          continue
        }
        resourcesObject.currentIds.forEach((id) => {
          hub.searchParams.append('topic', this.ctx.apiUrl + id)
        })
      }
    }
    appendTopics(currentResources)

    if (this.lastEventId) {
      hub.searchParams.append('Last-Event-ID', this.lastEventId)
    }

    return hub.toString()
  }
}

export default Fetcher
