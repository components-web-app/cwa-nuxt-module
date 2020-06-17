import * as bluebird from 'bluebird'
import consola from 'consola'
import type { CwaOptions } from '../'
import { Storage, StoreCategories } from './storage'

export default class Cwa {
  public ctx: any
  public options: CwaOptions

  // Holds the EventSource connection with mercure
  private eventSource
  private readonly fetcher
  private lastEventId
  public $storage: Storage
  public $state

  constructor (ctx, options) {
    if (options.allowUnauthorizedTls && ctx.isDev) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    }

    this.ctx = ctx

    this.fetcher = async ({ path, preload }) => {
      // For dynamic components the API must not what route/path the request was originally for
      const url = `${process.env.baseUrl}${path}`
      consola.debug('Fetching %s', url)

      const requestHeaders = { Path: this.ctx.route.fullPath } as { Path: string, Preload?: string }
      if (preload) {
        requestHeaders.Preload = preload.join(',')
      }

      try {
        const { data, headers } = await ctx.$axios.get(url, { headers: requestHeaders, progress: false })
        this.setMercureHubFromHeaders(headers)
        return data
      } catch (error) {
        if (error.response && error.response.status && typeof error.response.data === 'object') {
          this.ctx.error({
            statusCode: error.response.status,
            message: error.response.data.message || error.response.data['hydra:description'],
            endpoint: url
          })
        } else if (error.message) {
          this.ctx.error({
            statusCode: 500,
            message: error.message,
            endpoint: url
          })
        }
      }
    }

    this.options = options

    options.initialState = { }
    const storage = new Storage(ctx, options)
    this.$storage = storage
    this.$state = storage.state
  }

  async fetchItem ({ path, preload, category }: {path: string, preload?: string[], category?: string}) {
    const resource = await this.fetcher({ path, preload })
    if (!resource) {
      return resource
    }
    this.$storage.setResource({ id: resource['@id'], name: resource['@type'], category, isNew: false, resource })
    return resource
  }

  async fetchCollection ({ paths, category }: {paths: string[], category?: string}, callback) {
    return bluebird.map(paths, (path) => {
      return this.fetcher({ path })
        .then(resource => ({ resource, path }))
    }, { concurrency: this.options.fetchConcurrency || null })
      .each(({ resource }) => {
        resource && this.$storage.setResource({ id: resource['@id'], name: resource['@type'], category, isNew: false, resource })
        return callback(resource)
      })
  }

  public async fetchRoute (path) {
    this.$storage.resetCurrentResources()
    this.$storage.setState('loadingRoute', true)
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
    const pageResponse = await this.fetchPage(routeResponse)
    if (!pageResponse) {
      return
    }
    const layoutResponse = await this.fetchItem({ path: pageResponse.layout })

    await this.fetchCollection({ paths: [...pageResponse.componentCollections, ...layoutResponse.componentCollections] }, (componentCollection) => {
      return this.fetchCollection({ paths: componentCollection.componentPositions }, (componentPosition) => {
        return this.fetchItem({ path: componentPosition.component, category: StoreCategories.Component })
      })
    })
    this.$storage.setCurrentRoute(routeResponse['@id'])
    this.$storage.setState('loadingRoute', false)
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

  setMercureHubFromHeaders (headers) {
    if (this.$state.mercureHub) { return }

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

    this.$storage.setState('mercureHub', match[1])
  }

  getMercureHubURL () {
    const hub = new URL(this.$state.mercureHub)

    const appendTopics = (obj) => {
      for (const resourceType in obj) {
        const resourcesObject = obj[resourceType]
        if (resourcesObject.currentIds === undefined) {
          continue
        }
        resourcesObject.currentIds.forEach((id) => {
          hub.searchParams.append('topic', this.ctx.env.baseUrl + id)
        })
      }
    }
    appendTopics(this.$state.resources.current)

    if (this.lastEventId) {
      hub.searchParams.append('Last-Event-ID', this.lastEventId)
    }

    return hub.toString()
  }

  async init () {
    // first load client side initialised here. Router middleware re initialised every route
    if (process.client) {
      await this.initMercure()
    }
  }

  async initMercure () {
    if ((this.eventSource && this.eventSource.readyState !== 2) || !process.client) { return }

    this.eventSource = new EventSource(this.getMercureHubURL())
    this.eventSource.onmessage = (messageEvent) => {
      const data = JSON.parse(messageEvent.data)
      this.lastEventId = data.id
      this.$storage.setResource({
        isNew: true,
        // TODO find another way of doing this, maybe add this information from the API directly
        name: data['@type'],
        id: data['@id'],
        resource: data
      })
    }
  }

  withError (route, err) {
    this.$storage.setState('error', `An error occurred while requesting ${route.path}`)
    consola.error(err)
  }

  updateResources () {
    this.$storage.updateResources()
  }

  get resourcesOutdated () {
    return this.$storage.areResourcesOutdated()
  }
}
