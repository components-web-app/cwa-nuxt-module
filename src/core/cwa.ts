import * as bluebird from 'bluebird'
import consola from 'consola'
import type { CwaOptions } from '../'
import ApiError from '../inc/api-error'
import { Storage, StoreCategories } from './storage'
import { cwaRouteDisabled } from '../utils'

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

    this.fetcher = async ({ path: url, preload }) => {
      consola.debug('Fetching %s', url)

      // For dynamic components the API must know what route/path the request was originally for
      // so we set a custom "Path" header
      const requestHeaders = { Path: this.ctx.route.fullPath } as { Path: string, Preload?: string }

      // preload headers for vulcain
      if (preload) {
        requestHeaders.Preload = preload.join(',')
      }

      try {
        const { data, headers } = await ctx.$axios.get(url, { headers: requestHeaders })
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
    this.$storage.setState('layout', layoutResponse.reference)

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

    consola.log('mercure hub set', match[1])
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
          hub.searchParams.append('topic', this.ctx.env.API_URL + id)
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
    if ((this.eventSource && this.eventSource.readyState !== 2) || !process.client || cwaRouteDisabled(this.ctx.route)) { return }

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

  get resources () {
    return this.$state.resources.current
  }

  async addResource (endpoint, data) {
    consola.warn(`Need to implement functionality to add ${endpoint}`, data)
    // we need to post to the API with provided data
    // the response must be added to the store
    // we must update mercure topics to include new resource
    throw new ApiError('Functionality ot implemented yet')
  }

  // We will need to be able to update resources and there will be a toggle to say whether we post this to the API right away
  // updateResource(type, iri, data, realtime) {
  //
  // }

  // We will want to have saved the resources we are trying to update in another state
  // so we can detect there are unsaved changes to let the user know and to provide an
  // easy way to post all the updates to the API and update the store. Do not rely on mercure
  // as the resource may not have mercure enabled
  // async postResourceUpdates()
  // {}

  get isAdmin () {
    return this.userHasRole('ROLE_ADMIN')
  }

  userHasRole (role) {
    return this.ctx.$auth.user ? this.ctx.$auth.user.roles.includes(role) : false
  }

  setLayout (layout) {
    this.$storage.setState('layout', layout)
  }

  get layout () {
    return this.$storage.getState('layout')
  }
}
