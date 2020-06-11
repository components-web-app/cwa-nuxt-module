import * as bluebird from 'bluebird'
import consola from 'consola'
import type { CwaOptions } from '../'
import Storage from './storage'

export default class Cwa {
  public ctx: any
  public options: CwaOptions

  // Holds the EventSource connection with mercure
  private eventSource
  private readonly fetcher
  private lastEventId
  public $storage: Storage
  public $state
  private currentRoute: string

  constructor (ctx, options) {
    if (process.server) {
      // WARNING DISABLE THIS IN PRODUCITON
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    }

    this.ctx = ctx

    this.fetcher = async ({ path, preload }) => {
      // For dynamic components the API must not what route/path the request was originally for
      let url = `${process.env.baseUrl}${path}?path=${this.ctx.route.fullPath}`
      consola.debug('Fetching %s', url)

      const requestHeaders = preload ? { Preload: preload.join(',') } : {}

      try {
        const { data, headers } = await ctx.$axios.get(url, { headers: requestHeaders })
        this.setMercureHubFromHeaders(headers)
        return data
      } catch (error) {
        if (error.response && error.response.status && typeof error.response.data === 'object') {
          this.ctx.error({
            statusCode: error.response.status,
            message: error.response.data['hydra:description'],
            endpoint: url
          })
        } else if(error.message) {
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

  async fetchItem ({ path, preload }: {path: string, preload?: string[]}) {
    const resource = await this.fetcher({ path, preload })
    if (!resource) {
      return resource
    }
    this.$storage.setResource({ id: resource['@id'], name: resource['@type'], isNew: false, resource })
    return resource
  }

  async fetchCollection ({ paths }, callback) {
    return bluebird.map(paths, (path) => {
      return this.fetcher({ path })
        .then(resource => ({ resource, path }))
    }, { concurrency: this.options.fetchConcurrency || null })
      .each(({ resource }) => {
        resource && this.$storage.setResource({ id: resource['@id'], name: resource['@type'], isNew: false, resource })
        return callback(resource)
      })
  }

  public async fetchRoute (path) {
    this.$storage.setState('loadingRoute', true)
    this.eventSource && this.eventSource.close()
    const routeResponse = await this.fetchItem({ path: `/_/routes/${path}`, preload: ['/page/layout/componentCollections/*/componentPositions/*/component', '/page/componentCollections/*/componentPositions/*/component'] })
    if (!routeResponse.page) {
      return
    }

    const pageResponse = await this.fetchItem({ path: routeResponse.page })
    const layoutResponse = await this.fetchItem({ path: pageResponse.layout })

    await this.fetchCollection({ paths: [...pageResponse.componentCollections, ...layoutResponse.componentCollections] }, (componentCollection) => {
      return this.fetchCollection({ paths: componentCollection.componentPositions }, (componentPosition) => {
        return this.fetchItem({ path: componentPosition.component })
      })
    })
    this.$storage.setCurrentRoute({ id: routeResponse['@id'] })
    this.$storage.setState('loadingRoute', false)
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

    for (const resourceType in this.$state.current) {
      this.$state.current[resourceType].allIds.forEach((id) => {
        hub.searchParams.append('topic', id)
      })
    }

    // TODO: discuss if URI templates aren't better
    // hub.searchParams.append('topic', '/_/routes/{id}')
    // hub.searchParams.append('topic', '/_/pages/{id}')
    // hub.searchParams.append('topic', '/_/layout/{id}')
    // hub.searchParams.append('topic', '/_/component_collections/{id}')
    // hub.searchParams.append('topic', '/component/html_contents/{id}')

    if (this.lastEventId) {
      hub.searchParams.append('Last-Event-ID', this.lastEventId)
    }

    return hub.toString()
  }

  async initMercure () {
    if ((this.eventSource && this.eventSource.readyState !== 2) || !process.client) { return }

    this.eventSource = new EventSource(this.getMercureHubURL())
    this.eventSource.onmessage = (e) => {
      this.lastEventId = e.id
      this.$storage.setResource({
        isNew: true,
        // TODO find another way of doing this, maybe add this information from the API directly
        name: e['@type'],
        id: e['@id'],
        resource: e
      })
    }
  }

  withError (route, err) {
    this.$storage.setState('error', `An error occurred while requesting ${route.path}`)
    consola.error(err)
  }

  async init () {
    // first load client side initialised here. Router middleware re initialised every route
    if (process.client) {
      await this.initMercure()
    }
  }
}
