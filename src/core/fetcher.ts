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
      const { data, headers } = await this.ctx.$axios.get(url, { headers: requestHeaders })
      this.setMercureHubFromHeaders(headers)
      return data
    } catch (error) {
      // Display error page
      this.ctx.error(Object.assign({}, AxiosErrorParser(error), {
        endpoint: url
      }))
    } finally {
      this.timer.end(`Fetching ${url}`)
    }
    consola.debug(`Fetched ${url}`)
  }

  private async fetchItem ({ path, preload, category }: {path: string, preload?: string[], category?: string}) {
    const resource = await this.fetcher({ path, preload })
    if (!resource) {
      return resource
    }
    this.ctx.storage.setResource({ resource, category })
    return resource
  }

  private fetchCollection ({ paths, category }: {paths: string[], category?: string}, callback) {
    return bluebird.map(paths, (path) => {
      return this.fetcher({ path })
        .then(resource => ({ resource, path }))
    }, { concurrency: this.options.fetchConcurrency || null })
      .each(({ resource }) => {
        resource && this.ctx.storage.setResource({ category, isNew: false, resource })
        return callback(resource)
      })
  }

  public async fetchRoute (path) {
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

    await this.fetchCollection({ paths: [...pageResponse.componentCollections, ...layoutResponse.componentCollections] }, (componentCollection) => {
      return this.fetchCollection({ paths: componentCollection.componentPositions }, (componentPosition) => {
        return this.fetchItem({ path: componentPosition.component, category: StoreCategories.Component })
      })
    })
    this.ctx.storage.setCurrentRoute(routeResponse['@id'])
    this.ctx.storage.setState(Fetcher.loadingRouteKey, false)
    this.timer.end(`Fetch route ${path}`)
    this.timer.print()
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

  /**
   * Mercure
   */
  private setMercureHubFromHeaders (headers) {
    if (this.ctx.storage.state.mercureHub) { return }

    const link = headers.link
    if (!link) {
      consola.warn('No Link header found.')
      return
    }

    const match = link.match(/<([^>]+)>;\s+rel="mercure".*/)
    if (!match || !match[1]) {
      consola.log('No mercure rel in link header.')
      return
    }

    consola.log('mercure hub set', match[1])
    this.ctx.storage.setState('mercureHub', match[1])
  }

  public initMercure (currentResources) {
    if ((this.eventSource && this.eventSource.readyState !== 2) || !process.client) { return }
    let hubUrl = null

    try {
      hubUrl = this.getMercureHubURL(currentResources)
    } catch (err) {
      consola.error('Could not get mercure hub url.')
      return
    }

    this.eventSource = new EventSource(hubUrl)
    this.eventSource.onmessage = (messageEvent) => {
      const data = JSON.parse(messageEvent.data)
      this.lastEventId = data.id
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
